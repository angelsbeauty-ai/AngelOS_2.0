/**
 * Meta (Instagram + Facebook) settings. Everything is OFF unless the flags are 'true' AND the keys exist.
 *   META_PUBLISHING_ENABLED=true      IG content publishing + FB Page posts
 *   META_MESSAGING_ENABLED=true       IG/FB DM inbox (webhook in)
 *   META_MESSAGING_SEND_ENABLED=true  replies out (separate switch, off even when the inbox is on)
 *   META_APP_SECRET                   verifies X-Hub-Signature-256 on webhooks
 *   META_VERIFY_TOKEN                 webhook subscription handshake
 *   META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_IG_USER_ID
 *   META_GRAPH_VERSION (default v23.0)
 * One studio's account per server for the beta. Per-workspace tokens need a table (migration, not written).
 */
export interface MetaConfig {
  publishingEnabled: boolean; messagingEnabled: boolean; sendEnabled: boolean;
  appSecret?: string; verifyToken?: string; pageId?: string; pageToken?: string; igUserId?: string;
  graphBase: string;
}
const on = (v?: string) => String(v ?? '').trim().toLowerCase() === 'true';
export function readMetaConfig(env: NodeJS.ProcessEnv = process.env): MetaConfig {
  return {
    publishingEnabled: on(env.META_PUBLISHING_ENABLED), messagingEnabled: on(env.META_MESSAGING_ENABLED), sendEnabled: on(env.META_MESSAGING_SEND_ENABLED),
    appSecret: env.META_APP_SECRET?.trim() || undefined, verifyToken: env.META_VERIFY_TOKEN?.trim() || undefined,
    pageId: env.META_PAGE_ID?.trim() || undefined, pageToken: env.META_PAGE_ACCESS_TOKEN?.trim() || undefined, igUserId: env.META_IG_USER_ID?.trim() || undefined,
    graphBase: `https://graph.facebook.com/${env.META_GRAPH_VERSION?.trim() || 'v23.0'}`
  };
}
