import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createServiceSupabaseClient } from '../config/supabase';
import { isMarketingEligible } from '../content/content.service';
import { PostizPublishingAdapter, postizReady } from '../content/postiz-publishing.adapter';
import { MetaPublishingAdapter, metaPublishingReady } from '../meta/meta-publishing.adapter';
import { SocialAccountsService } from './social-accounts.service';

type Outcome = { status: 'published' | 'failed'; reason?: string; providerPostId?: string; liveUrl?: string; raw?: Record<string, unknown> };
const NAMES: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok' };

/** Plain-English failure reason shown under a Failed post. */
export function notConnectedReason(platform: string): string {
  if (platform === 'line') return 'LINE isn\'t connected. Connect LINE in Social › Accounts, then tap Try again.';
  if (platform === 'instagram' || platform === 'facebook') return `${NAMES[platform]} isn't connected yet, so AngelOS didn't post. Post it by hand and tap Mark as posted, or connect ${NAMES[platform]} and tap Try again.`;
  if (platform === 'tiktok') return 'TikTok posts automatically once Postiz is connected. Set the Postiz key, then tap Try again.';
  return `AngelOS can't post to ${NAMES[platform] ?? platform} automatically. Post it by hand and tap Mark as posted.`;
}

/** Rolls the post status up from its platform versions. */
export function rollupStatus(statuses: string[]): string {
  const live = statuses.filter((s) => s !== 'archived');
  if (live.length && live.every((s) => s === 'published')) return 'published';
  if (live.some((s) => s === 'scheduled' || s === 'publishing')) return 'scheduled';
  if (live.some((s) => s === 'failed')) return 'failed';
  return 'approved';
}

/**
 * Auto-publish: every 5 minutes, posts whose time has come go out.
 * Instagram, Facebook and TikTok go through Postiz when POSTIZ_API_KEY is set.
 * The direct Meta path is skipped for those platforms so nothing posts twice.
 * LINE still uses its own adapter. Off in tests, or with SOCIAL_AUTOPUBLISH_CRON=off.
 */
@Injectable()
export class SocialPublisherService {
  private readonly logger = new Logger(SocialPublisherService.name);
  private running = false;
  constructor(private readonly accounts: SocialAccountsService) {}

  @Cron('0 */5 * * * *', { name: 'social-publish-due', disabled: process.env.NODE_ENV === 'test' || process.env.SOCIAL_AUTOPUBLISH_CRON === 'off' })
  async publishDue(now = new Date()) {
    if (this.running) return { processed: 0 };
    this.running = true;
    try {
      const service = createServiceSupabaseClient();
      const { data, error } = await service.from('content_variants').select('*,post:content_posts(id,status,workspace_id)')
        .eq('status', 'scheduled').lte('scheduled_for', now.toISOString()).order('scheduled_for').limit(25);
      if (error) { this.logger.warn(`due posts query failed: ${error.message}`); return { processed: 0 }; }
      let processed = 0;
      for (const variant of data ?? []) {
        if (!['scheduled', 'approved'].includes((variant as any).post?.status)) continue;
        const { data: claimed } = await service.from('content_variants').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', variant.id).eq('status', 'scheduled').select('id');
        if (!claimed?.length) continue;
        try { await this.publishOne(variant); } catch (e) { await this.finish(variant, { status: 'failed', reason: e instanceof Error ? e.message : 'Publishing stopped unexpectedly.' }); }
        processed += 1;
      }
      return { processed };
    } finally { this.running = false; }
  }

