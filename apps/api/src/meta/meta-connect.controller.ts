import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Logger, NotFoundException, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { encryptToken, readState, signState } from './meta-crypto';
import { clearPending, getPending, publicPages, putPending } from './meta-pending';
import { triggerWorkspaceSync } from '../sync/social-sync.service';
import { META_OAUTH_SCOPES, buildMetaLoginUrl, exchangeCodeAndListPages, fetchGrantedScopes, missingMessagingScopes, readMetaOAuthConfig } from './meta-oauth';

function enabled() { const o = readMetaOAuthConfig(); if (!o) throw new NotFoundException(); return o; }
async function assertMember(user: AuthUser, workspaceId: string) {
  const { data } = await createUserSupabaseClient(user.accessToken).from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
  if (!data) throw new ForbiddenException();
}

/** Save one Page for a studio. Reconnect replaces: other Pages of this studio are removed; the same Page is updated in place. */
export async function saveMetaConnection(ws: string, userId: string, page: { pageId: string; pageName: string | null; igUserId: string | null; igUsername: string | null; pageTokenEnc: string }, userTokenEnc: string, grantedScopes: string[] | null = null) {
  const db = createServiceSupabaseClient();
  const { data: other } = await db.from('meta_connections').select('workspace_id').eq('page_id', page.pageId).maybeSingle();
  if (other && other.workspace_id !== ws) return 'page_taken';
  const del = await db.from('meta_connections').delete().eq('workspace_id', ws).neq('page_id', page.pageId);
  if (del.error) return 'save_failed';
  const now = new Date().toISOString();
  const { error } = await db.from('meta_connections').upsert({
    workspace_id: ws, page_id: page.pageId, page_name: page.pageName, ig_user_id: page.igUserId, ig_username: page.igUsername,
    page_token_enc: page.pageTokenEnc, user_token_enc: userTokenEnc,
    token_expires_at: null, scopes: grantedScopes ?? [], status: missingMessagingScopes(grantedScopes).length ? 'needs_reconnect' : 'connected', connected_by: userId, connected_at: now, updated_at: now
  }, { onConflict: 'page_id' });
  if (error) return 'save_failed';
  triggerWorkspaceSync(ws); // import conversations + recent posts right away (read only)
  return 'connected';
}

/** Per-studio Meta connect. 404 unless META_OAUTH_ENABLED + META_APP_ID/SECRET + META_OAUTH_REDIRECT_URI + META_TOKEN_KEY. */
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

  /** What the app calls (Accounts screen): POST returns { authUrl } to open in the in-app browser. */
  @Post('connect')
  async connectPost(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) {
    const o = enabled(); await assertMember(user, ws);
    const authUrl = buildMetaLoginUrl(o, signState({ w: ws, u: user.id }, o.stateSecret));
    return { authUrl, url: authUrl, scopes: META_OAUTH_SCOPES };
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

  /** After ?meta=choose: the Pages from the last login (no tokens). */
  @Get('pending-pages')
  async pendingPages(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) {
    enabled(); await assertMember(user, ws);
    const p = getPending(ws, user.id);
    return { pages: p ? publicPages(p) : [], expiresAt: p ? new Date(p.expiresAt).toISOString() : null };
  }

  @Post('select-page')
  async selectPage(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() body: { pageId?: string }) {
    enabled(); await assertMember(user, ws);
    const p = getPending(ws, user.id);
    if (!p) throw new BadRequestException('The Page list expired. Please connect again.');
    const page = p.pages.find((x) => x.pageId === String(body?.pageId ?? ''));
    if (!page) throw new BadRequestException('Unknown Page.');
    const r = await saveMetaConnection(ws, user.id, page, p.userTokenEnc, p.grantedScopes ?? null);
    if (r === 'page_taken') throw new BadRequestException('This Page is already connected to another studio.');
    if (r !== 'connected') throw new BadRequestException('Could not save the Page.');
    clearPending(ws, user.id);
    return { ok: true, connected: true, pageName: page.pageName, igUsername: page.igUsername };
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
    const done = (result: string) => o.returnUrl ? res.redirect(302, `${o.returnUrl}${o.returnUrl.includes('?') ? '&' : '?'}meta=${result}`) : res.status(result === 'connected' || result === 'choose' ? 200 : 400).type('text/plain').send(result === 'choose' ? 'Choose your Page in the AngelOS app.' : result === 'connected' ? 'Connected. You can close this window.' : `Meta connect failed: ${result}`);
    const s = readState(state, o.stateSecret);
    if (!s) return done('bad_state');
    if (error || !code) return done('cancelled');
    try {
      const r = await exchangeCodeAndListPages(o, code);
      if (!r.pages.length) return done('no_pages');
      const granted = await fetchGrantedScopes(o, r.userToken);
      const userTokenEnc = encryptToken(r.userToken, o.tokenKey);
      const pages = r.pages.map(({ pageToken, ...p }) => ({ ...p, pageTokenEnc: encryptToken(pageToken, o.tokenKey) }));
      if (pages.length > 1) { putPending({ workspaceId: s.w, userId: s.u, userTokenEnc, pages, grantedScopes: granted }); return done('choose'); }
      const saved = await saveMetaConnection(s.w, s.u, pages[0], userTokenEnc, granted);
      if (saved !== 'connected') { this.logger.error(`save failed: ${saved}`); return done(saved); }
      return done(missingMessagingScopes(granted).length ? 'missing_messaging' : 'connected');
    } catch (err) { this.logger.error(err instanceof Error ? err.message : 'unknown'); return done('exchange_failed'); }
  }
}
