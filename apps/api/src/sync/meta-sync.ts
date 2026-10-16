/**
 * Pure helpers for pulling a studio's own Instagram / Facebook data with its Page token (read only).
 * No database here: the service decides what to store. Never sends anything.
 */
export interface GraphError { status: number; code?: number; message: string }
export interface SyncedMessage { id: string; fromId: string; fromName: string | null; body: string; createdAt: string }
export interface SyncedConversation { contactId: string; contactName: string | null; messages: SyncedMessage[] }
export interface SyncedPost { id: string; caption: string; createdAt: string; permalink: string | null; format: 'reel' | 'story' | 'carousel' | 'photo' }

type Fetch = typeof fetch;

export class GraphCallError extends Error {
  constructor(readonly info: GraphError) { super(info.message); }
}

async function graphGet(url: string, fetchImpl: Fetch): Promise<any> {
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  const json = (await r.json().catch(() => ({}))) as any;
  if (!r.ok || json?.error) throw new GraphCallError({ status: r.status, code: json?.error?.code, message: String(json?.error?.message ?? `HTTP ${r.status}`) });
  return json;
}

/** Meta "reduce the amount of data" (code 1) and similar too-much-at-once answers. */
export function isTooMuchData(error: unknown): boolean {
  return error instanceof GraphCallError && (error.info.code === 1 || /reduce the amount of data/i.test(error.info.message));
}

/** Same URL with its limit= halved (min 1), or null when it cannot get smaller. */
export function halveLimit(url: string): string | null {
  const m = /([?&]limit=)(\d+)/.exec(url);
  if (!m) return null;
  const n = Number(m[2]);
  if (n <= 1) return null;
  return url.replace(m[0], `${m[1]}${Math.max(1, Math.floor(n / 2))}`);
}

/** GET; on Meta code 1 retries with a halved limit (up to 3 times). */
async function graphGetShrinking(url: string, fetchImpl: Fetch): Promise<any> {
  let current = url;
  for (let attempt = 0; ; attempt += 1) {
    try { return await graphGet(current, fetchImpl); }
    catch (e) {
      const smaller = isTooMuchData(e) && attempt < 3 ? halveLimit(current) : null;
      if (!smaller) throw e;
      current = smaller;
    }
  }
}

/** Follows paging.next up to maxPages (and maxRows). Keeps what it already has if a later page fails. */
async function graphPaged(url: string, fetchImpl: Fetch, maxPages = 3, stop?: (row: any) => boolean, maxRows = 100): Promise<any[]> {
  const out: any[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < maxPages && out.length < maxRows; i += 1) {
    let json: any;
    try { json = await graphGetShrinking(next, fetchImpl); }
    catch (e) { if (i > 0 && out.length) return out; throw e; }
    const rows: any[] = Array.isArray(json.data) ? json.data : [];
    for (const row of rows) { if (stop?.(row)) return out; out.push(row); if (out.length >= maxRows) return out; }
    next = typeof json.paging?.next === 'string' ? json.paging.next : undefined;
  }
  return out;
}

const PERMISSION_CODES = new Set([3, 10, 200, 230, 298]);
const BUSY_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
/** A short plain reason for the app (never raw Meta text). Permission problems name the Meta permission that is usually missing. */
export function plainGraphReason(error: unknown, neededPermission: string): string {
  if (error instanceof GraphCallError) {
    const { code, message } = error.info;
    const perm = /permission|not authorized|requires|scope|capability/i.test(message) || (code !== undefined && (PERMISSION_CODES.has(code) || (code >= 200 && code < 300)));
    if (code === 190) return 'Needs reconnect: the Meta login expired. Connect again in Accounts.';
    if (perm) return `Needs permission: ${neededPermission}`;
    if ((code !== undefined && BUSY_CODES.has(code)) || isTooMuchData(error)) return 'Meta was busy. Some items will load on the next sync.';
  }
  return 'Some items could not be loaded from Meta. They will retry on the next sync.';
}

/** Turns an older stored note that carried raw Meta text into the plain one. */
export function plainNote(note: string | null | undefined): string | null {
  if (!note) return null;
  if (/^Could not read (numbers )?from Meta/i.test(note)) return /reduce the amount of data|rate|limit|busy|temporar/i.test(note) ? 'Meta was busy. Some items will load on the next sync.' : 'Some items could not be loaded from Meta. They will retry on the next sync.';
  return note;
}

