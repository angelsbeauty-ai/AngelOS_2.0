import { readMetaConfig, type MetaConfig } from './meta.config';
import { metaPublishingReady } from './meta-publishing.adapter';

export type SocialAccountStatus = 'connected' | 'needs_reconnect' | 'not_connected';
export interface SocialAccount { platform: 'instagram' | 'facebook' | 'line' | 'tiktok'; handle: string | null; status: SocialAccountStatus; tokenExpiresAt: string | null; insights: boolean; detail: string }

/** Meta long-lived tokens last ~60 days. Within this window (or past it) the account shows "Reconnect". */
export const META_RECONNECT_WINDOW_DAYS = 7;

/**
 * Account status for the Social home row, from the EXISTING Meta flags only (no OAuth here).
 * connected = publishing switched on with keys; needs_reconnect = keys present but token expired / about to expire.
 */
export function metaAccountStatus(platform: 'instagram' | 'facebook', c: MetaConfig = readMetaConfig(), now = new Date()): SocialAccount {
  const ready = metaPublishingReady(platform, c);
  const exp = c.tokenExpiresAt && !Number.isNaN(Date.parse(c.tokenExpiresAt)) ? new Date(c.tokenExpiresAt) : null;
  const base = { platform, handle: null, tokenExpiresAt: exp ? exp.toISOString() : null, insights: false } as const;
  if (!ready) return { ...base, status: 'not_connected', detail: 'Not connected yet. Needs Meta setup and App Review.' };
  if (exp && exp.getTime() - now.getTime() < META_RECONNECT_WINDOW_DAYS * 86400000) {
    return { ...base, status: 'needs_reconnect', detail: exp.getTime() <= now.getTime() ? 'The Meta sign-in expired. Reconnect to keep posting.' : 'The Meta sign-in expires soon. Reconnect to keep posting.' };
  }
  return { ...base, status: 'connected', detail: 'Connected.' };
}
