import { HttpException, HttpStatus } from '@nestjs/common';
import { createServiceSupabaseClient } from '../config/supabase';
import { currentRequest } from '../common/request-context';

/**
 * AI credit meter: every AI call by a signed-in user counts as one use.
 * Stored in the existing product_usage_events table (feature 'ai', action_key 'ai_call'; no new migration).
 * Limits: AI_DAILY_LIMIT (default 50) and AI_MONTHLY_LIMIT (default 600) per user, in Japan time.
 */
export const limits = () => ({ daily: num('AI_DAILY_LIMIT', 50), monthly: num('AI_MONTHLY_LIMIT', 600) });
export const costPerUseUsd = () => num('AI_EST_COST_PER_CALL_USD', 0.01);
function num(name: string, fallback: number) { const n = Number(process.env[name]); return Number.isFinite(n) && n >= 0 ? n : fallback; }

/** Start of today and of this month in Japan time, as UTC ISO strings. */
export function jstBounds(now = new Date()) {
  const l = new Date(now.getTime() + 9 * 3600000);
  const day = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - 9 * 3600000;
  const month = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - 9 * 3600000;
  return { day: new Date(day).toISOString(), month: new Date(month).toISOString() };
}

export function limitState(today: number, month: number, lim = limits()) {
  const reason = month >= lim.monthly ? 'monthly' : today >= lim.daily ? 'daily' : null;
  return { today, month, dailyLimit: lim.daily, monthlyLimit: lim.monthly, limited: reason !== null, reason,
    message: reason === 'monthly' ? `You have used all ${lim.monthly} AI uses for this month. They reset on the 1st.` : reason === 'daily' ? `You have used all ${lim.daily} AI uses for today. They reset at midnight (Japan time).` : null };
}

export async function usageFor(userId: string, now = new Date()) {
  const db = createServiceSupabaseClient(); const b = jstBounds(now);
  const q = (since: string) => db.from('product_usage_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', 'ai').eq('action_key', 'ai_call').gte('created_at', since);
  const [d, m] = await Promise.all([q(b.day), q(b.month)]);
  if (d.error || m.error) return null; // meter unavailable: do not block
  return limitState(d.count ?? 0, m.count ?? 0);
}

/** Called before every AI call. Throws a friendly 429 when the user is over a limit. */
export async function assertAiAllowed(userId = currentRequest().userId) {
  if (!userId || process.env.NODE_ENV === 'test') return;
  const u = await usageFor(userId).catch(() => null);
  if (u?.limited) throw new HttpException({ statusCode: 429, code: 'ai_limit', message: u.message }, HttpStatus.TOO_MANY_REQUESTS);
}

export async function recordAiUse(outcome: string, ctx = currentRequest()) {
  if (!ctx.userId || !ctx.workspaceId || process.env.NODE_ENV === 'test') return;
  try { await createServiceSupabaseClient().from('product_usage_events').insert({ workspace_id: ctx.workspaceId, user_id: ctx.userId, event_name: 'feature_used', feature: 'ai', action_key: 'ai_call', outcome: outcome.slice(0, 60) }); } catch { /* meter is best-effort */ }
}
