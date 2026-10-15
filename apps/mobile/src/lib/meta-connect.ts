import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getSocialAccounts, startMetaConnect, type SocialPlatform } from './social';

/** A reconnect problem in plain words, shown inline with a Retry button (never swallowed). */
export class ReconnectError extends Error {
  constructor(message: string, readonly kind: 'login_off' | 'line' | 'failed' = 'failed') { super(message); }
}

/** Where the Meta login comes back to on a phone: this build's own scheme (angelos / angelos-staging / angelos-dev). */
export const nativeReturnUrl = () => Linking.createURL('/content/accounts');

/**
 * Start the Meta (Facebook / Instagram) login.
 * Web: same tab (the API callback sends the browser back to META_OAUTH_RETURN_URL).
 * Native: in-app browser that closes on this build's scheme.
 * Returns 'redirected' (web, page is leaving), 'returned' (native, came back) or 'cancelled'.
 */
export async function startReconnect(workspaceId: string, provider: SocialPlatform): Promise<'redirected' | 'returned' | 'cancelled'> {
  if (provider === 'line') throw new ReconnectError('LINE is not connected through Facebook. Open LINE setup to check the Channel keys and the webhook.', 'line');
  let acc;
  try { acc = (await getSocialAccounts(workspaceId)).find((a) => a.platform === provider); }
  catch (e) { throw new ReconnectError(`Could not reach AngelOS to start the login: ${e instanceof Error ? e.message : 'network error'}`); }
  if (!acc?.connectPath) throw new ReconnectError('Facebook login is turned off on the server.', 'login_off');
  let authUrl: string;
  try { authUrl = (await startMetaConnect(acc.connectPath, provider)).authUrl; }
  catch (e) { throw new ReconnectError(`The server could not start the Facebook login: ${e instanceof Error ? e.message : 'unknown error'}`); }
  if (!authUrl) throw new ReconnectError('The server did not return a Facebook login address.');
  if (Platform.OS === 'web') { window.location.assign(authUrl); return 'redirected'; }
  const r = await WebBrowser.openAuthSessionAsync(authUrl, nativeReturnUrl());
  return r.type === 'success' ? 'returned' : 'cancelled';
}

/** ?meta=... codes from the API callback, in plain English. */
export function metaResultText(code: string): string {
  switch (code) {
    case 'connected': return 'Connected.';
    case 'missing_messaging': return 'Connected, but Meta did not give permission to read messages. Tap Reconnect and leave every box ticked.';
    case 'cancelled': return 'The Facebook login was cancelled.';
    case 'no_pages': return 'This Facebook login has no Pages. Sign in with the account that manages your studio Page.';
    case 'page_taken': return 'This Facebook Page is already connected to another studio.';
    case 'bad_state': return 'The login link expired. Please try again.';
    case 'exchange_failed': return 'Facebook did not finish the login. Please try again.';
    case 'save_failed': return 'The login worked but AngelOS could not save it. Please try again.';
    default: return `Facebook login did not finish (${code}).`;
  }
}
