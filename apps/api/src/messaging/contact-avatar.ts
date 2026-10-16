import { createServiceSupabaseClient } from '../config/supabase';

/**
 * Best-effort: store a contact's profile photo on the thread when it has none (or was checked >7 days ago).
 * Tolerates the column not existing yet (migration 0024 not applied): it just does nothing.
 */
export async function saveContactAvatar(threadId: string, fetchUrl: () => Promise<string | null | undefined>) {
  try {
    const db = createServiceSupabaseClient();
    const { data, error } = await db.from('message_threads').select('contact_avatar_url,contact_avatar_checked_at').eq('id', threadId).maybeSingle();
    if (error || !data) return;
    const fresh = data.contact_avatar_checked_at && Date.now() - new Date(data.contact_avatar_checked_at).getTime() < 7 * 86400000;
    if (data.contact_avatar_url && fresh) return;
    if (!data.contact_avatar_url && fresh) return;
    const url = await fetchUrl();
    await db.from('message_threads').update({ contact_avatar_url: url || data.contact_avatar_url || null, contact_avatar_checked_at: new Date().toISOString() }).eq('id', threadId);
  } catch { /* photo is optional */ }
}

