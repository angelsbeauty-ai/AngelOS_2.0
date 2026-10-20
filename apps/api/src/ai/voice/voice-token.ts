import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived, workspace-scoped voice token (replaces Angel's login token in the LiveKit metadata).
 * HMAC-SHA256, 10 minutes, scope "voice:read+draft": it can call the shared read tools and save a reply DRAFT
 * for one studio, nothing else. No new dependency.
 */
export const VOICE_SCOPE = 'voice:read+draft';
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const secret = () => process.env.VOICE_TOKEN_SECRET || process.env.LIVEKIT_API_SECRET || '';

export interface VoiceClaims { sub: string; ws: string; scope: string; exp: number }

export function mintVoiceToken(userId: string, workspaceId: string, ttlSeconds = 600, now = Date.now(), key = secret()): string {
  if (!key) throw new Error('Voice token secret is not configured');
  const body = b64(JSON.stringify({ sub: userId, ws: workspaceId, scope: VOICE_SCOPE, exp: Math.floor(now / 1000) + ttlSeconds } satisfies VoiceClaims));
  return `av1.${body}.${b64(createHmac('sha256', key).update(body).digest())}`;
}

export function verifyVoiceToken(token: string | undefined, workspaceId: string, now = Date.now(), key = secret()): VoiceClaims | null {
  if (!token || !key) return null;
  const [v, body, sig] = token.split('.');
  if (v !== 'av1' || !body || !sig) return null;
  const want = createHmac('sha256', key).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as VoiceClaims;
    if (c.scope !== VOICE_SCOPE || c.ws !== workspaceId || !c.sub || c.exp * 1000 <= now) return null;
    return c;
  } catch { return null; }
}
