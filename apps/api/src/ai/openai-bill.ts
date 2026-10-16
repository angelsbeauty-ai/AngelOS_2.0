/** OpenAI organization Costs API. The dollar amount is theirs, not an AngelOS estimate. */
export function sumCostUsd(payload: any): number | null {
  const buckets = payload?.data;
  if (!Array.isArray(buckets)) return null;
  let cents = 0;
  for (const bucket of buckets) {
    const rows = bucket?.results ?? bucket?.result ?? [];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const value = Number(row?.amount?.value);
      if (!Number.isFinite(value)) continue;
      cents += Math.round(value * 100);
    }
  }
  return cents / 100;
}

/** Split a real bill by how many times each person used the assistant. Amounts add up to the bill. */
export function shareBill(totalUsd: number, counts: number[]): number[] {
  const totalCents = Math.round(totalUsd * 100);
  const sum = counts.reduce((a, b) => a + b, 0);
  if (totalCents <= 0 || sum <= 0) return counts.map(() => 0);
  const parts = counts.map((c) => Math.floor((totalCents * c) / sum));
  let left = totalCents - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0 && i < parts.length; i += 1) { parts[i] += 1; left -= 1; }
  return parts.map((c) => c / 100);
}

export async function fetchOpenAiMonthUsd(startIso: string, end = new Date()): Promise<{ usd: number } | { error: string }> {
  const key = process.env.OPENAI_ADMIN_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return { error: 'OpenAI is not connected, so the bill cannot be read.' };
  const start = Math.floor(new Date(startIso).getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);
  if (!Number.isFinite(start) || endSec <= start) return { error: 'Your OpenAI bill could not be read right now.' };
  let page: string | null = null;
  let usd = 0;
  for (let i = 0; i < 6; i += 1) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time', String(start));
    url.searchParams.set('end_time', String(endSec));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (page) url.searchParams.set('page', page);
    let res: Response;
    try { res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) }); }
    catch { return { error: 'Your OpenAI bill could not be read right now.' }; }
    if (res.status === 401 || res.status === 403) return { error: 'OpenAI did not share the bill. The real amount needs an admin key. AngelOS will not guess it.' };
    if (!res.ok) return { error: 'Your OpenAI bill could not be read right now.' };
    const body = await res.json().catch(() => null);
    const part = sumCostUsd(body);
    if (part == null) return { error: 'Your OpenAI bill could not be read right now.' };
    usd += part;
    page = body?.has_more && body?.next_page ? String(body.next_page) : null;
    if (!page) break;
  }
  return { usd: Math.round(usd * 100) / 100 };
}

/** Prepaid credit summary, only when OpenAI returns all three numbers. */
export function readCredit(body: any): { grantedUsd: number; usedUsd: number; availableUsd: number } | null {
  const granted = money(body?.total_granted);
  const used = money(body?.total_used);
  const available = money(body?.total_available);
  if (granted == null || used == null || available == null) return null;
  return { grantedUsd: granted, usedUsd: used, availableUsd: available };
}

function money(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const CREDIT_URLS = [
  'https://api.openai.com/v1/dashboard/billing/credit_grants',
  'https://api.openai.com/v1/organization/billing/credit_grants'
];

/** Remaining prepaid credit. OpenAI does not document this, so a refusal is reported, never guessed. */
export async function fetchOpenAiCredit(): Promise<{ credit: { grantedUsd: number; usedUsd: number; availableUsd: number } } | { error: string }> {
  const key = process.env.OPENAI_ADMIN_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return { error: 'OpenAI is not connected, so the credit left cannot be read.' };
  let denied = false;
  for (const url of CREDIT_URLS) {
    let res: Response;
    try { res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) }); }
    catch { continue; }
    if (res.status === 401 || res.status === 403) { denied = true; continue; }
    if (!res.ok) continue;
    const credit = readCredit(await res.json().catch(() => null));
    if (credit) return { credit };
  }
  if (denied) return { error: 'OpenAI did not share the credit left. A project key cannot read it. An admin key is required. AngelOS will not guess it.' };
  return { error: 'OpenAI does not share how much credit is left.' };
}
