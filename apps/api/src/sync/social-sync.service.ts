import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { readMetaConfig } from '../meta/meta.config';
import { decryptToken } from '../meta/meta-crypto';
import { openToken, tokenKeyReady } from '../social/token-crypto';
import { classifyIntent } from '../messaging/messaging.service';
import { detectLanguage } from '../messaging/language';
import { metaNumbers } from '../social/meta-insights';
import { fetchConversations, fetchFacebookPosts, fetchInstagramPosts, plainGraphReason, postTitle, type SyncedConversation, type SyncedPost } from './meta-sync';

type Db = SupabaseClient<any, any, any>;
type Provider = 'facebook' | 'instagram' | 'line';
export interface PlatformSync { platform: Provider; connected: boolean; messages: { ok: boolean; imported: number; note: string | null }; posts: { ok: boolean; imported: number; note: string | null } | null; at: string }

export const LINE_FROM_NOW_NOTE = 'New LINE messages appear here from now on';
const POST_DAYS = 90;

let instance: SocialSyncService | null = null;
/** Fire-and-forget sync after a connect (Meta OAuth / LINE setup). Never throws. */
export function triggerWorkspaceSync(workspaceId: string): void {
  if (!instance) return;
  void instance.syncWorkspace(workspaceId).catch(() => undefined);
}

/** Public URL of this API for the LINE webhook (PUBLIC_API_URL, else Railway's own domain, else the Meta redirect origin). */
export function publicApiBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const railway = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  try { return env.META_OAUTH_REDIRECT_URI ? new URL(env.META_OAUTH_REDIRECT_URI).origin : null; } catch { return null; }
}

/**
 * Pulls what already exists on the studio's connected accounts into AngelOS (read only, never sends):
 *  - Facebook Page + Instagram conversations → inbox threads (per studio, works with META_MESSAGING_ENABLED off)
 *  - last 90 days of Page posts + IG media → posts list as Posted (keyed by platform post id)
 *  - LINE has no history API: makes sure the channel webhook points here so new messages arrive.
 * Runs on connect, every 5 minutes, and on pull-to-refresh. Status per platform is kept on messaging_channels.capabilities.sync.
 */
@Injectable()
export class SocialSyncService implements OnModuleInit {
  private readonly logger = new Logger('SocialSync');
  private readonly running = new Map<string, Promise<PlatformSync[]>>();

  onModuleInit() { instance = this; }

