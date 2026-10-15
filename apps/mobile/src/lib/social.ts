import { apiFetch } from './api';

export type SocialPlatform = 'instagram' | 'facebook' | 'line';
export interface SocialAccount {
  platform: SocialPlatform; state: 'connected' | 'needs_reconnect' | 'not_connected';
  name: string | null; handle: string | null; pictureUrl: string | null;
  connectAvailable: boolean; connectPath: string | null;
}
export interface SocialNumber { platform: SocialPlatform; followers: number | null; engagement: number | null; reach: number | null; asOf: string | null; followersChange7d: number | null }

const base = (ws: string) => `/workspaces/${ws}/social`;
export const getSocialAccounts = (ws: string) => apiFetch<{ accounts: SocialAccount[] }>(`${base(ws)}/accounts`).then((r) => r.accounts);
export const connectLineChannel = (ws: string, input: { channelId: string; channelSecret: string; accessToken: string }) =>
  apiFetch<SocialAccount>(`${base(ws)}/line/connect`, { method: 'POST', body: JSON.stringify(input) });
export const getSocialNumbers = (ws: string) => apiFetch<{ connected: SocialPlatform[]; items: SocialNumber[] }>(`${base(ws)}/numbers`);
/** Gordon's Meta login. Only called when the server says it is available (connectPath set). Returns the official login URL. */
export const startMetaConnect = (path: string, platform: 'instagram' | 'facebook') =>
  apiFetch<{ authUrl: string }>(path, { method: 'POST', body: JSON.stringify({ platform }) });
export const PLATFORM_NAME: Record<SocialPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', line: 'LINE' };
