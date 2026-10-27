import { createClient } from '@supabase/supabase-js';

/**
 * Supabase "sb_secret_" / publishable keys are swapped for a short-lived JWT at Supabase's gateway on every request.
 * When the gateway clock is a moment ahead of the database API, the database answers 401 "JWT issued at future"
 * (seen on the 5-minute publish cron). It is a clock skew on Supabase's side, so wait a moment and send the same request once more.
 */
export const skewSafeFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status !== 401 && res.status !== 403) return res;
  const body = await res.clone().text().catch(() => '');
  if (!/issued at future/i.test(body)) return res;
  await new Promise((r) => setTimeout(r, 1500));
  return fetch(input, init);
};

export function createServiceSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(url, serviceRoleKey, {
    global: { fetch: skewSafeFetch },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function createUserSupabaseClient(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const clientKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !clientKey) {
    throw new Error('SUPABASE_URL and a publishable/anon client key are required');
  }

  return createClient(url, clientKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` }, fetch: skewSafeFetch },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
