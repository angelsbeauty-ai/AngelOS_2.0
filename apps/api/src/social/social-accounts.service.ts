import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AuthUser } from '../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { LineMessagingAdapter, readLineConfig } from '../messaging/line-messaging.adapter';
import { isMissingRelation } from '../messaging/saved-replies.service';
import { readMetaConfig, type MetaConfig } from '../meta/meta.config';
import { metaPublishingReady } from '../meta/meta-publishing.adapter';
import { metaNumbers } from './meta-insights';
import { openToken, sealToken, tokenKeyReady } from './token-crypto';

export type SocialPlatform = 'instagram' | 'facebook' | 'line';
export type AccountState = 'connected' | 'needs_reconnect' | 'not_connected';
export interface SocialAccountView {
  platform: SocialPlatform; state: AccountState; name: string | null; handle: string | null; pictureUrl: string | null;
  /** IG/FB: true when the Meta login (Gordon) is live on this server: META_OAUTH_ENABLED=true. */
  connectAvailable: boolean;
  /** Where the app starts the Meta login. Contract for Gordon's OAuth: POST returns { authUrl }. */
  connectPath: string | null;
}

const MIGRATION = '0023_v1_social_line_and_metrics';
const on = (v?: string) => String(v ?? '').trim().toLowerCase() === 'true';
export const metaConnectAvailable = (env: NodeJS.ProcessEnv = process.env) => on(env.META_OAUTH_ENABLED);

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
    return { platform: 'line', state: 'connected', name: bot.displayName, handle: bot.basicId ?? null, pictureUrl: bot.pictureUrl ?? null, connectAvailable: true, connectPath: null } satisfies SocialAccountView;
  }

  // ---------- Meta (read only) ----------
  /** Per-studio Meta config. Today: the server-wide env keys (beta, one studio). Gordon swaps in meta_connections tokens. */
  metaConfigFor(_workspaceId: string): MetaConfig { return readMetaConfig(); }

  private async metaRow(workspaceId: string) {
    const { data, error } = await createServiceSupabaseClient().from('meta_connections').select('page_name,ig_username,status,token_expires_at').eq('workspace_id', workspaceId).neq('status', 'disconnected').limit(1);
    return error ? null : data?.[0] ?? null;
  }

  async accounts(user: AuthUser, workspaceId: string): Promise<{ accounts: SocialAccountView[] }> {
    await this.member(user, workspaceId);
    const [line, meta] = await Promise.all([this.lineAdapterFor(workspaceId), this.metaRow(workspaceId)]);
    const cfg = this.metaConfigFor(workspaceId);
    const connectAvailable = metaConnectAvailable();
    const metaView = (platform: 'instagram' | 'facebook'): SocialAccountView => {
      const name = platform === 'instagram' ? meta?.ig_username ?? null : meta?.page_name ?? null;
      const rowOk = meta && (platform === 'facebook' || meta.ig_username);
      const state: AccountState = rowOk ? (meta!.status === 'needs_reconnect' ? 'needs_reconnect' : 'connected') : metaPublishingReady(platform, cfg) ? 'connected' : 'not_connected';
      return { platform, state, name, handle: platform === 'instagram' && name ? `@${name}` : null, pictureUrl: null, connectAvailable, connectPath: connectAvailable ? `/workspaces/${workspaceId}/meta/connect` : null };
    };
    return {
      accounts: [
        { platform: 'line', state: line.adapter ? 'connected' : 'not_connected', name: line.name, handle: line.handle, pictureUrl: line.pictureUrl, connectAvailable: true, connectPath: null },
        metaView('instagram'), metaView('facebook')
      ]
    };
  }

  // ---------- numbers ----------
  private async liveNumbers(workspaceId: string, platform: SocialPlatform) {
    if (platform === 'line') {
      const { adapter } = await this.lineAdapterFor(workspaceId);
      if (!adapter) return null;
      const f = await adapter.followers();
      return { followers: f.followers, engagement: null, reach: f.targetedReaches, raw: { blocks: f.blocks, date: f.date } };
    }
    const cfg = this.metaConfigFor(workspaceId);
    if (!metaPublishingReady(platform, cfg)) return null;
    const n = await metaNumbers(platform, cfg);
    return { followers: n.followers, engagement: n.engagement, reach: null, raw: { posts: n.posts } };
  }

  async numbers(user: AuthUser, workspaceId: string) {
    const { accounts } = await this.accounts(user, workspaceId);
    const connected = accounts.filter((a) => a.state === 'connected').map((a) => a.platform);
    if (!connected.length) return { connected, items: [] };
    const { data, error } = await createUserSupabaseClient(user.accessToken).from('social_account_metrics').select('platform,metric_date,followers,engagement,reach').eq('workspace_id', workspaceId).in('platform', connected).order('metric_date', { ascending: false }).limit(60);
    const rows = error ? [] : data ?? [];
    const items = await Promise.all(connected.map(async (platform) => {
      const mine = rows.filter((r: any) => r.platform === platform);
      if (mine.length) {
        const prev = mine.find((r: any) => r.metric_date <= new Date(Date.parse(mine[0].metric_date) - 7 * 86400000).toISOString().slice(0, 10));
        return { platform, followers: mine[0].followers, engagement: mine[0].engagement, reach: mine[0].reach, asOf: mine[0].metric_date, followersChange7d: prev && mine[0].followers != null && prev.followers != null ? mine[0].followers - prev.followers : null };
      }
      const live = await this.liveNumbers(workspaceId, platform).catch(() => null);
      return { platform, followers: live?.followers ?? null, engagement: live?.engagement ?? null, reach: live?.reach ?? null, asOf: null, followersChange7d: null };
    }));
    return { connected, items };
  }

  /** Daily pull at 06:10 JST: one row per studio per connected platform. Skips quietly before migration 0023. */
  @Cron('0 10 6 * * *', { name: 'social-metrics-daily', timeZone: 'Asia/Tokyo', disabled: process.env.NODE_ENV === 'test' || process.env.SOCIAL_METRICS_CRON === 'off' })
  async pullDaily() {
    const service = createServiceSupabaseClient();
    const { data: lines, error } = await service.from('line_connections').select('workspace_id').eq('status', 'connected');
    if (error) { if (!isMissingRelation(error)) this.logger.warn(`metrics pull: ${error.message}`); return { stored: 0 }; }
    const { data: metas } = await service.from('meta_connections').select('workspace_id').eq('status', 'connected');
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
