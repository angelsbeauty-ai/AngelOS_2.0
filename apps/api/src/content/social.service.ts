import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AiProviderService } from '../ai/ai-provider.service';
import { eveningSlot, localDate } from '../ai/suggestions/suggestion-rules';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { LineMessagingAdapter, readLineConfig } from '../messaging/line-messaging.adapter';
import { buildTranslateInstructions } from '../messaging/reply-prompt';
import { isMissingRelation } from '../messaging/saved-replies.service';
import { ContentService } from './content.service';
import type { CreateCampaignDto, HashtagSetDto, LineDraftDto, MarkPostedDto, PlanDaysDto } from './dto/social.dto';
import { addDaysLocal, dataIdeas, daysBetween, lineEstimateText, parseCaptionList, planCampaign, planPosts, seasonalIdeas, starterCaption, type PlannedPost } from './social-plan';

const MIGRATION = '0019_v1_social_campaigns';
const needsDb = () => new ConflictException(`This needs the database update ${MIGRATION} (waiting for Angel's yes). Nothing was changed.`);
const SOCIAL_SOURCES = ['instagram', 'facebook', 'line', 'tiktok'];

/**
 * B0 social extras: campaigns, 30-day plan, ideas, hashtag sets, "Mark as posted",
 * LINE broadcast drafts (estimate first, send only after Approve + LINE connected), Social insights.
 * Everything AngelOS writes here is a DRAFT. Nothing is posted by itself.
 */
@Injectable()
export class SocialService {
  constructor(private readonly content: ContentService, private readonly provider: AiProviderService) {}

  private db(user: AuthUser) { return createUserSupabaseClient(user.accessToken); }

  private async workspace(user: AuthUser, workspaceId: string) {
    const { data, error } = await this.db(user).from('workspaces').select('id,name,timezone').eq('id', workspaceId).maybeSingle();
    if (error || !data) throw new NotFoundException('Workspace not found');
    return { ...data, timeZone: (data as any).timezone || 'Asia/Tokyo' } as { id: string; name: string; timeZone: string };
  }

  private async busyDays(user: AuthUser, workspaceId: string, from: string, to: string, timeZone: string) {
    const { data } = await this.db(user).from('content_variants').select('scheduled_for').eq('workspace_id', workspaceId)
      .gte('scheduled_for', `${from}T00:00:00Z`).lte('scheduled_for', `${addDaysLocal(to, 1)}T00:00:00Z`).neq('status', 'archived');
    return (data ?? []).map((row: any) => localDate(new Date(row.scheduled_for), timeZone));
  }

  /** One model call for all captions; free templates if AI is off or the answer is unusable. */
  private async captions(posts: PlannedPost[], studio: string, offer?: string | null): Promise<string[]> {
    try {
      const response = await this.provider.generate({
        instructions: [
          'CONTENT_PLAN_CAPTIONS', `titles=${JSON.stringify(posts.map((p) => p.title))}`,
          `Write one Instagram caption in English for each title, for "${studio}", a permanent makeup studio.`,
          'Warm, natural, max 500 characters each, no medical claims, no invented prices or dates, soft call to book via DM or LINE, no hashtags.',
          offer ? `Mention this offer where it fits: ${offer}` : '',
          'Answer ONLY with a JSON array of strings, same order and length as the titles.'
        ].filter(Boolean).join('\n'),
        input: posts.map((p, i) => `${i + 1}. ${p.title} (${p.category})`).join('\n')
      });
      return parseCaptionList(response.text, posts.length) ?? posts.map((p) => starterCaption(p, offer));
    } catch { return posts.map((p) => starterCaption(p, offer)); }
  }

  private async createDrafts(user: AuthUser, workspaceId: string, posts: PlannedPost[], timeZone: string, studio: string, offer?: string | null, campaignId?: string) {
    const texts = await this.captions(posts, studio, offer);
    const created: Array<{ id: string; date: string; title: string }> = [];
    for (const [i, post] of posts.entries()) {
      const draft = await this.content.createComposerDraft(user, workspaceId, {
        title: post.title, objective: post.objective, goal: campaignId ? 'campaign' : 'plan_30_days', language: 'en',
        caption: texts[i], hashtags: [], format: post.format, platforms: post.platforms, plannedFor: eveningSlot(post.date, timeZone)
      } as any);
      created.push({ id: (draft as any).id, date: post.date, title: post.title });
    }
    if (campaignId && created.length) {
      await this.db(user).from('content_posts').update({ campaign_id: campaignId }).eq('workspace_id', workspaceId).in('id', created.map((c) => c.id));
    }
    return created;
  }

