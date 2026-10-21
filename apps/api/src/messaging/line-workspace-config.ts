import { createServiceSupabaseClient } from '../config/supabase';
import { openToken, tokenKeyReady } from '../social/token-crypto';
import { readLineConfig, type LineConfig } from './line-messaging.adapter';

/** Turns a line_connections row into the studio's own bot credentials. Falls back to the server-wide env bot. */
export function lineConfigFromRow(row: any, base: LineConfig = readLineConfig(), open: (v: string) => string = openToken): LineConfig {
  if (!row || row.status !== 'connected' || !row.access_token_enc) return base;
  try {
    return { enabled: true, channelSecret: row.channel_secret_enc ? open(row.channel_secret_enc) : base.channelSecret ?? 'unused-for-send', channelAccessToken: open(row.access_token_enc), apiBase: 'https://api.line.me' };
  } catch { return base; }
}

/**
 * The studio's own LINE bot (connected in the app). Sending used only the env bot before, so a studio that
 * connected LINE in the app got "LINE is not connected" or a 401 from the LINE push API.
 */
export async function lineConfigForWorkspace(workspaceId: string): Promise<LineConfig> {
  const base = readLineConfig();
  if (!tokenKeyReady()) return base;
  try {
    const { data, error } = await createServiceSupabaseClient().from('line_connections').select('status,channel_secret_enc,access_token_enc').eq('workspace_id', workspaceId).eq('status', 'connected').maybeSingle();
    if (error) return base;
    return lineConfigFromRow(data, base);
  } catch { return base; }
}