  private async publishOne(variant: any) {
    const service = createServiceSupabaseClient();
    const ws = variant.workspace_id as string;
    const key = `content:${variant.id}`;
    const { data: previous } = await service.from('content_publish_attempts').select('status,attempt_no').eq('workspace_id', ws).eq('idempotency_key', key).maybeSingle();
    if (previous?.status === 'published') return this.finish(variant, { status: 'published' }, true);
    const attemptNo = Number(previous?.attempt_no ?? 0) + 1;
    await service.from('content_publish_attempts').upsert({ workspace_id: ws, content_variant_id: variant.id, idempotency_key: key, attempt_no: attemptNo, status: 'publishing', error_message: null }, { onConflict: 'workspace_id,idempotency_key' });

    const platform = String(variant.platform).replace(/^instagram_.*/, 'instagram');
    if (platform === 'line') {
      const { adapter } = await this.accounts.lineAdapterFor(ws);
      if (!adapter) return this.finish(variant, { status: 'failed', reason: notConnectedReason('line') });
      const text = [variant.caption, (variant.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n');
      const r = await adapter.broadcast(text, key);
      return this.finish(variant, r.status === 'sent' ? { status: 'published', providerPostId: r.externalMessageId, raw: r.raw } : { status: 'failed', reason: r.error ?? 'LINE broadcast failed. Nothing was sent.', raw: r.raw });
    }
    if (platform === 'instagram' || platform === 'facebook' || platform === 'tiktok') {
      // Postiz replaces direct Meta. When the key is set, Meta is not called for these platforms.
      if (postizReady()) {
        const { data: media } = await service.from('content_post_media').select('position,asset:media_assets(*)').eq('content_post_id', variant.content_post_id).order('position');
        const assets = (media ?? []).map((m: any) => m.asset).filter(Boolean);
        if (assets.some((a: any) => !isMarketingEligible(a))) return this.finish(variant, { status: 'failed', reason: 'Stopped: a photo no longer has marketing permission.' });
        const photo = assets.find((a: any) => a.media_type === 'image' && a.storage_path);
        const imageUrl = photo ? (await service.storage.from(photo.storage_bucket ?? 'media').createSignedUrl(photo.storage_path, 3600)).data?.signedUrl : undefined;
        const r = await new PostizPublishingAdapter().publish({ platform, format: variant.format, caption: variant.caption, hook: variant.hook, cta: variant.cta, hashtags: variant.hashtags ?? [], scheduledFor: variant.scheduled_for, idempotencyKey: key, imageUrl });
        return this.finish(variant, r.status === 'published' ? { status: 'published', providerPostId: r.providerPostId, liveUrl: r.liveUrl, raw: r.raw } : { status: 'failed', reason: r.error ?? 'Postiz failed.', raw: r.raw });
      }
      // Fallback only when Postiz is not configured. TikTok has no Meta path.
      if (platform === 'tiktok') return this.finish(variant, { status: 'failed', reason: notConnectedReason('tiktok') });
      const cfg = await this.accounts.metaConfigFor(ws);
      if (!metaPublishingReady(platform, cfg)) return this.finish(variant, { status: 'failed', reason: notConnectedReason(platform) });
      const { data: media } = await service.from('content_post_media').select('position,asset:media_assets(*)').eq('content_post_id', variant.content_post_id).order('position');
      const assets = (media ?? []).map((m: any) => m.asset).filter(Boolean);
      if (assets.some((a: any) => !isMarketingEligible(a))) return this.finish(variant, { status: 'failed', reason: 'Stopped: a photo no longer has marketing permission.' });
      const photo = assets.find((a: any) => a.media_type === 'image' && a.storage_path);
      const imageUrl = photo ? (await service.storage.from(photo.storage_bucket ?? 'media').createSignedUrl(photo.storage_path, 3600)).data?.signedUrl : undefined;
      const r = await new MetaPublishingAdapter(cfg).publish({ platform, format: variant.format, caption: variant.caption, hook: variant.hook, cta: variant.cta, hashtags: variant.hashtags ?? [], scheduledFor: variant.scheduled_for, idempotencyKey: key, imageUrl });
      return this.finish(variant, r.status === 'published' ? { status: 'published', providerPostId: r.providerPostId, liveUrl: r.liveUrl, raw: r.raw } : { status: 'failed', reason: r.status === 'unknown' ? `${NAMES[platform]} didn't confirm the post. Check the app before trying again.` : r.error ?? 'Publishing failed.', raw: r.raw });
    }
    return this.finish(variant, { status: 'failed', reason: notConnectedReason(platform) });
  }

  private async finish(variant: any, o: Outcome, already = false) {
    const service = createServiceSupabaseClient();
    const ws = variant.workspace_id as string;
    const now = new Date().toISOString();
    if (!already) {
      await service.from('content_publish_attempts').update(o.status === 'published'
        ? { status: 'published', provider_response: o.raw ?? null, error_message: null, verification: { verified: true, transport: `auto-${variant.platform}`, providerPostId: o.providerPostId ?? null, verifiedAt: now } }
        : { status: 'failed', provider_response: o.raw ?? null, error_message: (o.reason ?? 'Failed').slice(0, 500) }).eq('workspace_id', ws).eq('idempotency_key', `content:${variant.id}`);
    }
    await service.from('content_variants').update(o.status === 'published'
      ? { status: 'published', provider_post_id: o.providerPostId ?? variant.provider_post_id ?? null, live_url: o.liveUrl ?? variant.live_url ?? null, published_at: now, updated_at: now }
      : { status: 'failed', updated_at: now }).eq('id', variant.id);
    const { data: siblings } = await service.from('content_variants').select('status').eq('content_post_id', variant.content_post_id);
    await service.from('content_posts').update({ status: rollupStatus((siblings ?? []).map((s: any) => s.status)), updated_at: now }).eq('id', variant.content_post_id);
    if (o.status === 'failed') this.logger.log(`post ${variant.id} (${variant.platform}) failed: ${o.reason}`);
  }
}
