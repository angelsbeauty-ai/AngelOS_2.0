import { readMetaConfig, type MetaConfig } from './meta.config';

export const META_OAUTH_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights', 'business_management', 'pages_messaging', 'pages_manage_metadata', 'instagram_manage_messages'];

export interface MetaOAuthConfig { appId: string; appSecret: string; redirectUri: string; tokenKey: string; stateSecret: string; returnUrl?: string; dialogBase: string; graphBase: string }

/** Connect is ON only when META_OAUTH_ENABLED=true AND app id/secret, redirect URI and META_TOKEN_KEY exist. Publishing stays behind META_PUBLISHING_ENABLED. */
export function readMetaOAuthConfig(env: NodeJS.ProcessEnv = process.env, c: MetaConfig = readMetaConfig(env)): MetaOAuthConfig | null {
  const appId = env.META_APP_ID?.trim(); const redirectUri = env.META_OAUTH_REDIRECT_URI?.trim(); const tokenKey = env.META_TOKEN_KEY?.trim();
  if (String(env.META_OAUTH_ENABLED ?? '').trim().toLowerCase() !== 'true' || !appId || !c.appSecret || !redirectUri || !tokenKey || tokenKey.length < 32) return null;
  const version = env.META_GRAPH_VERSION?.trim() || 'v23.0';
  return { appId, appSecret: c.appSecret, redirectUri, tokenKey, stateSecret: `${c.appSecret}:${tokenKey}`, returnUrl: env.META_OAUTH_RETURN_URL?.trim() || undefined, dialogBase: `https://www.facebook.com/${version}/dialog/oauth`, graphBase: c.graphBase };
}

export function buildMetaLoginUrl(o: MetaOAuthConfig, state: string): string {
  const q = new URLSearchParams({ client_id: o.appId, redirect_uri: o.redirectUri, state, response_type: 'code', scope: META_OAUTH_SCOPES.join(',') });
  return `${o.dialogBase}?${q.toString()}`;
}

type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
async function graph(f: Fetch, url: string) {
  const r = await f(url); const body = await r.json().catch(() => ({}));
  if (!r.ok || body?.error) throw new Error(`Meta Graph error ${r.status}: ${body?.error?.message ?? 'unknown'}`);
  return body;
}

export interface MetaPage { pageId: string; pageName: string | null; pageToken: string; pictureUrl: string | null; igUserId: string | null; igUsername: string | null; igPictureUrl: string | null }
export interface MetaExchangeResult { userToken: string; expiresAt: string | null; pages: MetaPage[] }

/** code -> short-lived user token -> long-lived user token (~60d) -> Pages (+ linked IG business account). Page tokens from a long-lived user token do not expire. */
export async function exchangeCodeAndListPages(o: MetaOAuthConfig, code: string, f: Fetch = fetch as any, now = Date.now()): Promise<MetaExchangeResult> {
  const short = await graph(f, `${o.graphBase}/oauth/access_token?${new URLSearchParams({ client_id: o.appId, client_secret: o.appSecret, redirect_uri: o.redirectUri, code })}`);
  const long = await graph(f, `${o.graphBase}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: o.appId, client_secret: o.appSecret, fb_exchange_token: short.access_token })}`);
  const userToken: string = long.access_token;
  const expiresAt = Number(long.expires_in) > 0 ? new Date(now + Number(long.expires_in) * 1000).toISOString() : null;
  const fields = 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}';
  const list = await graph(f, `${o.graphBase}/me/accounts?${new URLSearchParams({ fields, limit: '100', access_token: userToken })}`);
  const pages: MetaPage[] = (Array.isArray(list?.data) ? list.data : []).filter((p: any) => p?.id && p?.access_token).map((p: any) => ({
    pageId: String(p.id), pageName: p.name ?? null, pageToken: String(p.access_token), pictureUrl: p.picture?.data?.url ?? null,
    igUserId: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : null,
    igUsername: p.instagram_business_account?.username ?? null, igPictureUrl: p.instagram_business_account?.profile_picture_url ?? null
  }));
  return { userToken, expiresAt, pages };
}

/** Prefer a Page that has a linked Instagram business account. */
export function pickPage(pages: MetaPage[]): MetaPage | null { return pages.find((p) => p.igUserId) ?? pages[0] ?? null; }

/** Messaging needs both of these; without them the inbox stays empty. */
export const META_MESSAGING_SCOPES = ['pages_messaging', 'instagram_manage_messages'];

/** What the person really granted (GET /me/permissions), not what we asked for. null when Meta did not answer. */
export async function fetchGrantedScopes(o: Pick<MetaOAuthConfig, 'graphBase'>, userToken: string, f: Fetch = fetch as any): Promise<string[] | null> {
  try {
    const body = await graph(f, `${o.graphBase}/me/permissions?${new URLSearchParams({ access_token: userToken })}`);
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    return rows.filter((r) => r?.permission && r.status === 'granted').map((r) => String(r.permission));
  } catch { return null; }
}

/** Messaging scopes missing from a granted list. Unknown list (null) = nothing proven missing. */
export function missingMessagingScopes(granted: string[] | null | undefined): string[] {
  if (!granted) return [];
  return META_MESSAGING_SCOPES.filter((s) => !granted.includes(s));
}
