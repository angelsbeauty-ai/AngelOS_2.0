import type { MetaConfig } from '../meta/meta.config';

export interface AccountNumbers { followers: number | null; engagement: number | null; posts: number | null; name?: string | null; pictureUrl?: string | null; error?: string | null }

/** Reads need only the studio's own page token (no META_PUBLISHING_ENABLED). Posting stays gated by metaPublishingReady. */
export function metaReadReady(platform: string, c: MetaConfig): boolean {
  if (!c.pageToken) return false;
  if (platform === 'instagram') return Boolean(c.igUserId);
  if (platform === 'facebook') return Boolean(c.pageId);
  return false;
}

/** Followers + likes/comments on the last 10 posts. Never throws; unknown stays null (never a fake 0). */
export async function metaNumbers(platform: 'instagram' | 'facebook', c: MetaConfig, fetchImpl: typeof fetch = fetch): Promise<AccountNumbers> {
  const out: AccountNumbers = { followers: null, engagement: null, posts: null, name: null, pictureUrl: null, error: null };
  const get = async (path: string) => {
    const r = await fetchImpl(`${c.graphBase}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(c.pageToken ?? '')}`);
    const json = (await r.json().catch(() => ({}))) as any;
    if (r.ok && !json?.error) return json;
    if (!out.error) out.error = json?.error?.code === 1 || /reduce the amount/i.test(String(json?.error?.message ?? '')) ? 'Meta was busy.' : 'Meta did not answer.';
    return null;
  };
  try {
    if (platform === 'instagram' && c.igUserId) {
      const me = await get(`${c.igUserId}?fields=followers_count,media_count,username,profile_picture_url`);
      if (me) { out.followers = me.followers_count == null ? null : Number(me.followers_count); out.name = me.username ?? null; out.pictureUrl = me.profile_picture_url ?? null; out.posts = me.media_count == null ? null : Number(me.media_count); }
      const media = await get(`${c.igUserId}/media?fields=like_count,comments_count&limit=5`);
      if (media?.data) out.engagement = media.data.reduce((n: number, m: any) => n + Number(m.like_count ?? 0) + Number(m.comments_count ?? 0), 0);
    }
    if (platform === 'facebook' && c.pageId) {
      const page = await get(`${c.pageId}?fields=followers_count,fan_count,name,picture{url}`);
      if (page) { const f = page.followers_count ?? page.fan_count; out.followers = f == null ? null : Number(f); out.name = page.name ?? null; out.pictureUrl = page.picture?.data?.url ?? null; }
      const posts = await get(`${c.pageId}/posts?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&limit=10`);
      if (posts?.data) out.engagement = posts.data.reduce((n: number, p: any) => n + Number(p.reactions?.summary?.total_count ?? 0) + Number(p.comments?.summary?.total_count ?? 0), 0);
      // Facebook has no media_count: count published posts (summary total when Meta gives it).
      const count = await get(`${c.pageId}/published_posts?limit=1&summary=total_count`);
      if (count?.summary?.total_count != null) out.posts = Number(count.summary.total_count);
    }
  } catch { out.error = out.error ?? 'Meta did not answer.'; }
  return out;
}
