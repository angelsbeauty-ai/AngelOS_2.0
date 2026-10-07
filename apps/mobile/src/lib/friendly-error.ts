import { ApiError } from './api';

export type FriendlyContext = { action: 'load' | 'save' | 'send' | 'signin'; thing?: string };
export type FriendlyResult = { title: string; message: string; retry: boolean; kind: 'offline' | 'error' | 'auth' };

export function toFriendly(error: unknown, ctx: FriendlyContext): FriendlyResult {
  if (__DEV__) console.warn(error);
  const status = error instanceof ApiError ? error.status : undefined;
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (status === 0 || error instanceof TypeError) return { title: "You're offline", message: 'Check your connection and try again. Nothing has been lost.', retry: true, kind: 'offline' };
  if (code === 'invalid_credentials') return { title: "That didn't match", message: 'Check your email and password, or tap "Forgot password?".', retry: false, kind: 'auth' };
  if (code === 'email_not_confirmed') return { title: 'Please confirm your email', message: 'Open the email we sent you, then sign in.', retry: false, kind: 'auth' };
  if (code === 'over_email_send_rate_limit') return { title: 'Too many emails', message: 'Please wait a few minutes before asking again.', retry: true, kind: 'auth' };
  if (status === 403) return { title: "This isn't available yet", message: "Your account doesn't have access to this. Nothing has changed.", retry: false, kind: 'error' };
  if (status === 404) return { title: "We couldn't find that", message: 'It may have been removed. Pull down to refresh.', retry: true, kind: 'error' };
  if (status === 409) return { title: 'This changed a moment ago', message: 'Refresh and try again.', retry: true, kind: 'error' };
  if (status === 400 || status === 422) return { title: 'Some details need a look', message: 'Please check the fields and try again.', retry: false, kind: 'error' };
  if (status === 429) return { title: 'Too many tries', message: 'Please wait a minute and try again.', retry: true, kind: 'error' };
  if (status && status >= 500) return { title: 'Something went wrong on our side', message: 'Nothing has been lost. Try again in a moment.', retry: true, kind: 'error' };
  if (ctx.action === 'load') return { title: `We couldn't load your ${ctx.thing ?? 'information'}`, message: 'Check your connection and try again. Nothing has been lost.', retry: true, kind: 'error' };
  if (ctx.action === 'save') return { title: "That didn't save", message: 'We kept what you typed. Try again in a moment.', retry: true, kind: 'error' };
  return { title: 'Something needs attention', message: 'Please try again in a moment.', retry: true, kind: 'error' };
}
