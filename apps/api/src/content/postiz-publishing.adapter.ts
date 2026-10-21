import type { PublishContentInput, PublishContentResult, SocialPublishingAdapter } from './publishing-adapter';

/** Postiz public API. Docs: https://docs.postiz.com/public-api
 * Self-hosted: set POSTIZ_API_URL to https://<host>/api/public/v1. */
const CLOUD = 'https://api.postiz.com/public/v1';
export function postizBase(env: NodeJS.ProcessEnv = process.env) { return (env.POSTIZ_API_URL?.trim() || CLOUD).replace(/\/+$/, ''); }
/** Instagram and Facebook publish through AngelOS's own Meta connection; Postiz only carries Threads and TikTok. */
export const POSTIZ_PLATFORMS = ['tiktok', 'threads'];
export const META_PLATFORMS = ['instagram', 'facebook'];
export type PublishRoute = 'meta' | 'postiz' | 'line' | 'manual';
export function publishRoute(platform: string): PublishRoute {
  const p = String(platform).replace(/^instagram_.*/, 'instagram');
  if (META_PLATFORMS.includes(p)) return 'meta';
  if (POSTIZ_PLATFORMS.includes(p)) return 'postiz';
  if (p === 'line') return 'line';
  return 'manual';
}

export interface ScheduleResult { ok: boolean; providerPostId?: string; error?: string; code?: 'not_configured' | 'no_channel' | 'auth' | 'provider'; raw?: unknown }

type Integration = { id: string; identifier: string; disabled?: boolean };

const TYPE: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  threads: 'threads'
};

export function postizReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.POSTIZ_API_KEY?.trim());
}

export class PostizPublishingAdapter implements SocialPublishingAdapter {
  constructor(private readonly key = process.env.POSTIZ_API_KEY?.trim() ?? '', private readonly fetchImpl: typeof fetch = fetch, private readonly base = postizBase()) {}

  private async call(path: string, init: RequestInit = {}) {
    const r = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: { Authorization: this.key, ...(init.headers ?? {}) }
    });
    const json = await r.json().catch(() => ({})) as any;
    return { ok: r.ok, status: r.status, json };
  }

  private async integrationFor(platform: string): Promise<Integration | null> {
    const want = TYPE[platform];
    if (!want) return null;
    const r = await this.call('/integrations');
    if (!r.ok || !Array.isArray(r.json)) return null;
    const rows = r.json as Integration[];
    return rows.find((x) => x.identifier === want && !x.disabled)
      ?? rows.find((x) => x.identifier === `${want}-standalone` && !x.disabled)
      ?? null;
  }

  private body(type: 'now' | 'schedule', date: string, integration: Integration, platform: string, input: PublishContentInput) {
    const caption = [input.hook, input.caption, input.cta, (input.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n').slice(0, 2200);
    const image = input.imageUrl ? [{ path: input.imageUrl }] : [];
    const settings: Record<string, unknown> = { __type: integration.identifier };
    if (platform === 'instagram') settings.post_type = input.format === 'story' ? 'story' : 'post';
    if (platform === 'tiktok') Object.assign(settings, { privacy_level: 'PUBLIC_TO_EVERYONE', duet: false, stitch: false, comment: true, autoAddMusic: 'no', brand_content_toggle: false, brand_organic_toggle: false, content_posting_method: 'DIRECT_POST' });
    return { type, date, shortLink: false, tags: [], posts: [{ integration: { id: integration.id }, value: [{ content: caption, image }], settings }] };
  }

  /** Schedule at `date` (ISO). Called only after Angel taps Approve. */
  async schedule(input: PublishContentInput & { scheduledFor: string }): Promise<ScheduleResult> {
    if (!this.key) return { ok: false, code: 'not_configured', error: 'Auto-posting is not connected yet.' };
    const platform = input.platform.replace(/^instagram_.*/, 'instagram');
    const list = await this.call('/integrations');
    if (list.status === 401) return { ok: false, code: 'auth', error: 'The posting service login has expired.' };
    const integration = await this.integrationFor(platform);
    if (!integration) return { ok: false, code: 'no_channel', error: `No connected ${platform} account yet.` };
    const r = await this.call('/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.body('schedule', input.scheduledFor, integration, platform, input)) });
    if (!r.ok) return { ok: false, code: r.status === 401 ? 'auth' : 'provider', error: `Scheduling failed (${r.status})`, raw: r.json };
    const first = Array.isArray(r.json) ? r.json[0] : r.json;
    const id = String(first?.postId ?? first?.id ?? '');
    return id ? { ok: true, providerPostId: id, raw: { integration: integration.id } } : { ok: false, code: 'provider', error: 'Scheduling returned no post id', raw: r.json };
  }

  /** Delete a scheduled post (and its group). 404 = already gone. */
  async cancel(providerPostId: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.key) return { ok: false, error: 'Auto-posting is not connected yet.' };
    const r = await this.call(`/posts/${encodeURIComponent(providerPostId)}`, { method: 'DELETE' });
    if (r.ok || r.status === 404) return { ok: true };
    return { ok: false, error: `Cancel failed (${r.status})` };
  }

  /** Is the key valid, and which channels are connected? */
  async status(): Promise<{ configured: boolean; keyValid: boolean; channels: string[] }> {
    if (!this.key) return { configured: false, keyValid: false, channels: [] };
    const r = await this.call('/integrations');
    if (!r.ok) return { configured: true, keyValid: false, channels: [] };
    return { configured: true, keyValid: true, channels: (r.json as Integration[]).filter((x) => !x.disabled).map((x) => x.identifier) };
  }

  async publish(input: PublishContentInput): Promise<PublishContentResult> {
    if (!this.key) return { status: 'failed', error: "Auto-posting isn't connected yet." };
    const platform = input.platform.replace(/^instagram_.*/, 'instagram');
    const integration = await this.integrationFor(platform);
    if (!integration) return { status: 'failed', error: `${platform.charAt(0).toUpperCase() + platform.slice(1)} isn't connected yet.` };

    const body = this.body('now', new Date().toISOString(), integration, platform, input);
    const r = await this.call('/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return { status: 'failed', error: `It didn't post (error ${r.status}). Tap Try again.`, raw: r.json };
    const first = Array.isArray(r.json) ? r.json[0] : r.json;
    return { status: 'published', providerPostId: String(first?.postId ?? first?.id ?? ''), raw: { transport: 'postiz', integration: integration.id } };
  }
}
