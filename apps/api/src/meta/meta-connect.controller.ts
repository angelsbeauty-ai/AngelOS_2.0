import { BadRequestException, Controller, Delete, ForbiddenException, Get, Logger, NotFoundException, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { encryptToken, readState, signState } from './meta-crypto';
import { META_OAUTH_SCOPES, buildMetaLoginUrl, exchangeCodeAndListPages, pickPage, readMetaOAuthConfig } from './meta-oauth';

function enabled() { const o = readMetaOAuthConfig(); if (!o) throw new NotFoundException(); return o; }
async function assertMember(user: AuthUser, workspaceId: string) {
  const { data } = await createUserSupabaseClient(user.accessToken).from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
  if (!data) throw new ForbiddenException();
}

/** Per-studio Meta connect. 404 unless META_PUBLISHING_ENABLED + META_APP_ID/SECRET + META_OAUTH_REDIRECT_URI + META_TOKEN_KEY. */
@Controller('workspaces/:workspaceId/meta')
@UseGuards(SupabaseAuthGuard)
export class MetaConnectController {
  /** Returns { url } for the app to open; ?redirect=true answers 302 instead. */
  @Get('connect')
  async connect(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Query('redirect') redirect: string | undefined, @Res({ passthrough: true }) res: Response) {
    const o = enabled(); await assertMember(user, ws);
    const url = buildMetaLoginUrl(o, signState({ w: ws, u: user.id }, o.stateSecret));
    if (redirect === 'true') { res.redirect(302, url); return; }
    return { url, scopes: META_OAUTH_SCOPES };
  }

  @Get('status')
  async status(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) {
    const o = readMetaOAuthConfig(); if (!o) return { enabled: false, connected: false, label: 'Not connected' };
    await assertMember(user, ws);
    const { data } = await createServiceSupabaseClient().from('meta_connections')
      .select('page_id,page_name,ig_user_id,ig_username,status,token_expires_at,connected_at').eq('workspace_id', ws).neq('status', 'disconnected').order('connected_at', { ascending: false }).limit(1).maybeSingle();
    if (!data) return { enabled: true, connected: false, label: 'Not connected' };
    const expired = data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now();
    const connected = data.status === 'connected' && !expired;
    const photo = await fetch(`${o.graphBase}/${data.page_id}/picture?redirect=false&type=large`).then((r) => r.json()).then((b: any) => b?.data?.url ?? null).catch(() => null);
    return { enabled: true, connected, label: connected ? 'Connected' : 'Reconnect', name: data.ig_username ?? data.page_name, pageName: data.page_name, igUsername: data.ig_username, photoUrl: photo, tokenExpiresAt: data.token_expires_at };
  }

  @Delete('connection') disconnectDelete(@CurrentUser() u: AuthUser, @Param('workspaceId') ws: string) { return this.disconnect(u, ws); }
  @Post('disconnect')
  async disconnect(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) {
    enabled(); await assertMember(user, ws);
    const { error } = await createServiceSupabaseClient().from('meta_connections').delete().eq('workspace_id', ws);
    if (error) throw new BadRequestException('Could not disconnect.');
    return { ok: true, connected: false };
  }
}

/** Facebook redirects here (no bearer token): trust only the signed state. */
@Controller('meta/oauth')
export class MetaOAuthCallbackController {
  private readonly logger = new Logger('MetaOAuth');
  @Get('callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    const o = enabled();
    const done = (result: string) => o.returnUrl ? res.redirect(302, `${o.returnUrl}${o.returnUrl.includes('?') ? '&' : '?'}meta=${result}`) : res.status(result === 'connected' ? 200 : 400).type('text/plain').send(result === 'connected' ? 'Connected. You can close this window.' : `Meta connect failed: ${result}`);
    const s = readState(state, o.stateSecret);
    if (!s) return done('bad_state');
    if (error || !code) return done('cancelled');
    try {
      const r = await exchangeCodeAndListPages(o, code);
      const page = pickPage(r.pages); if (!page) return done('no_pages');
      const db = createServiceSupabaseClient();
      const { error: e } = await db.from('meta_connections').upsert({
        workspace_id: s.w, page_id: page.pageId, page_name: page.pageName, ig_user_id: page.igUserId, ig_username: page.igUsername,
        page_token_enc: encryptToken(page.pageToken, o.tokenKey), user_token_enc: encryptToken(r.userToken, o.tokenKey),
        token_expires_at: null, scopes: META_OAUTH_SCOPES, status: 'connected', connected_by: s.u, connected_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'page_id' });
      if (e) { this.logger.error(`save failed: ${e.message}`); return done('save_failed'); }
      return done('connected');
    } catch (err) { this.logger.error(err instanceof Error ? err.message : 'unknown'); return done('exchange_failed'); }
  }
}