  // ---------- 30-day plan + ideas ----------
  async planDays(user: AuthUser, workspaceId: string, dto: PlanDaysDto) {
    const ws = await this.workspace(user, workspaceId);
    const today = localDate(new Date(), ws.timeZone);
    const startsOn = dto.startsOn && dto.startsOn >= today ? dto.startsOn : addDaysLocal(today, 1);
    const days = dto.days ?? 30;
    const endsOn = addDaysLocal(startsOn, days - 1);
    const busy = await this.busyDays(user, workspaceId, startsOn, endsOn, ws.timeZone);
    const count = Math.max(1, (dto.posts ?? 12) - new Set(busy).size);
    const posts = planPosts({ startsOn, endsOn, count, busyDays: busy });
    const created = await this.createDrafts(user, workspaceId, posts, ws.timeZone, ws.name);
    return { startsOn, endsOn, created, skippedBusyDays: new Set(busy).size, note: 'All drafts. Nothing is posted until you approve and post each one.' };
  }

  async ideas(user: AuthUser, workspaceId: string) {
    const ws = await this.workspace(user, workspaceId);
    const db = this.db(user);
    const today = localDate(new Date(), ws.timeZone);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const until = new Date(Date.now() + 8 * 86400000).toISOString();
    const [photos, appts, upcoming] = await Promise.all([
      db.from('media_asset_links').select('media_asset_id,role,asset:media_assets(marketing_permission,created_at)').eq('workspace_id', workspaceId).in('role', ['after', 'healed']).gte('created_at', since).limit(50),
      db.from('appointments').select('service_name').eq('workspace_id', workspaceId).gte('start_at', new Date(Date.now() - 90 * 86400000).toISOString()).limit(500),
      db.from('appointments').select('start_at,status').eq('workspace_id', workspaceId).gte('start_at', new Date().toISOString()).lte('start_at', until).not('status', 'in', '(cancelled,no_show)')
    ]);
    const healedPhotos = (photos.data ?? []).filter((row: any) => ['marketing_approved', 'limited'].includes(row.asset?.marketing_permission)).length;
    const counts = new Map<string, number>();
    for (const row of appts.data ?? []) counts.set((row as any).service_name, (counts.get((row as any).service_name) ?? 0) + 1);
    const topServices = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const bookedDays = new Set((upcoming.data ?? []).map((row: any) => localDate(new Date(row.start_at), ws.timeZone)));
    const slowDays = [1, 2, 3, 4, 5, 6, 7].map((d) => addDaysLocal(today, d)).filter((d) => !bookedDays.has(d));
    return { ideas: [...dataIdeas({ healedPhotos, topServices, slowDays: upcoming.error ? [] : slowDays }), ...seasonalIdeas(today, 75)] };
  }

  // ---------- campaigns ----------
  async listCampaigns(user: AuthUser, workspaceId: string) {
    const { data, error } = await this.db(user).from('content_campaigns').select('*').eq('workspace_id', workspaceId).order('starts_on', { ascending: false }).limit(50);
    if (error) { if (isMissingRelation(error)) return { campaigns: [], needsMigration: MIGRATION }; throw new InternalServerErrorException(error.message); }
    const ids = (data ?? []).map((c: any) => c.id);
    const posts = ids.length ? await this.db(user).from('content_posts').select('id,campaign_id,status').eq('workspace_id', workspaceId).in('campaign_id', ids) : { data: [] as any[] };
    return { campaigns: (data ?? []).map((c: any) => ({ ...c, post_count: (posts.data ?? []).filter((p: any) => p.campaign_id === c.id).length })), needsMigration: null };
  }

  async createCampaign(user: AuthUser, workspaceId: string, dto: CreateCampaignDto) {
    await this.workspace(user, workspaceId);
    const span = daysBetween(dto.startsOn, dto.endsOn);
    if (span < 0) throw new BadRequestException('The end date must be after the start date');
    if (span > 92) throw new BadRequestException('Keep a campaign to 3 months or less');
    const { data, error } = await this.db(user).from('content_campaigns').insert({
      workspace_id: workspaceId, name: dto.name.trim(), goal: dto.goal, starts_on: dto.startsOn, ends_on: dto.endsOn, offer: dto.offer?.trim() || null, created_by: user.id
    }).select('*').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    return data;
  }

