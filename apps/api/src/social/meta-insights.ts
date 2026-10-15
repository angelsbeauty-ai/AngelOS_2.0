import type { MetaConfig } from '../meta/meta.config';

export interface AccountNumbers { followers: number | null; engagement: number | null; posts: number | null }

/** Followers + likes/comments on the last 10 posts. Never throws; unknown stays null (never a fake 0). */
export async function metaNumbers(platform: 'instagram' | 'facebook', c: MetaConfig, fetchImpl: typeof fetch = fetch): Promise<AccountNumbers> {
  const out: AccountNumbers = { followers: null, engagement: null, posts: null };
  const get = async (path: string) => {
    const r = await fetchImpl(`${c.graphBase}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(c.pageToken ?? '')}`);
    const json = (await r.json().catch(() => ({}))) as any;
    return r.ok && !json?.error ? json : null;
  };
  try {
    if (platform === 'instagram' && c.igUserId) {
      const me = await get(`${c.igUserId}?fields=followers_count,media_count`);
      if (me) { out.followers = Number(me.followers_count ?? 0); out.posts = me.media_count == null ? null : Number(me.media_count); }
      const media = await get(`${c.igUserId}/media?fields=like_count,comments_count&limit=10`);
      if (media?.data) out.engagement = media.data.reduce((n: number, m: any) => n + Number(m.like_count ?? 0) + Number(m.comments_count ?? 0), 0);
    }
    if (platform === 'facebook' && c.pageId) {
      const page = await get(`${c.pageId}?fields=followers_count,fan_count`);
      if (page) out.followers = Number(page.followers_count ?? page.fan_count ?? 0);
      const posts = await get(`${c.pageId}/posts?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&limit=10`);
      if (posts?.data) out.engagement = posts.data.reduce((n: number, p: any) => n + Number(p.reactions?.summary?.total_count ?? 0) + Number(p.comments?.summary?.total_count ?? 0), 0);
    }
  } catch { /* stays unknown */ }
  return out;
}
