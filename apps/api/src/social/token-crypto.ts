import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for per-studio channel secrets (LINE). Key: SOCIAL_TOKEN_KEY (any long random string;
 * hashed to 32 bytes). Without the key, nothing is stored and the API says so.
 * Format: v1.<iv b64>.<tag b64>.<cipher b64>
 */
function key(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.SOCIAL_TOKEN_KEY?.trim();
  return raw && raw.length >= 16 ? createHash('sha256').update(raw).digest() : null;
}
export const tokenKeyReady = (env: NodeJS.ProcessEnv = process.env) => key(env) !== null;

export function sealToken(plain: string, env: NodeJS.ProcessEnv = process.env): string {
  const k = key(env); if (!k) throw new Error('SOCIAL_TOKEN_KEY is not set');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function openToken(sealed: string, env: NodeJS.ProcessEnv = process.env): string {
  const k = key(env); if (!k) throw new Error('SOCIAL_TOKEN_KEY is not set');
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Unknown token format');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}