  async syncForUser(user: AuthUser, workspaceId: string) {
    const { data } = await createUserSupabaseClient(user.accessToken).from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!data) throw new NotFoundException('Workspace not found');
    return { platforms: await this.syncWorkspace(workspaceId) };
  }

  async statusForUser(user: AuthUser, workspaceId: string) {
    const { data } = await createUserSupabaseClient(user.accessToken).from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!data) throw new NotFoundException('Workspace not found');
    return { platforms: await this.storedStatus(workspaceId) };
  }

  async storedStatus(workspaceId: string): Promise<PlatformSync[]> {
    const { data } = await createServiceSupabaseClient().from('messaging_channels').select('provider,capabilities').eq('workspace_id', workspaceId).in('provider', ['facebook', 'instagram', 'line']).eq('status', 'connected');
    return (data ?? []).map((row: any) => row.capabilities?.sync).filter(Boolean);
  }

  @Cron('30 */5 * * * *', { name: 'social-sync', disabled: process.env.NODE_ENV === 'test' || process.env.SOCIAL_SYNC_CRON === 'off' })
  async syncAll() {
    const db = createServiceSupabaseClient();
    const [meta, line] = await Promise.all([
      db.from('meta_connections').select('workspace_id').in('status', ['connected', 'needs_reconnect']),
      db.from('line_connections').select('workspace_id').eq('status', 'connected')
    ]);
    const ids = new Set<string>([...(meta.data ?? []), ...(line.data ?? [])].map((r: any) => r.workspace_id));
    for (const id of ids) {
      try { await this.syncWorkspace(id); } catch (e) { this.logger.warn(`sync failed for a workspace: ${e instanceof Error ? e.message : 'unknown'}`); }
    }
  }

  /** One sync at a time per studio; a second call joins the running one. */
  syncWorkspace(workspaceId: string): Promise<PlatformSync[]> {
    const running = this.running.get(workspaceId);
    if (running) return running;
    const job = this.doSync(workspaceId).finally(() => this.running.delete(workspaceId));
    this.running.set(workspaceId, job);
    return job;
  }

  private async doSync(workspaceId: string): Promise<PlatformSync[]> {
    const db = createServiceSupabaseClient();
    const out: PlatformSync[] = [];
    const meta = await this.metaFor(db, workspaceId);
    if (meta) {
      const fb = await this.syncMeta(db, workspaceId, meta, 'facebook');
      out.push(fb);
      if (meta.igUserId) out.push(await this.syncMeta(db, workspaceId, meta, 'instagram'));
    }
    const line = await this.syncLine(db, workspaceId);
    if (line) out.push(line);
    return out;
  }

  // ---------- Meta ----------
  private async metaFor(db: Db, workspaceId: string) {
    const { data, error } = await db.from('meta_connections').select('page_id,page_name,ig_user_id,ig_username,page_token_enc,status').eq('workspace_id', workspaceId).in('status', ['connected', 'needs_reconnect']).order('connected_at', { ascending: false }).limit(1);
    const row: any = error ? null : data?.[0];
    if (!row?.page_token_enc) return null;
    try {
      return { pageId: String(row.page_id), pageName: row.page_name as string | null, igUserId: row.ig_user_id as string | null, igUsername: row.ig_username as string | null, token: decryptToken(row.page_token_enc), graphBase: readMetaConfig().graphBase };
    } catch (e) { this.logger.warn(`Meta token could not be opened for a workspace: ${e instanceof Error ? e.message : 'unknown'}`); return null; }
  }

  private async syncMeta(db: Db, workspaceId: string, meta: NonNullable<Awaited<ReturnType<SocialSyncService['metaFor']>>>, platform: 'facebook' | 'instagram'): Promise<PlatformSync> {
    const accountId = platform === 'facebook' ? meta.pageId : meta.igUserId!;
    const name = platform === 'facebook' ? meta.pageName ?? 'Facebook Page' : meta.igUsername ? `@${meta.igUsername}` : 'Instagram';
    const channel = await this.ensureChannel(db, workspaceId, platform, accountId, name);
    const at = new Date().toISOString();
    const result: PlatformSync = { platform, connected: true, at, messages: { ok: true, imported: 0, note: null }, posts: { ok: true, imported: 0, note: null } };
    try {
      const convs = await fetchConversations({ graphBase: meta.graphBase, pageId: meta.pageId, ownId: accountId, token: meta.token, platform });
      for (const conv of convs) result.messages.imported += await this.importConversation(db, workspaceId, channel, platform, accountId, conv);
    } catch (e) {
      result.messages = { ok: false, imported: 0, note: plainGraphReason(e, platform === 'facebook' ? 'pages_messaging' : 'instagram_manage_messages') };
    }
    try {
      const posts: SyncedPost[] = platform === 'facebook'
        ? await fetchFacebookPosts({ graphBase: meta.graphBase, pageId: meta.pageId, token: meta.token, days: POST_DAYS })
        : await fetchInstagramPosts({ graphBase: meta.graphBase, igUserId: accountId, token: meta.token, days: POST_DAYS });
      result.posts!.imported = await this.importPosts(db, workspaceId, platform, posts);
    } catch (e) {
      result.posts = { ok: false, imported: 0, note: plainGraphReason(e, platform === 'facebook' ? 'pages_read_engagement' : 'instagram_basic') };
    }
    await this.storeNumbers(db, workspaceId, meta, platform, result);
    await this.saveStatus(db, channel, result);
    return result;
  }

  /** Followers / posts count right after connect and on every sync (read only, no META_PUBLISHING_ENABLED needed). */
  private async storeNumbers(db: Db, workspaceId: string, meta: NonNullable<Awaited<ReturnType<SocialSyncService['metaFor']>>>, platform: 'facebook' | 'instagram', result: PlatformSync) {
    try {
      const n = await metaNumbers(platform, { ...readMetaConfig(), pageId: meta.pageId, igUserId: meta.igUserId ?? undefined, pageToken: meta.token });
      (result as any).numbers = { followers: n.followers, posts: n.posts, engagement: n.engagement, error: n.error ?? null };
      if (n.followers == null) return;
      const date = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      await db.from('social_account_metrics').upsert({ workspace_id: workspaceId, platform, metric_date: date, followers: n.followers, engagement: n.engagement, reach: null, raw: { posts: n.posts }, fetched_at: new Date().toISOString() }, { onConflict: 'workspace_id,platform,metric_date' });
    } catch (e) { this.logger.warn(`numbers for a workspace failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  private async ensureChannel(db: Db, workspaceId: string, provider: Provider, accountId: string, displayName: string) {
    const { data: existing } = await db.from('messaging_channels').select('id,workspace_id,provider,display_name,status,capabilities').eq('provider', provider).eq('external_account_id', accountId).limit(5);
    const mine = (existing ?? []).find((r: any) => r.workspace_id === workspaceId);
    if (mine) {
      if (mine.status !== 'connected' || mine.display_name !== displayName) {
        await db.from('messaging_channels').update({ status: 'connected', display_name: displayName, updated_at: new Date().toISOString() }).eq('id', mine.id);
      }
      return { id: mine.id as string, provider, display_name: displayName, capabilities: (mine.capabilities ?? {}) as Record<string, any> };
    }
    // The account moved to this studio: an old studio's channel row stops receiving.
    for (const other of existing ?? []) await db.from('messaging_channels').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('id', (other as any).id);
    const capabilities: Record<string, any> = { inbound: true, outbound: false, source: provider === 'line' ? 'line_connection' : 'meta_connection' };
    const { data, error } = await db.from('messaging_channels').insert({ workspace_id: workspaceId, provider, display_name: displayName, external_account_id: accountId, status: 'connected', capabilities }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? 'Could not prepare the inbox channel');
    return { id: data.id as string, provider, display_name: displayName, capabilities };
  }

  private async saveStatus(db: Db, channel: { id: string; capabilities: Record<string, any> }, sync: PlatformSync) {
    channel.capabilities = { ...channel.capabilities, sync };
    await db.from('messaging_channels').update({ capabilities: channel.capabilities }).eq('id', channel.id);
  }

  /** Upserts the thread and inserts messages not seen before (unique external_message_id). Returns new message count. */
  private async importConversation(db: Db, workspaceId: string, channel: { id: string }, platform: 'facebook' | 'instagram', ownId: string, conv: SyncedConversation): Promise<number> {
    if (!conv.messages.length) return 0;
    const externalThreadId = `${platform}:${conv.contactId}`;
    const { data: identity } = await db.from('client_channel_identities').select('client_id').eq('workspace_id', workspaceId).eq('channel_id', channel.id).eq('external_user_id', conv.contactId).maybeSingle();
    let clientId: string | null = identity?.client_id ?? null;
    const firstInbound = conv.messages.find((m) => m.fromId !== ownId);
    if (!clientId) {
      const { data: lead, error } = await db.from('clients').insert({
        workspace_id: workspaceId, display_name: conv.contactName?.trim() || `${platform === 'instagram' ? 'Instagram' : 'Facebook'} lead`,
        language: detectLanguage(firstInbound?.body ?? '') === 'ja' ? 'ja' : 'en', status: 'lead', source: platform, do_not_auto_message: false
      }).select('id').single();
      if (error || !lead) throw new Error(error?.message ?? 'Could not create lead');
      clientId = lead.id;
      await db.from('client_channel_identities').upsert({ workspace_id: workspaceId, client_id: clientId, channel_id: channel.id, external_user_id: conv.contactId, display_name: conv.contactName, match_confidence: 'unverified' }, { onConflict: 'workspace_id,channel_id,external_user_id' });
    }
    const last = conv.messages[conv.messages.length - 1];
    const lastInbound = [...conv.messages].reverse().find((m) => m.fromId !== ownId);
    const fromClient = last.fromId !== ownId;
    const intent = classifyIntent(lastInbound?.body ?? '');
    const { data: existing } = await db.from('message_threads').select('id,last_message_at').eq('workspace_id', workspaceId).eq('channel_id', channel.id).eq('external_thread_id', externalThreadId).maybeSingle();
    let threadId = existing?.id as string | undefined;
    if (!threadId) {
      const { data, error } = await db.from('message_threads').insert({
        workspace_id: workspaceId, channel_id: channel.id, client_id: clientId, external_thread_id: externalThreadId, contact_external_user_id: conv.contactId,
        contact_display_name: conv.contactName, intent, priority: 'today', status: fromClient ? 'needs_reply' : 'waiting_client', needs_owner: false,
        last_message_at: last.createdAt, owner_unread: fromClient
      }).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'Could not create thread');
      threadId = data.id;
    }
    const rows = conv.messages.map((m) => {
      const outbound = m.fromId === ownId;
      return {
        workspace_id: workspaceId, thread_id: threadId, client_id: clientId, direction: outbound ? 'outbound' : 'inbound', sender_type: outbound ? 'owner' : 'client',
        external_message_id: `${platform}:${m.id}`, body: m.body, original_language: detectLanguage(m.body), status: outbound ? 'sent' : 'received',
        sent_at: outbound ? m.createdAt : null, created_at: m.createdAt, metadata: { source: `sync:${platform}` }
      };
    });
    const { data: inserted, error: insertError } = await db.from('client_messages').upsert(rows, { onConflict: 'workspace_id,external_message_id', ignoreDuplicates: true }).select('id');
    if (insertError) throw new Error(insertError.message);
    const added = inserted?.length ?? 0;
    if (existing && added > 0 && (!existing.last_message_at || existing.last_message_at < last.createdAt)) {
      await db.from('message_threads').update({ last_message_at: last.createdAt, intent, status: fromClient ? 'needs_reply' : 'waiting_client', owner_unread: fromClient, archived_at: null, updated_at: new Date().toISOString() }).eq('id', threadId!);
    }
    return added;
  }

  /** Real posts → content_posts + one Posted variant each. No duplicates: keyed by the platform post id. */
  private async importPosts(db: Db, workspaceId: string, platform: 'facebook' | 'instagram', posts: SyncedPost[]): Promise<number> {
    if (!posts.length) return 0;
    const { data: known, error } = await db.from('content_variants').select('provider_post_id').eq('workspace_id', workspaceId).eq('platform', platform).in('provider_post_id', posts.map((p) => p.id));
    if (error) throw new Error(error.message);
    const seen = new Set((known ?? []).map((r: any) => String(r.provider_post_id)));
    let added = 0;
    for (const p of posts) {
      if (seen.has(p.id)) continue;
      const { data: post, error: postError } = await db.from('content_posts').insert({
        workspace_id: workspaceId, title: postTitle(p.caption, platform, p.createdAt), objective: 'engagement', primary_format: p.format, status: 'published',
        source_goal: 'imported', created_at: p.createdAt, updated_at: p.createdAt
      }).select('id').single();
      if (postError || !post) throw new Error(postError?.message ?? 'Could not save a post');
      const { error: variantError } = await db.from('content_variants').insert({
        workspace_id: workspaceId, content_post_id: post.id, platform, format: p.format, caption: p.caption, status: 'published',
        scheduled_for: p.createdAt, published_at: p.createdAt, provider_post_id: p.id, live_url: p.permalink,
        capabilities_snapshot: { imported: true, source: `sync:${platform}` }, created_at: p.createdAt, updated_at: p.createdAt
      });
      if (variantError) { await db.from('content_posts').delete().eq('id', post.id); throw new Error(variantError.message); }
      added += 1;
    }
    return added;
  }

  // ---------- LINE ----------
  private async syncLine(db: Db, workspaceId: string): Promise<PlatformSync | null> {
    const { data: row, error } = await db.from('line_connections').select('*').eq('workspace_id', workspaceId).eq('status', 'connected').maybeSingle();
    if (error || !row || !tokenKeyReady()) return null;
    const channel = await this.ensureChannel(db, workspaceId, 'line', row.bot_user_id, row.display_name ?? 'LINE Official Account');
    const at = new Date().toISOString();
    const result: PlatformSync = { platform: 'line', connected: true, at, messages: { ok: true, imported: 0, note: LINE_FROM_NOW_NOTE }, posts: null };
    const base = publicApiBase();
    const endpoint = base ? `${base}/webhooks/line` : null;
    const prev = channel.capabilities?.sync as any;
    if (!endpoint) result.messages = { ok: false, imported: 0, note: 'Could not set the LINE webhook: the server does not know its public address.' };
    else if (prev?.webhook === endpoint) (result as any).webhook = endpoint; // already set, no repeat call
    else {
      try {
        const token = openToken(row.access_token_enc);
        const r = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(10000) });
        if (r.ok) (result as any).webhook = endpoint;
        else { const body = (await r.json().catch(() => ({}))) as any; result.messages = { ok: false, imported: 0, note: `Could not set the LINE webhook (${r.status}${body?.message ? `: ${String(body.message).slice(0, 120)}` : ''}).` }; }
      } catch (e) { result.messages = { ok: false, imported: 0, note: `Could not set the LINE webhook: ${e instanceof Error ? e.message.slice(0, 120) : 'unknown'}` }; }
    }
    if ((result as any).webhook) {
      // Verify on LINE's side: endpoint saved + "Use webhook" switched on (the API cannot switch it on for us).
      try {
        const token = openToken(row.access_token_enc);
        const h = { Authorization: `Bearer ${token}` };
        const g = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { headers: h, signal: AbortSignal.timeout(10000) });
        const info = (await g.json().catch(() => ({}))) as any;
        (result as any).webhookActive = info?.active === true;
        if (g.ok && info?.endpoint !== endpoint) result.messages = { ok: false, imported: 0, note: 'Needs reconnect: the LINE webhook address is not saved. Tap Reconnect.' };
        else if (g.ok && info?.active !== true) result.messages = { ok: false, imported: 0, note: 'Needs permission: turn on "Use webhook" in LINE Official Account Manager (Settings > Messaging API).' };
        else if (g.ok) {
          const tr = await fetch('https://api.line.me/v2/bot/channel/webhook/test', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(15000) });
          const tb = (await tr.json().catch(() => ({}))) as any;
          (result as any).webhookTest = tb?.success === true;
        }
      } catch { /* verification is best effort */ }
    }
    await this.saveStatus(db, channel, result);
    return result;
  }

  /** Webhook lookup: the studio's own LINE channel by bot user id (the webhook "destination"). */
  async lineSecretForBot(botUserId: string): Promise<{ workspaceId: string; channelSecret: string; accessToken: string; displayName: string | null } | null> {
    if (!botUserId || !tokenKeyReady()) return null;
    const { data, error } = await createServiceSupabaseClient().from('line_connections').select('workspace_id,channel_secret_enc,access_token_enc,display_name,bot_user_id').eq('bot_user_id', botUserId).eq('status', 'connected').maybeSingle();
    if (error || !data) return null;
    try { return { workspaceId: data.workspace_id, channelSecret: openToken(data.channel_secret_enc), accessToken: openToken(data.access_token_enc), displayName: data.display_name }; }
    catch { return null; }
  }

  async ensureLineChannel(workspaceId: string, botUserId: string, displayName: string | null) {
    return this.ensureChannel(createServiceSupabaseClient(), workspaceId, 'line', botUserId, displayName ?? 'LINE Official Account');
  }
}
