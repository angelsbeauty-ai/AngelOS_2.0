import type { PublishContentInput, PublishContentResult, SocialPublishingAdapter } from '../content/publishing-adapter';
import { readMetaConfig, type MetaConfig } from './meta.config';

export function metaPublishingReady(platform: string, c: MetaConfig = readMetaConfig()): boolean {
  if (!c.publishingEnabled || !c.pageToken) return false;
  if (platform === 'instagram') return Boolean(c.igUserId);
  if (platform === 'facebook') return Boolean(c.pageId);
  return false;
}

export function buildCaption(input: PublishContentInput): string {
  return [input.hook, input.caption, input.cta, (input.hashtags ?? []).join(' ')].filter((x) => x && String(x).trim()).join('\n\n').slice(0, 2200);
}

/**
 * Instagram: POST /{ig-user}/media (image_url, caption) → container id → POST /{ig-user}/media_publish.
 * Facebook Page: POST /{page}/photos (url, caption) or /{page}/feed (message) for text-only.
 * Scheduling stays in AngelOS's own scheduler: this is only called at publish time.
 */
export class MetaPublishingAdapter implements SocialPublishingAdapter {
  constructor(private readonly c: MetaConfig = readMetaConfig(), private readonly fetchImpl: typeof fetch = fetch) {}

  private async post(path: string, params: Record<string, string>) {
    const body = new URLSearchParams({ ...params, access_token: this.c.pageToken ?? '' });
    const r = await this.fetchImpl(`${this.c.graphBase}/${path}`, { method: 'POST', body });
    const json = (await r.json().catch(() => ({}))) as any;
    return { ok: r.ok && !json?.error, status: r.status, json };
  }

  async publish(input: PublishContentInput): Promise<PublishContentResult> {
    if (!metaPublishingReady(input.platform, this.c)) return { status: 'failed', error: `${input.platform} publishing is not connected.` };
    const caption = buildCaption(input);
    if (input.platform === 'instagram') {
      if (!input.imageUrl) return { status: 'failed', error: 'Instagram needs a photo.' };
      const box = await this.post(`${this.c.igUserId}/media`, { image_url: input.imageUrl, caption });
      if (!box.ok || !box.json.id) return { status: 'failed', error: `Instagram container failed (${box.status})`, raw: { step: 'container', error: box.json?.error?.message } };
      const pub = await this.post(`${this.c.igUserId}/media_publish`, { creation_id: String(box.json.id) });
      if (!pub.ok || !pub.json.id) return { status: 'unknown', error: `Instagram publish not confirmed (${pub.status})`, raw: { step: 'publish', containerId: box.json.id, error: pub.json?.error?.message } };
      return { status: 'published', providerPostId: String(pub.json.id), raw: { transport: 'meta-ig', containerId: box.json.id } };
    }
    const res = input.imageUrl
      ? await this.post(`${this.c.pageId}/photos`, { url: input.imageUrl, caption })
      : await this.post(`${this.c.pageId}/feed`, { message: caption });
    if (!res.ok || !(res.json.post_id || res.json.id)) return { status: 'failed', error: `Facebook post failed (${res.status})`, raw: { error: res.json?.error?.message } };
    const id = String(res.json.post_id ?? res.json.id);
    return { status: 'published', providerPostId: id, liveUrl: `https://www.facebook.com/${id}`, raw: { transport: 'meta-fb' } };
  }
}
