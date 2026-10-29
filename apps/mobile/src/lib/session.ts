import { useEffect, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { supabase } from './supabase';
import { clearMe } from './me';

let handling = false;
let signedOutReason: 'expired' | null = null;
let currentPath = '/';

/** Screens a signed-out visitor may stay on. Anything else bounces to /login on a 401. */
export const PUBLIC_PATH = /^\/(login|signup|sign-up|register|forgot-password|reset-password|privacy|terms|help)(\/|$)/;
export const isPublicPath = (path: string) => PUBLIC_PATH.test(path || '/');

/** Mounted once in the root layout so non-React code knows which screen is showing. */
export function PathTracker() {
  const pathname = usePathname();
  useEffect(() => { currentPath = pathname || '/'; }, [pathname]);
  return null;
}

/** A real session stopped working: sign out locally, forget the saved profile, go to /login. */
export async function handleSessionExpired() {
  if (handling) return;
  handling = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      signedOutReason = 'expired';
      await supabase.auth.signOut({ scope: 'local' });
    }
    clearMe();
    router.replace('/login');
  } finally {
    handling = false;
  }
}

/** A 401 with no token at all: signed out. Public screens (login, signup, password reset) stay put. */
export function handleSignedOut401() {
  clearMe();
  if (handling || isPublicPath(currentPath)) return;
  router.replace('/login');
}

export async function hasSession() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.access_token);
}

/** null while the stored session is still loading, then true / false (follows sign in / sign out). */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => { if (live) setSignedIn(Boolean(data.session)); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (live) setSignedIn(Boolean(s)); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}

export function consumeSignedOutReason() {
  const reason = signedOutReason;
  signedOutReason = null;
  return reason;
}
