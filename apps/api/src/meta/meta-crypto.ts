import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

/** AES-256-GCM with a key derived from META_TOKEN_KEY. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
function key(secret = process.env.META_TOKEN_KEY) {
  if (!secret || secret.length < 32) throw new Error('META_TOKEN_KEY is not set (32+ characters).');
  return createHash('sha256').update(secret).digest();
}
export function encryptToken(plain: string, secret?: string): string {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key(secret), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}
export function decryptToken(box: string, secret?: string): string {
  const [v, iv, tag, enc] = box.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Bad token format');
  const d = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

/** OAuth state: signed, expiring, ties the callback to one studio + user. */
export function signState(data: { w: string; u: string; r?: string }, secret: string, ttlSec = 600, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...data, e: Math.floor(now / 1000) + ttlSec, n: randomBytes(6).toString('hex') })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function readState(state: string | undefined, secret: string, now = Date.now()): { w: string; u: string; r?: string } | null {
  if (!state) return null;
  const [body, sig] = state.split('.'); if (!body || !sig) return null;
  const want = createHmac('sha256', secret).update(body).digest();
  let got: Buffer; try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { const d = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return d.e * 1000 > now ? { w: d.w, u: d.u, r: d.r } : null; } catch { return null; }
}
