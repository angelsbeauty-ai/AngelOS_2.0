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
    const { data, error } = await createServiceSupabaseClient().from('meta_connections').select('page_id,page_name,ig_user_id,page_token_enc,status,token_expires_at').eq('workspace_id', workspaceId).neq('status', 'disconnected').order('connected_at', { ascending: false }).limit(1);
    if (error) return base;
    row = data?.[0] ?? null;
  } catch { return base; }
  if (!row) return base;
  if ((row.status !== 'connected' && row.status !== 'needs_reconnect') || !row.page_token_enc) return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
  try {
    const cfg: MetaConfig = { ...base, pageId: row.page_id, igUserId: row.ig_user_id ?? undefined, pageToken: decryptToken(row.page_token_enc), tokenExpiresAt: row.token_expires_at ?? undefined };
    return guardPageBrand(cfg, row.page_name);
  } catch {
    return { ...base, pageToken: undefined, pageId: undefined, igUserId: undefined };
  }
}

/** AngelOS never posts or messages as another brand's Facebook Page (Angel's Beauty Academy is a separate brand). */
export function isOtherBrandPage(pageName: unknown): boolean {
  return /academy|アカデミー/i.test(String(pageName ?? ''));
}

/** Keeps Instagram (its own account) usable but switches Facebook Page send/publish off for another brand's Page. */
export function guardPageBrand(cfg: MetaConfig, pageName: unknown): MetaConfig {
  if (!isOtherBrandPage(pageName)) return cfg;
  return { ...cfg, pageId: undefined, pageBlockedReason: 'The connected Facebook Page is the Academy Page. Reconnect Meta and choose the Angels Beauty studio Page.' };
}