  /** AngelOS proposes the plan: N post drafts + 1 LINE broadcast draft. Runs once per campaign. */
  async planCampaign(user: AuthUser, workspaceId: string, campaignId: string) {
    const ws = await this.workspace(user, workspaceId);
    const db = this.db(user);
    const { data: campaign, error } = await db.from('content_campaigns').select('*').eq('workspace_id', workspaceId).eq('id', campaignId).maybeSingle();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'draft') throw new ConflictException('This campaign already has a plan. Open the drafts on the Social calendar.');
    const today = localDate(new Date(), ws.timeZone);
    const startsOn = campaign.starts_on < today ? addDaysLocal(today, 1) : campaign.starts_on;
    if (startsOn > campaign.ends_on) throw new ConflictException('This campaign has already ended');
    const busy = await this.busyDays(user, workspaceId, startsOn, campaign.ends_on, ws.timeZone);
    const plan = planCampaign({ startsOn, endsOn: campaign.ends_on, goal: campaign.goal, busyDays: busy });
    // Claim the campaign first so a double tap cannot plan twice.
    const claim = await db.from('content_campaigns').update({ status: 'planned', plan: { posts: plan.posts.length, lineBroadcastOn: plan.lineBroadcastOn }, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId).eq('id', campaignId).eq('status', 'draft').select('id');
    if (!claim.data?.length) throw new ConflictException('This campaign is already being planned');
    try {
      const created = await this.createDrafts(user, workspaceId, plan.posts, ws.timeZone, ws.name, campaign.offer, campaignId);
      let line: any = null; let lineNote: string | null = null;
      try { line = await this.lineDraft(user, workspaceId, { topic: `${campaign.name}${campaign.offer ? ` (${campaign.offer})` : ''}`, sendAt: eveningSlot(plan.lineBroadcastOn, ws.timeZone, 19) }, campaignId); }
      catch (e) { lineNote = e instanceof Error ? e.message : 'LINE draft skipped'; }
      return { campaignId, created, lineBroadcast: line, lineNote };
    } catch (e) {
      await db.from('content_campaigns').update({ status: 'draft' }).eq('workspace_id', workspaceId).eq('id', campaignId);
      throw e;
    }
  }

  // ---------- hashtag sets ----------
  async listHashtagSets(user: AuthUser, workspaceId: string) {
    const { data, error } = await this.db(user).from('hashtag_sets').select('*').eq('workspace_id', workspaceId).order('name');
    if (error) { if (isMissingRelation(error)) return { sets: [], needsMigration: MIGRATION }; throw new InternalServerErrorException(error.message); }
    return { sets: data ?? [], needsMigration: null };
  }
  async saveHashtagSet(user: AuthUser, workspaceId: string, dto: HashtagSetDto) {
    await this.workspace(user, workspaceId);
    const tags = Array.from(new Set(dto.tags.map((t) => `#${t.trim().replace(/^#+/, '').replace(/\s+/g, '')}`).filter((t) => t.length > 1))).slice(0, 30);
    const { data, error } = await this.db(user).from('hashtag_sets').upsert({ workspace_id: workspaceId, name: dto.name.trim(), language: dto.language, tags }, { onConflict: 'workspace_id,name' }).select('*').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    return data;
  }
  async deleteHashtagSet(user: AuthUser, workspaceId: string, id: string) {
    const { error } = await this.db(user).from('hashtag_sets').delete().eq('workspace_id', workspaceId).eq('id', id);
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    return { deleted: true };
  }

  // ---------- manual posting ----------
  /** Angel posted it herself (Copy caption & open Instagram). Records it honestly as owner-posted. */
  async markPosted(user: AuthUser, workspaceId: string, variantId: string, dto: MarkPostedDto) {
    const { data: variant, error } = await this.db(user).from('content_variants').select('*,post:content_posts(id,status)').eq('workspace_id', workspaceId).eq('id', variantId).maybeSingle();
    if (error || !variant) throw new NotFoundException('Post version not found');
    if (variant.status === 'published') return { variant, duplicatePrevented: true };
    if (!['approved', 'scheduled', 'publishing', 'failed'].includes(variant.status) || !['approved', 'scheduled', 'publishing', 'failed'].includes((variant as any).post?.status)) {
      throw new ConflictException('Approve the post first, then mark it as posted.');
    }
    const service = createServiceSupabaseClient();
    const now = new Date().toISOString();
    const verification = { verified: false, transport: 'owner_manual', permalink: dto.permalink ?? null, markedAt: now };
    await service.from('content_publish_attempts').upsert({ workspace_id: workspaceId, content_variant_id: variantId, idempotency_key: `content:${variantId}`, status: 'published', verification }, { onConflict: 'workspace_id,idempotency_key' });
    const { data: updated, error: updateError } = await service.from('content_variants').update({ status: 'published', live_url: dto.permalink ?? null, published_at: now, updated_at: now }).eq('workspace_id', workspaceId).eq('id', variantId).select('*').single();
    if (updateError || !updated) throw new InternalServerErrorException(updateError?.message ?? 'Could not save');
    const postId = (variant as any).content_post_id;
    const { data: remaining } = await service.from('content_variants').select('id').eq('workspace_id', workspaceId).eq('content_post_id', postId).not('status', 'in', '(published,archived)');
    if (!remaining?.length) await service.from('content_posts').update({ status: 'published', updated_at: now }).eq('workspace_id', workspaceId).eq('id', postId);
    return { variant: updated, duplicatePrevented: false };
  }

