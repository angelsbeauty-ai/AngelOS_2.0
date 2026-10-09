import { ApiError } from './api';
import i18n from '../i18n';

export type FriendlyContext = { action: 'load' | 'save' | 'send' | 'signin'; thing?: string };
export type FriendlyResult = { title: string; message: string; retry: boolean; kind: 'offline' | 'error' | 'auth' };

export function toFriendly(error: unknown, ctx: FriendlyContext): FriendlyResult {
  if (__DEV__) console.warn(error);
  const status = error instanceof ApiError ? error.status : undefined;
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (status === 0 || error instanceof TypeError) return { title: i18n.t('errors.offline'), message: i18n.t('errors.offlineMsg'), retry: true, kind: 'offline' };
  if (code === 'invalid_credentials') return { title: i18n.t('errors.badLogin'), message: i18n.t('errors.badLoginMsg'), retry: false, kind: 'auth' };
  if (code === 'email_not_confirmed') return { title: i18n.t('errors.confirmEmail'), message: i18n.t('errors.confirmEmailMsg'), retry: false, kind: 'auth' };
  if (code === 'over_email_send_rate_limit') return { title: i18n.t('errors.tooManyEmails'), message: i18n.t('errors.tooManyEmailsMsg'), retry: true, kind: 'auth' };
  if (status === 403) return { title: i18n.t('errors.forbidden'), message: i18n.t('errors.forbiddenMsg'), retry: false, kind: 'error' };
  if (status === 404) return { title: i18n.t('errors.notFound'), message: i18n.t('errors.notFoundMsg'), retry: true, kind: 'error' };
  if (status === 409) return { title: i18n.t('errors.conflict'), message: i18n.t('errors.conflictMsg'), retry: true, kind: 'error' };
  if (status === 400 || status === 422) return { title: i18n.t('errors.invalid'), message: i18n.t('errors.invalidMsg'), retry: false, kind: 'error' };
  if (status === 429) return { title: i18n.t('errors.rate'), message: i18n.t('errors.rateMsg'), retry: true, kind: 'error' };
  if (status && status >= 500) return { title: i18n.t('errors.server'), message: i18n.t('errors.serverMsg'), retry: true, kind: 'error' };
  if (ctx.action === 'load') return { title: i18n.t('errors.load', { thing: ctx.thing ?? i18n.t('errors.information') }), message: i18n.t('errors.loadMsg'), retry: true, kind: 'error' };
  if (ctx.action === 'save') return { title: i18n.t('errors.save'), message: i18n.t('errors.saveMsg'), retry: true, kind: 'error' };
  return { title: i18n.t('errors.generic'), message: i18n.t('errors.genericMsg'), retry: true, kind: 'error' };
}
