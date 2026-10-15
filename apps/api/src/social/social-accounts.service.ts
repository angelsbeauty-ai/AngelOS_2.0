import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AuthUser } from '../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { LineMessagingAdapter, readLineConfig } from '../messaging/line-messaging.adapter';
import { isMissingRelation } from '../messaging/saved-replies.service';
import { readMetaConfig, type MetaConfig } from '../meta/meta.config';
import { metaNumbers, metaReadReady } from './meta-insights';
import { missingMessagingScopes } from '../meta/meta-oauth';
import { decryptToken } from '../meta/meta-crypto';
import { readMetaOAuthConfig } from '../meta/meta-oauth';
import { openToken, sealToken, tokenKeyReady } from './token-crypto';
import { triggerWorkspaceSync } from '../sync/social-sync.service';

export type SocialPlatform = 'instagram' | 'facebook' | 'line';
export type AccountState = 'connected' | 'needs_reconnect' | 'not_connected';
export interface SocialAccountView {
  platform: SocialPlatform; state: AccountState; name: string | null; handle: string | null; pictureUrl: string | null;
  /** IG/FB: true when the Meta login (Gordon) is live on this server: META_OAUTH_ENABLED=true. */
  connectAvailable: boolean;
  /** Where the app starts the Meta login. Contract for Gordon's OAuth: POST returns { authUrl }. */
  connectPath: string | null;
  /** Live (or last stored) numbers. null = not available (never a fake 0). */
  followers: number | null; posts: number | null;
  /** Plain-English reason when state is needs_reconnect (e.g. a missing Meta permission). */
  reason: string | null;
  /** Last sync problem for this account, in plain words. */
  syncError: string | null;
  /** Meta permissions that were not granted at login. */
  missingScopes: string[];
}
const BLANK = { followers: null, posts: null, reason: null, syncError: null, missingScopes: [] as string[] };
const PERM_LABEL: Record<string, string> = { pages_messaging: 'Facebook Messenger messages (pages_messaging)', instagram_manage_messages: 'Instagram messages (instagram_manage_messages)' };
export function missingReason(missing: string[]): string | null {
  if (!missing.length) return null;
  return `Messages can't load because Meta did not give AngelOS permission to read ${missing.map((m) => PERM_LABEL[m] ?? m).join(' and ')}. Tap Reconnect and leave every box ticked on the Facebook screen.`;
}

const MIGRATION = '0023_v1_social_line_and_metrics';
const on = (v?: string) => String(v ?? '').trim().toLowerCase() === 'true';
/** META_OAUTH_ENABLED=true AND the Meta app keys + META_TOKEN_KEY exist (see readMetaOAuthConfig). */
export const metaConnectAvailable = (env: NodeJS.ProcessEnv = process.env) => on(env.META_OAUTH_ENABLED) && readMetaOAuthConfig(env) !== null;

/**
 * Connected-account status (LINE / Instagram / Facebook) + numbers, as one clean API for the app.
 * Meta login itself (OAuth, token storage) is Gordon's work: this only READS meta_connections (0022).
 */
