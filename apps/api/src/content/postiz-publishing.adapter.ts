import type { PublishContentInput, PublishContentResult, SocialPublishingAdapter } from './publishing-adapter';

/** Postiz public API. Docs: https://docs.postiz.com/public-api */
const BASE = 'https://api.postiz.com/public/v1';

type Integration = { id: string; identifier: string; disabled?: boolean };

const TYPE: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok'
};

export function postizReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.POSTIZ_API_KEY?.trim());
}

export class PostizPublishingAdapter implements SocialPublishingAdapter {
  constructor(private readonly key = process.env.POSTIZ_API_KEY?.trim() ?? '', private readonly fetchImpl: typeof fetch = fetch) {}

  private async call(path: string, init: RequestInit = {}) {
    const r = await this.fetchImpl(`${BASE}${path}`, {
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

  async publish(input: PublishContentInput): Promise<PublishContentResult> {
    if (!this.key) return { status: 'failed', error: 'Postiz key is not set.' };
    const platform = input.platform.replace(/^instagram_.*/, 'instagram');
    const integration = await this.integrationFor(platform);
    if (!integration) return { status: 'failed', error: `Postiz has no connected ${platform} account.` };

    const caption = [input.hook, input.caption, input.cta, (input.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n').slice(0, 2200);
    const image = input.imageUrl ? [{ path: input.imageUrl }] : [];
    const body = {
      type: 'now',
      date: new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [{
        integration: { id: integration.id },
        value: [{ content: caption, image }],
        settings: { __type: integration.identifier, ...(platform === 'instagram' ? { post_type: 'post' } : {}) }
      }]
    };
    const r = await this.call('/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return { status: 'failed', error: `Postiz failed (${r.status})`, raw: r.json };
    const first = Array.isArray(r.json) ? r.json[0] : r.json;
    return { status: 'published', providerPostId: String(first?.postId ?? first?.id ?? ''), raw: { transport: 'postiz', integration: integration.id } };
  }
}
