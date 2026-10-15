/**
 * AI model switch + per-user caps. OFF unless AI_NEXT_MODEL_ENABLED=true (nothing changes in prod by default).
 *   AI_NEXT_MODEL            model to switch to (default gpt-6-luna)
 *   AI_NEXT_MODEL_ENABLED    'true' to use it; otherwise OPENAI_MODEL / gpt-5.6-terra as before
 *   AI_DAILY_CAP_PER_USER    max next-model calls per user per day (default 50)
 *   AI_MONTHLY_CAP_PER_USER  max next-model calls per user per month (default 600)
 * When a user hits a cap we fall back to the current model rather than failing.
 * Counts are kept in memory per API instance (no DB table / migration). A shared store is needed before multi-instance rollout.
 */
export interface ModelChoice { model: string; reason: 'default' | 'next' | 'daily_cap' | 'monthly_cap' | 'no_user' }

const usage = new Map<string, { day: string; month: string; daily: number; monthly: number }>();

function capFrom(name: string, fallback: number) { const n = Number(process.env[name]); return Number.isFinite(n) && n >= 0 ? n : fallback; }

export function chooseModel(userId: string | undefined, now = new Date(), env = process.env): ModelChoice {
  const base = env.OPENAI_MODEL ?? 'gpt-5.6-terra';
  if (env.AI_NEXT_MODEL_ENABLED !== 'true') return { model: base, reason: 'default' };
  if (!userId) return { model: base, reason: 'no_user' };
  const day = now.toISOString().slice(0, 10); const month = day.slice(0, 7);
  const u = usage.get(userId);
  const rec = !u ? { day, month, daily: 0, monthly: 0 } : { day, month, daily: u.day === day ? u.daily : 0, monthly: u.month === month ? u.monthly : 0 };
  if (rec.monthly >= capFrom('AI_MONTHLY_CAP_PER_USER', 600)) { usage.set(userId, rec); return { model: base, reason: 'monthly_cap' }; }
  if (rec.daily >= capFrom('AI_DAILY_CAP_PER_USER', 50)) { usage.set(userId, rec); return { model: base, reason: 'daily_cap' }; }
  rec.daily += 1; rec.monthly += 1; usage.set(userId, rec);
  return { model: env.AI_NEXT_MODEL || 'gpt-6-luna', reason: 'next' };
}

export function resetModelUsage() { usage.clear(); }