  // ---------- LINE broadcast ----------
  private lineConnected = async (workspaceId: string) => {
    const adapter = new LineMessagingAdapter(readLineConfig());
    if (!adapter.status().ready) return { adapter, connected: false };
    const { data } = await createServiceSupabaseClient().from('messaging_channels').select('id').eq('workspace_id', workspaceId).eq('provider', 'line').eq('status', 'connected').limit(1);
    return { adapter, connected: Boolean(data?.length) };
  };

  /** Japanese broadcast draft (casual salon tone) with the English meaning stored next to it for Angel. */
  async lineDraft(user: AuthUser, workspaceId: string, dto: LineDraftDto, campaignId?: string) {
    const ws = await this.workspace(user, workspaceId);
    const response = await this.provider.generate({
      instructions: ['LINE_BROADCAST_DRAFT', `Write one short LINE broadcast message in Japanese for "${ws.name}", a permanent makeup studio in Okinawa.`,
        'Friendly casual salon tone (です/ます, soft, warm, 1–2 emoji like ✨🌸), no stiff keigo, no English, max 250 characters, no invented prices or dates, end with an invitation to reply on LINE.'].join('\n'),
      input: dto.topic?.trim() || 'Bookings are open this month.'
    });
    const ja = response.text.trim().slice(0, 500);
    if (/[A-Za-z]{4,}/.test(ja.replace(/LINE/g, ''))) throw new ConflictException('The LINE draft mixed English and Japanese. Try again.');
    const en = (await this.provider.generate({ instructions: buildTranslateInstructions('en'), input: ja })).text.trim();
    const draft = await this.content.createComposerDraft(user, workspaceId, {
      title: `LINE broadcast: ${(dto.topic ?? 'bookings open').slice(0, 120)}`, objective: 'bookings', goal: campaignId ? 'campaign' : 'line_broadcast', language: 'ja',
      caption: ja, hashtags: [], format: 'photo', platforms: ['line'], plannedFor: dto.sendAt
    } as any);
    const variant = (draft as any).variants?.find((v: any) => v.platform === 'line');
    if (variant) await createServiceSupabaseClient().from('content_variants').update({ capabilities_snapshot: { ...(variant.capabilities_snapshot ?? {}), translation_en: en, broadcast: true } }).eq('workspace_id', workspaceId).eq('id', variant.id);
    if (campaignId) await this.db(user).from('content_posts').update({ campaign_id: campaignId }).eq('workspace_id', workspaceId).eq('id', (draft as any).id);
    return { postId: (draft as any).id, variantId: variant?.id ?? null, ja, en };
  }

  async lineEstimate(user: AuthUser, workspaceId: string) {
    await this.workspace(user, workspaceId);
    const { adapter, connected } = await this.lineConnected(workspaceId);
    if (!connected) return { connected: false, recipients: null, quota: null, used: null, text: lineEstimateText(null, null, null) };
    const est = await adapter.audienceEstimate();
    return { connected: true, ...est, text: lineEstimateText(est.recipients, est.quota, est.used) };
  }