@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  private async member(user: AuthUser, workspaceId: string) {
    const { data } = await createUserSupabaseClient(user.accessToken).from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!data) throw new NotFoundException('Workspace not found');
  }

  // ---------- LINE ----------
  /** The studio's own LINE channel (0023), else the single server-wide channel (env) linked via messaging_channels. */
  async lineAdapterFor(workspaceId: string): Promise<{ adapter: LineMessagingAdapter | null; name: string | null; pictureUrl: string | null; handle: string | null }> {
    const service = createServiceSupabaseClient();
    const { data, error } = await service.from('line_connections').select('*').eq('workspace_id', workspaceId).eq('status', 'connected').maybeSingle();
    if (!error && data && tokenKeyReady()) {
      try {
        const adapter = new LineMessagingAdapter({ enabled: true, channelSecret: openToken(data.channel_secret_enc), channelAccessToken: openToken(data.access_token_enc), apiBase: 'https://api.line.me' });
        return { adapter, name: data.display_name, pictureUrl: data.picture_url, handle: data.basic_id };
      } catch (e) { this.logger.warn(`LINE token could not be opened for a workspace: ${e instanceof Error ? e.message : 'unknown'}`); }
    }
    const env = new LineMessagingAdapter(readLineConfig());
    if (!env.status().ready) return { adapter: null, name: null, pictureUrl: null, handle: null };
    const { data: ch } = await service.from('messaging_channels').select('display_name').eq('workspace_id', workspaceId).eq('provider', 'line').eq('status', 'connected').limit(1);
    return ch?.length ? { adapter: env, name: ch[0].display_name ?? null, pictureUrl: null, handle: null } : { adapter: null, name: null, pictureUrl: null, handle: null };
  }

  /** Guided one-time setup: Channel ID + secret + long-lived channel access token from LINE Developers. */
  async connectLine(user: AuthUser, workspaceId: string, input: { channelId: string; channelSecret: string; accessToken: string }) {
    await this.member(user, workspaceId);
    const channelId = input.channelId?.trim(); const channelSecret = input.channelSecret?.trim(); const accessToken = input.accessToken?.trim();
    if (!/^\d{6,20}$/.test(channelId ?? '')) throw new BadRequestException('Channel ID is the number shown on the LINE Developers "Basic settings" tab.');
    if (!channelSecret || channelSecret.length < 16) throw new BadRequestException('Paste the Channel secret from "Basic settings".');
    if (!accessToken || accessToken.length < 40) throw new BadRequestException('Paste the long-lived Channel access token from the "Messaging API" tab (tap Issue).');
    if (!tokenKeyReady()) throw new ConflictException('The server is missing SOCIAL_TOKEN_KEY, so it cannot store LINE keys safely yet. Nothing was saved.');
    const adapter = new LineMessagingAdapter({ enabled: true, channelSecret, channelAccessToken: accessToken, apiBase: 'https://api.line.me' });
    let bot: Awaited<ReturnType<LineMessagingAdapter['getBotInfo']>>;
    try { bot = await adapter.getBotInfo(); }
    catch { throw new ConflictException('LINE did not accept this access token. Check you copied the whole token from the Messaging API tab.'); }
    const service = createServiceSupabaseClient();
    const { data: taken, error: takenError } = await service.from('line_connections').select('workspace_id').eq('bot_user_id', bot.userId).maybeSingle();
    if (takenError) { if (isMissingRelation(takenError)) throw new ConflictException(`LINE setup needs the database update ${MIGRATION} (waiting for Angel's yes). Nothing was saved.`); throw new InternalServerErrorException(takenError.message); }
    if (taken && taken.workspace_id !== workspaceId) throw new ConflictException('This LINE account is connected to another studio.');
    const now = new Date().toISOString();
    const { error } = await service.from('line_connections').upsert({
      workspace_id: workspaceId, channel_id: channelId, channel_secret_enc: sealToken(channelSecret), access_token_enc: sealToken(accessToken),
      bot_user_id: bot.userId, display_name: bot.displayName, picture_url: bot.pictureUrl ?? null, basic_id: bot.basicId ?? null,
      status: 'connected', last_error: null, connected_by: user.id, connected_at: now, updated_at: now
    }, { onConflict: 'workspace_id' });
    if (error) throw new InternalServerErrorException(error.message);
    triggerWorkspaceSync(workspaceId); // points the LINE webhook here so new messages arrive
    return { platform: 'line', state: 'connected', name: bot.displayName, handle: bot.basicId ?? null, pictureUrl: bot.pictureUrl ?? null, connectAvailable: true, connectPath: null, ...BLANK } satisfies SocialAccountView;
  }

  // ---------- Meta (read only) ----------
  /**
   * Per-studio Meta config: the studio's own Page/IG tokens from meta_connections (decrypted with META_TOKEN_KEY).
   * Falls back to the server-wide env keys only when the studio has no connection row (beta single-studio setup).
   * Publishing still needs META_PUBLISHING_ENABLED=true (metaPublishingReady).
   */
  async metaConfigFor(workspaceId: string): Promise<MetaConfig> {
    const base = readMetaConfig();
    const row = await this.metaRow(workspaceId);
    if (!row) return base;
    if ((row.status !== 'connected' && row.status !== 'needs_reconnect') || !row.page_token_enc) return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
    try {
      return { ...base, pageId: row.page_id, igUserId: row.ig_user_id ?? undefined, pageToken: decryptToken(row.page_token_enc), tokenExpiresAt: row.token_expires_at ?? undefined };
    } catch (e) {
      this.logger.warn(`Meta token could not be opened for a workspace: ${e instanceof Error ? e.message : 'unknown'}`);
      return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
    }
  }

  private async metaRow(workspaceId: string): Promise<any | null> {
    try { return await this.metaRowRaw(workspaceId); } catch (e) { this.logger.warn(`meta_connections read failed: ${e instanceof Error ? e.message : 'unknown'}`); return null; }
  }
  private async metaRowRaw(workspaceId: string): Promise<any | null> {
    const { data, error } = await createServiceSupabaseClient().from('meta_connections').select('page_id,page_name,ig_user_id,ig_username,page_token_enc,status,token_expires_at,scopes').eq('workspace_id', workspaceId).neq('status', 'disconnected').order('connected_at', { ascending: false }).limit(1);
    return error ? null : data?.[0] ?? null;
  }

  async accounts(user: AuthUser, workspaceId: string): Promise<{ accounts: SocialAccountView[] }> {
    await this.member(user, workspaceId);
    const connectAvailable = metaConnectAvailable();
    const connectPath = connectAvailable ? `/workspaces/${workspaceId}/meta/connect` : null;
    const fail = (part: string, e: unknown) => { this.logger.warn(`social accounts: ${part} failed for a workspace: ${e instanceof Error ? e.message : String(e)}`); return null; };
    // Each part is isolated: one failing provider shows as "needs reconnect", never fails the whole list.
    const lineP: Promise<SocialAccountView> = this.lineAdapterFor(workspaceId)
      .then((line): SocialAccountView => ({ platform: 'line', state: line.adapter ? 'connected' : 'not_connected', name: line.name, handle: line.handle, pictureUrl: line.pictureUrl, connectAvailable: true, connectPath: null, ...BLANK }))
      .catch((e): SocialAccountView => { fail('LINE', e); return { platform: 'line', state: 'needs_reconnect', name: null, handle: null, pictureUrl: null, connectAvailable: true, connectPath: null, ...BLANK, syncError: 'LINE status could not be read. Pull down to try again.' }; });
    const metaP = (async (): Promise<SocialAccountView[]> => {
      let meta: any = null; let cfg: MetaConfig | null = null;
      try { meta = await this.metaRow(workspaceId); cfg = await this.metaConfigFor(workspaceId); }
      catch (e) {
        fail('Meta', e);
        return (['instagram', 'facebook'] as const).map((platform) => ({ platform, state: 'needs_reconnect' as AccountState, name: null, handle: null, pictureUrl: null, connectAvailable, connectPath, ...BLANK, syncError: 'Instagram and Facebook status could not be read. Pull down to try again.' }));
      }
      const [nums, syncs] = await Promise.all([
        Promise.all((['instagram', 'facebook'] as const).map((p) => (cfg && metaReadReady(p, cfg) ? metaNumbers(p, cfg).catch(() => null) : Promise.resolve(null)))),
        this.syncNotes(workspaceId)
      ]);
      const numFor = (p: 'instagram' | 'facebook') => nums[p === 'instagram' ? 0 : 1];
      const missing = missingMessagingScopes(Array.isArray(meta?.scopes) && meta.scopes.length ? meta.scopes : null);
      const view = (platform: 'instagram' | 'facebook'): SocialAccountView => {
        try {
          const n = numFor(platform);
          const name = (platform === 'instagram' ? meta?.ig_username : meta?.page_name) ?? n?.name ?? null;
          const rowOk = meta && (platform === 'facebook' || meta.ig_username || meta.ig_user_id);
          const expired = meta?.token_expires_at && Date.parse(meta.token_expires_at) <= Date.now();
          const state: AccountState = rowOk ? (meta.status === 'needs_reconnect' || expired ? 'needs_reconnect' : 'connected') : cfg && metaReadReady(platform, cfg) ? 'connected' : 'not_connected';
          const myMissing = missing.filter((m) => (platform === 'facebook' ? m === 'pages_messaging' : m === 'instagram_manage_messages'));
          const reason = state !== 'needs_reconnect' ? null : expired ? 'The Meta login expired. Tap Reconnect to sign in to Facebook again.' : missingReason(myMissing.length ? myMissing : missing) ?? 'Meta asked for a fresh login. Tap Reconnect.';
          const syncError = state === 'not_connected' ? null : syncs[platform] ?? (n?.error && n.followers == null ? `Could not read numbers from Meta: ${n.error}` : null);
          return { platform, state, name, handle: platform === 'instagram' && name ? `@${name}` : null, pictureUrl: state !== 'not_connected' ? n?.pictureUrl ?? null : null, connectAvailable, connectPath,
            followers: n?.followers ?? null, posts: n?.posts ?? null, reason, syncError, missingScopes: myMissing };
        } catch (e) { fail(platform, e); return { platform, state: 'needs_reconnect', name: null, handle: null, pictureUrl: null, connectAvailable, connectPath, ...BLANK }; }
      };
      return [view('instagram'), view('facebook')];
    })();
    const [line0, metaViews, notes] = await Promise.all([lineP, metaP, this.syncNotes(workspaceId)]);
    let line = line0;
    if (line.state === 'connected') {
      const f = await this.liveNumbers(workspaceId, 'line').catch(() => null);
      line = { ...line, followers: f?.followers ?? null, syncError: notes.line ?? null };
    }
    return { accounts: [line, ...metaViews] };
  }

  /** Last sync problem per platform from messaging_channels.capabilities.sync (plain words), else null. */
  private async syncNotes(workspaceId: string): Promise<Record<string, string | null>> {
    try {
      const { data } = await createServiceSupabaseClient().from('messaging_channels').select('provider,capabilities').eq('workspace_id', workspaceId).in('provider', ['facebook', 'instagram', 'line']);
      const out: Record<string, string | null> = {};
      for (const row of data ?? []) {
        const sync = (row as any).capabilities?.sync;
        if (!sync) continue;
        const bad = [sync.messages, sync.posts].filter((x: any) => x && x.ok === false && x.note).map((x: any) => String(x.note));
        out[(row as any).provider] = bad.length ? bad.join(' ') : null;
      }
      return out;
    } catch { return {}; }
  }

  // ---------- numbers ----------
  private async liveNumbers(workspaceId: string, platform: SocialPlatform) {
    if (platform === 'line') {
      const { adapter } = await this.lineAdapterFor(workspaceId);
      if (!adapter) return null;
      const f = await adapter.followers();
      return { followers: f.followers, engagement: null, reach: f.targetedReaches, raw: { blocks: f.blocks, date: f.date } };
    }
    const cfg = await this.metaConfigFor(workspaceId);
    if (!metaReadReady(platform, cfg)) return null; // read only: never needs META_PUBLISHING_ENABLED
    const n = await metaNumbers(platform, cfg);
    return { followers: n.followers, engagement: n.engagement, reach: null, posts: n.posts, raw: { posts: n.posts, error: n.error ?? null } };
  }

  async numbers(user: AuthUser, workspaceId: string) {
    const { accounts } = await this.accounts(user, workspaceId);
    const connected = accounts.filter((a) => a.state !== 'not_connected').map((a) => a.platform);
    if (!connected.length) return { connected, items: [] };
    const { data, error } = await createUserSupabaseClient(user.accessToken).from('social_account_metrics').select('platform,metric_date,followers,engagement,reach,raw').eq('workspace_id', workspaceId).in('platform', connected).order('metric_date', { ascending: false }).limit(60);
    const rows = error ? [] : data ?? [];
    const items = await Promise.all(connected.map(async (platform) => {
      const mine = rows.filter((r: any) => r.platform === platform);
      if (mine.length) {
        const prev = mine.find((r: any) => r.metric_date <= new Date(Date.parse(mine[0].metric_date) - 7 * 86400000).toISOString().slice(0, 10));
        return { platform, followers: mine[0].followers, engagement: mine[0].engagement, reach: mine[0].reach, posts: mine[0].raw?.posts ?? null, asOf: mine[0].metric_date, followersChange7d: prev && mine[0].followers != null && prev.followers != null ? mine[0].followers - prev.followers : null };
      }
      const live = await this.liveNumbers(workspaceId, platform).catch(() => null);
      return { platform, followers: live?.followers ?? null, engagement: live?.engagement ?? null, reach: live?.reach ?? null, posts: (live as any)?.posts ?? null, asOf: null, followersChange7d: null };
    }));
    return { connected, items };
  }

  /** Daily pull at 06:10 JST: one row per studio per connected platform. Skips quietly before migration 0023. */
  @Cron('0 10 6 * * *', { name: 'social-metrics-daily', timeZone: 'Asia/Tokyo', disabled: process.env.NODE_ENV === 'test' || process.env.SOCIAL_METRICS_CRON === 'off' })
  async pullDaily() {
    const service = createServiceSupabaseClient();
    const { data: lines, error } = await service.from('line_connections').select('workspace_id').eq('status', 'connected');
    if (error) { if (!isMissingRelation(error)) this.logger.warn(`metrics pull: ${error.message}`); return { stored: 0 }; }
    const { data: metas } = await service.from('meta_connections').select('workspace_id').in('status', ['connected', 'needs_reconnect']);
    const targets: Array<[string, SocialPlatform]> = [
      ...(lines ?? []).map((r: any) => [r.workspace_id, 'line'] as [string, SocialPlatform]),
      ...(metas ?? []).flatMap((r: any) => [[r.workspace_id, 'instagram'], [r.workspace_id, 'facebook']] as Array<[string, SocialPlatform]>)
    ];
    const date = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    let stored = 0;
    for (const [workspaceId, platform] of targets) {
      const n = await this.liveNumbers(workspaceId, platform).catch(() => null);
      if (!n || n.followers == null) continue;
      const { error: e } = await service.from('social_account_metrics').upsert({ workspace_id: workspaceId, platform, metric_date: date, followers: n.followers, engagement: n.engagement, reach: n.reach, raw: n.raw, fetched_at: new Date().toISOString() }, { onConflict: 'workspace_id,platform,metric_date' });
      if (!e) stored += 1;
    }
    return { stored };
  }
}
