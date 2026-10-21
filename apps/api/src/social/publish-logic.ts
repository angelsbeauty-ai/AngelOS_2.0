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
export function publishErrorOf(variant: { status?: string; attempts?: Array<{ status?: string | null; error_message?: string | null }> | null }): { publish_error: string | null; needs_check: boolean } {
  const a = (variant.attempts ?? [])[0];
  if (!a || variant.status !== 'failed') return { publish_error: null, needs_check: false };
  return { publish_error: a.error_message ?? null, needs_check: a.status === 'unknown' };
}


/** Try again / Publish now: never re-send a post that may already be live. */
export function retryDecision(variant: { provider_post_id?: string | null }, previous: { status?: string | null } | null | undefined, confirmNotPosted: boolean): 'already_published' | 'needs_check' | 'publish' {
  if (previous?.status === 'published' || variant.provider_post_id) return 'already_published';
  if (previous?.status === 'unknown' && !confirmNotPosted) return 'needs_check';
  return 'publish';
}
