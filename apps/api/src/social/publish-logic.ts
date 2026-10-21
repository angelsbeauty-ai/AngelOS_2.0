/** Pure publishing decisions, shared by the 5-minute job and Publish now. */
export const NAMES: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', threads: 'Threads' };

export type DueAction = 'already_published' | 'needs_check' | 'postiz_scheduled' | 'publish';
/**
 * What the 5-minute job does with a due variant. It never calls a publisher twice:
 * - Postiz already holds the post (provider_post_id set at schedule time) → Postiz posts it; we only record it.
 * - A Meta attempt that was never confirmed ('unknown') → needs a human check, never an automatic re-post.
 */
export function dueAction(route: string, variant: { provider_post_id?: string | null }, previous?: { status?: string | null } | null): DueAction {
  if (previous?.status === 'published') return 'already_published';
  if (previous?.status === 'unknown') return 'needs_check';
  if (route === 'postiz' && variant.provider_post_id) return 'postiz_scheduled';
  return 'publish';
}

export const NEEDS_CHECK_REASON = (platform: string) => `${NAMES[platform] ?? platform} didn't confirm the post, so it may already be live. Check the app first. If it's there, tap Mark as posted; if not, tap Try again.`;

/** The latest failure reason and whether it needs a check, from the variant's publish attempts. */
export function publishErrorOf(variant: { status?: string; attempts?: Array<{ status?: string | null; error_message?: string | null }> | null }): { publish_error: string | null; publish_error_code: PublishErrorCode | null; needs_check: boolean } {
  const a = (variant.attempts ?? [])[0];
  if (!a || variant.status !== 'failed') return { publish_error: null, publish_error_code: null, needs_check: false };
  return { publish_error: a.error_message ?? null, publish_error_code: a.status === 'unknown' ? 'needs_check' : publishErrorCodeOf(a.error_message), needs_check: a.status === 'unknown' };
}


/** Try again / Publish now: never re-send a post that may already be live. */
export function retryDecision(variant: { provider_post_id?: string | null }, previous: { status?: string | null } | null | undefined, confirmNotPosted: boolean): 'already_published' | 'needs_check' | 'publish' {
  if (previous?.status === 'published' || variant.provider_post_id) return 'already_published';
  if (previous?.status === 'unknown' && !confirmNotPosted) return 'needs_check';
  return 'publish';
}

export type PublishErrorCode = 'needs_check' | 'not_connected' | 'manual_only' | 'no_marketing_permission' | 'line_broadcast_failed' | 'token_expired' | 'rate_limited' | 'media_invalid' | 'stopped_unexpectedly' | 'generic';

/** A stable code for a stored failure reason so the app can show it in the user's language. Unknown text gives null (the app shows the text). */
export function publishErrorCodeOf(message: string | null | undefined): PublishErrorCode | null {
  const m = String(message ?? '').toLowerCase();
  if (!m) return null;
  if (m.includes("isn't connected")) return 'not_connected';
  if (m.includes("can't post to") && m.includes('automatically')) return 'manual_only';
  if (m.includes('marketing permission')) return 'no_marketing_permission';
  if (m.includes('line broadcast failed')) return 'line_broadcast_failed';
  if (/token|expired|oauth|session has been invalidated|re-?connect/.test(m)) return 'token_expired';
  if (/rate limit|too many|429/.test(m)) return 'rate_limited';
  if (/media|image|video|aspect ratio|file type|unsupported format/.test(m)) return 'media_invalid';
  if (m.includes('stopped unexpectedly')) return 'stopped_unexpectedly';
  if (m === "it didn't post. tap try again.") return 'generic';
  return null;
}