  /** Send the approved LINE broadcast. Requires Approve on the post, LINE connected and confirm=true from the estimate dialog. */
  async lineBroadcast(user: AuthUser, workspaceId: string, variantId: string, confirm: boolean) {
    if (!confirm) throw new BadRequestException('Check the message count and confirm first.');
    const { data: variant } = await this.db(user).from('content_variants').select('*,post:content_posts(id,status)').eq('workspace_id', workspaceId).eq('id', variantId).maybeSingle();
    if (!variant || variant.platform !== 'line') throw new NotFoundException('LINE broadcast not found');
    if (variant.status === 'published') return { sent: true, duplicatePrevented: true };
    if (!['approved', 'scheduled'].includes((variant as any).post?.status)) throw new ConflictException('Approve the broadcast first.');
    if (!variant.capabilities_snapshot?.translation_en && /[\u3040-\u30ff\u4e00-\u9faf]/.test(variant.caption)) throw new ConflictException('Show the English meaning before sending.');
    const { adapter, connected } = await this.lineConnected(workspaceId);
    if (!connected) throw new ConflictException('LINE is not connected yet. Use "Copy & open LINE" and send it from the LINE Official Account app.');
    const service = createServiceSupabaseClient();
    const key = `content:${variantId}`;
    const { data: previous } = await service.from('content_publish_attempts').select('status').eq('workspace_id', workspaceId).eq('idempotency_key', key).maybeSingle();
    if (previous?.status === 'published') return { sent: true, duplicatePrevented: true };
    await service.from('content_publish_attempts').upsert({ workspace_id: workspaceId, content_variant_id: variantId, idempotency_key: key, status: 'publishing' }, { onConflict: 'workspace_id,idempotency_key' });
    const result = await adapter.broadcast(variant.caption, key);
    const now = new Date().toISOString();
    if (result.status !== 'sent') {
      await service.from('content_publish_attempts').update({ status: 'failed', error_message: result.error ?? 'failed', provider_response: result.raw ?? null }).eq('workspace_id', workspaceId).eq('idempotency_key', key);
      await service.from('content_variants').update({ status: 'failed', updated_at: now }).eq('id', variantId);
      throw new ConflictException(result.error ?? 'LINE broadcast failed. Nothing was sent.');
    }
    await service.from('content_publish_attempts').update({ status: 'published', provider_response: result.raw ?? null, verification: { verified: true, transport: 'line-broadcast' } }).eq('workspace_id', workspaceId).eq('idempotency_key', key);
    await service.from('content_variants').update({ status: 'published', published_at: now, provider_post_id: result.externalMessageId ?? null, updated_at: now }).eq('id', variantId);
    return { sent: true, duplicatePrevented: false };
  }

  // ---------- Insights › Social ----------
  async insights(user: AuthUser, workspaceId: string, days = 30) {
    const ws = await this.workspace(user, workspaceId);
    const db = this.db(user);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [variants, clients] = await Promise.all([
      db.from('content_variants').select('platform,status,published_at,scheduled_for').eq('workspace_id', workspaceId).gte('updated_at', since).limit(1000),
      db.from('clients').select('id,source,created_at').eq('workspace_id', workspaceId).gte('created_at', since).limit(2000)
    ]);
    const rows = variants.data ?? [];
    const byPlatform: Record<string, { drafts: number; scheduled: number; posted: number }> = {};
    const heat: Record<string, number> = {};
    for (const v of rows as any[]) {
      const p = (byPlatform[v.platform] ??= { drafts: 0, scheduled: 0, posted: 0 });
      if (v.status === 'published') {
        p.posted += 1;
        if (v.published_at) {
          const d = new Date(v.published_at);
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: ws.timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d);
          const k = `${parts.find((x) => x.type === 'weekday')?.value} ${parts.find((x) => x.type === 'hour')?.value}:00`;
          heat[k] = (heat[k] ?? 0) + 1;
        }
      } else if (v.status === 'scheduled' || v.status === 'approved') p.scheduled += 1;
      else if (v.status === 'draft') p.drafts += 1;
    }
    const socialClients = (clients.data ?? []).filter((c: any) => SOCIAL_SOURCES.includes(String(c.source ?? '').toLowerCase()));
    let bookings = 0;
    if (socialClients.length) {
      const { count } = await db.from('appointments').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since).in('client_id', socialClients.map((c: any) => c.id)).not('status', 'in', '(cancelled)');
      bookings = count ?? 0;
    }
    const bySource: Record<string, number> = {};
    for (const c of socialClients as any[]) bySource[String(c.source).toLowerCase()] = (bySource[String(c.source).toLowerCase()] ?? 0) + 1;
    const postingTimes = Object.entries(heat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slot, count]) => ({ slot, count }));
    const line = await this.lineConnected(workspaceId);
    return {
      days,
      connections: { instagram: false, facebook: false, tiktok: false, line: line.connected },
      platformMetrics: null,
      platformMetricsNote: 'Reach, likes and followers need Instagram/Facebook connected (Meta approval). Not connected yet.',
      byPlatform,
      postingTimes,
      bestTimeDefault: postingTimes.length ? null : '19:00–21:00 (until AngelOS has your own numbers)',
      fromSocial: { newClients: socialClients.length, bySource, bookings }
    };
  }
}
