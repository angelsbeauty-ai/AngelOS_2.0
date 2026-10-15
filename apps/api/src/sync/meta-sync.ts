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

/** Follows paging.next up to maxPages. */
async function graphPaged(url: string, fetchImpl: Fetch, maxPages = 3, stop?: (row: any) => boolean): Promise<any[]> {
  const out: any[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < maxPages; i += 1) {
    const json = await graphGet(next, fetchImpl);
    const rows: any[] = Array.isArray(json.data) ? json.data : [];
    for (const row of rows) { if (stop?.(row)) return out; out.push(row); }
    next = typeof json.paging?.next === 'string' ? json.paging.next : undefined;
  }
  return out;
}

const PERMISSION_CODES = new Set([3, 10, 200, 230, 298]);
/** A plain reason for the app. Permission problems name the Meta permission that is usually missing. */
export function plainGraphReason(error: unknown, neededPermission: string): string {
  if (error instanceof GraphCallError) {
    const { code, message } = error.info;
    const perm = /permission|not authorized|requires|scope|capability/i.test(message) || (code !== undefined && (PERMISSION_CODES.has(code) || (code >= 200 && code < 300)));
    if (code === 190) return 'Needs reconnect: the Meta login expired. Connect again in Accounts.';
    if (perm) return `Needs permission: ${neededPermission}`;
    return `Could not read from Meta: ${message.slice(0, 160)}`;
  }
  return `Could not read from Meta: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}`;
}

/** /{page_id}/conversations (Messenger) or ?platform=instagram, with the last messages of each. */
export async function fetchConversations(input: { graphBase: string; pageId: string; ownId: string; token: string; platform: 'facebook' | 'instagram' }, fetchImpl: Fetch = fetch): Promise<SyncedConversation[]> {
  const params = new URLSearchParams({ fields: 'participants,updated_time,messages.limit(25){id,message,from,created_time}', limit: '25', access_token: input.token });
  if (input.platform === 'instagram') params.set('platform', 'instagram');
  const rows = await graphPaged(`${input.graphBase}/${input.pageId}/conversations?${params}`, fetchImpl, 2);
  return rows.map((row) => toConversation(row, input.ownId, input.pageId)).filter((c): c is SyncedConversation => c !== null);
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
  const params = new URLSearchParams({ fields: 'id,message,created_time,permalink_url', since: String(since), limit: '100', access_token: input.token });
  const rows = await graphPaged(`${input.graphBase}/${input.pageId}/published_posts?${params}`, fetchImpl, 3);
  return rows.filter((p) => p?.id && p?.created_time).map((p) => ({ id: String(p.id), caption: String(p.message ?? ''), createdAt: new Date(p.created_time).toISOString(), permalink: p.permalink_url ?? null, format: 'photo' as const }));
}

/** Last N days of Instagram media (newest first, stops at the cutoff). */
export async function fetchInstagramPosts(input: { graphBase: string; igUserId: string; token: string; days: number }, fetchImpl: Fetch = fetch, now = Date.now()): Promise<SyncedPost[]> {
  const cutoff = now - input.days * 86400000;
  const params = new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: '50', access_token: input.token });
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
