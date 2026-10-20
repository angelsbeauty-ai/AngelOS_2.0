import { createServiceSupabaseClient } from '../config/supabase';
import { decryptToken } from './meta-crypto';
import { readMetaConfig, type MetaConfig } from './meta.config';

/**
 * The studio's own Page/IG token from meta_connections. Env keys are used only when the studio
 * has no connection row (single-studio beta). A disconnected or unreadable row means no token.
 */
export async function metaConfigForWorkspace(workspaceId: string): Promise<MetaConfig> {
  const base = readMetaConfig();
  let row: any = null;
  try {
    const { data, error } = await createServiceSupabaseClient().from('meta_connections').select('page_id,ig_user_id,page_token_enc,status,token_expires_at').eq('workspace_id', workspaceId).neq('status', 'disconnected').order('connected_at', { ascending: false }).limit(1);
    if (error) return base;
    row = data?.[0] ?? null;
  } catch { return base; }
  if (!row) return base;
  if ((row.status !== 'connected' && row.status !== 'needs_reconnect') || !row.page_token_enc) return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
  try {
    return { ...base, pageId: row.page_id, igUserId: row.ig_user_id ?? undefined, pageToken: decryptToken(row.page_token_enc), tokenExpiresAt: row.token_expires_at ?? undefined };
  } catch {
    return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
  }
}