/** /{page_id}/conversations (Messenger) or ?platform=instagram, with the last messages of each. */
export async function fetchConversations(input: { graphBase: string; pageId: string; ownId: string; token: string; platform: 'facebook' | 'instagram' }, fetchImpl: Fetch = fetch): Promise<SyncedConversation[]> {
  const params = new URLSearchParams({ fields: 'participants,updated_time,messages.limit(10){id,message,from,created_time}', limit: '10', access_token: input.token });
  if (input.platform === 'instagram') params.set('platform', 'instagram');
  const rows = await graphPaged(`${input.graphBase}/${input.pageId}/conversations?${params}`, fetchImpl, 3, undefined, 25);
  return rows.map((row) => toConversation(row, input.ownId, input.pageId)).filter((c): c is SyncedConversation => c !== null);
}

/** Contact profile photo: GET /{IGSID|PSID}?fields=profile_pic with the page token. Null when Meta does not share it. */
export async function fetchProfilePic(input: { graphBase: string; userId: string; token: string }, fetchImpl: Fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchImpl(`${input.graphBase}/${encodeURIComponent(input.userId)}?${new URLSearchParams({ fields: 'profile_pic', access_token: input.token })}`);
    if (!r.ok) return null;
    const j = (await r.json()) as any;
    return typeof j?.profile_pic === 'string' && /^https:\/\//.test(j.profile_pic) ? j.profile_pic : null;
  } catch { return null; }
}

export function toConversation(row: any, ownId: string, pageId: string): SyncedConversation | null {
  const own = new Set([ownId, pageId].filter(Boolean));
  const people: any[] = row?.participants?.data ?? [];
  const contact = people.find((p) => p?.id && !own.has(String(p.id)));
  if (!contact) return null;
  const messages: SyncedMessage[] = (row?.messages?.data ?? [])
    .filter((m: any) => m?.id && m?.created_time)
    .map((m: any) => ({
      id: String(m.id), fromId: String(m.from?.id ?? ''), fromName: m.from?.name ?? m.from?.username ?? null,
      body: (typeof m.message === 'string' && m.message.trim() ? m.message : '[Attachment]').slice(0, 5000),
      createdAt: new Date(m.created_time).toISOString()
    }))
    .sort((a: SyncedMessage, b: SyncedMessage) => a.createdAt.localeCompare(b.createdAt));
  return { contactId: String(contact.id), contactName: contact.name ?? contact.username ?? null, messages };
}

/** Last N days of Facebook Page posts. */
export async function fetchFacebookPosts(input: { graphBase: string; pageId: string; token: string; days: number }, fetchImpl: Fetch = fetch, now = Date.now()): Promise<SyncedPost[]> {
  const since = Math.floor((now - input.days * 86400000) / 1000);
  const params = new URLSearchParams({ fields: 'id,message,created_time,permalink_url', since: String(since), limit: '25', access_token: input.token });
  const rows = await graphPaged(`${input.graphBase}/${input.pageId}/published_posts?${params}`, fetchImpl, 4);
  return rows.filter((p) => p?.id && p?.created_time).map((p) => ({ id: String(p.id), caption: String(p.message ?? ''), createdAt: new Date(p.created_time).toISOString(), permalink: p.permalink_url ?? null, format: 'photo' as const }));
}

/** Last N days of Instagram media (newest first, stops at the cutoff). */
export async function fetchInstagramPosts(input: { graphBase: string; igUserId: string; token: string; days: number }, fetchImpl: Fetch = fetch, now = Date.now()): Promise<SyncedPost[]> {
  const cutoff = now - input.days * 86400000;
  const params = new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: '25', access_token: input.token });
  const rows = await graphPaged(`${input.graphBase}/${input.igUserId}/media?${params}`, fetchImpl, 4, (m) => Date.parse(m?.timestamp) < cutoff);
  return rows.filter((m) => m?.id && m?.timestamp).map((m) => ({
    id: String(m.id), caption: String(m.caption ?? ''), createdAt: new Date(m.timestamp).toISOString(), permalink: m.permalink ?? null,
    format: m.media_product_type === 'REELS' || m.media_type === 'VIDEO' ? 'reel' as const : m.media_product_type === 'STORY' ? 'story' as const : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' as const : 'photo' as const
  }));
}

/** Short title for an imported post: first line of the caption. */
export function postTitle(caption: string, platform: string, createdAt: string): string {
  const first = caption.split('\n').map((s) => s.trim()).find(Boolean);
  if (first) return first.length > 80 ? `${first.slice(0, 77)}...` : first;
  return `${platform === 'instagram' ? 'Instagram' : 'Facebook'} post ${createdAt.slice(0, 10)}`;
}
