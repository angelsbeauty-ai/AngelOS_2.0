/**
 * Short-lived, server-side holding area for the Page list after a Meta login with more than one Page.
 * In memory only (never the DB); page/user tokens stay AES-GCM encrypted; entries expire after 15 minutes
 * and are tied to one studio + the user who signed in.
 */
export interface PendingPage { pageId: string; pageName: string | null; pictureUrl: string | null; igUserId: string | null; igUsername: string | null; igPictureUrl: string | null; pageTokenEnc: string }
export interface PendingChoice { workspaceId: string; userId: string; userTokenEnc: string; pages: PendingPage[]; grantedScopes?: string[] | null; expiresAt: number }

export const PENDING_TTL_MS = 15 * 60 * 1000;
const store = new Map<string, PendingChoice>();
const k = (w: string, u: string) => `${w}:${u}`;

export function putPending(c: Omit<PendingChoice, 'expiresAt'>, now = Date.now()): PendingChoice {
  for (const [key, v] of store) if (v.expiresAt <= now) store.delete(key);
  const v = { ...c, expiresAt: now + PENDING_TTL_MS }; store.set(k(c.workspaceId, c.userId), v); return v;
}
export function getPending(w: string, u: string, now = Date.now()): PendingChoice | null {
  const v = store.get(k(w, u)); if (!v) return null;
  if (v.expiresAt <= now) { store.delete(k(w, u)); return null; }
  return v;
}
export function clearPending(w: string, u: string) { store.delete(k(w, u)); }
/** What the app may see: no tokens. */
export function publicPages(c: PendingChoice) { return c.pages.map(({ pageTokenEnc: _t, ...p }) => p); }
