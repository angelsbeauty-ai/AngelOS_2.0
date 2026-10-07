import { router } from 'expo-router';
import { supabase } from './supabase';

let handling = false;
let signedOutReason: 'expired' | null = null;

export async function handleSessionExpired() {
  if (handling) return;
  handling = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      signedOutReason = 'expired';
      await supabase.auth.signOut({ scope: 'local' });
    }
    router.replace('/login');
  } finally {
    handling = false;
  }
}

export function consumeSignedOutReason() {
  const reason = signedOutReason;
  signedOutReason = null;
  return reason;
}
