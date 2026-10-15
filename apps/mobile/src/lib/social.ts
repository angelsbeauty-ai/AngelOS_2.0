import { apiFetch } from './api';
import type { AnalyticsOverview, AnalyticsPostSummary } from './analytics';

export type AccountStatus = 'connected' | 'needs_reconnect' | 'not_connected';
export interface SocialAccount { platform: 'instagram' | 'facebook' | 'line' | 'tiktok'; handle: string | null; status: AccountStatus; tokenExpiresAt: string | null; insights: boolean; detail: string }
export const getSocialAccounts = (ws: string) => apiFetch<SocialAccount[]>(`/workspaces/${ws}/content/accounts`);

export type OverviewWithPosts = AnalyticsOverview & { posts?: AnalyticsPostSummary[] };
export const getSocialOverview = (ws: string, days: number) => apiFetch<OverviewWithPosts>(`/workspaces/${ws}/analytics/overview?days=${days}`);

export interface PostSnapshot { capturedAt: string; [k: string]: number | string | null }
export interface PostInsights { contentPostId: string; variants: Array<{ variantId: string; platform: string; format: string; status: string; publishedAt: string | null; snapshots: PostSnapshot[] }> }
export const getPostInsights = (ws: string, postId: string) => apiFetch<PostInsights>(`/workspaces/${ws}/analytics/posts/${postId}`);

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
export const num = n;
export const interactions = (m: Record<string, unknown> | null | undefined) => (m ? n(m.likes) + n(m.comments) + n(m.saves) + n(m.shares) : 0);

/** One value per local day for the window, oldest first, summed from posts published that day. */
export function dailySeries(posts: AnalyticsPostSummary[], days: number, pick: (p: AnalyticsPostSummary) => number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), value: 0 }));
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const d = new Date(p.publishedAt); const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < days) out[idx].value += pick(p);
  }
  return out;
}

/** 7 days (Mon first) × 8 two-hour slots from 06:00 to 22:00 (earlier/later hours fold into the edge slots), weighted by reach (or 1 per post when reach is missing). */
export function bestTimeGrid(posts: AnalyticsPostSummary[]) {
  const grid = Array.from({ length: 7 }, () => Array<number>(8).fill(0));
  let samples = 0;
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const d = new Date(p.publishedAt); const w = interactions(p.metrics) || n(p.metrics?.reach) || 1;
    grid[(d.getDay() + 6) % 7][Math.min(7, Math.max(0, Math.floor((d.getHours() - 6) / 2)))] += w; samples += 1;
  }
  let best: { day: number; slot: number; v: number } | null = null;
  grid.forEach((row, day) => row.forEach((v, slot) => { if (v > 0 && (!best || v > best.v)) best = { day, slot, v }; }));
  return { grid, samples, best: best as { day: number; slot: number; v: number } | null };
}

/** Change vs the previous half of the series, in %. null when there is nothing to compare. */
export function changePct(values: number[]) {
  const h = Math.floor(values.length / 2); const a = values.slice(0, h).reduce((x, y) => x + y, 0); const b = values.slice(h).reduce((x, y) => x + y, 0);
  if (!a) return null; return ((b - a) / a) * 100;
}

/** Grid reorder rule: content swaps between time slots; the times themselves stay put. Returns the variant updates. */
export function swapSlots<T extends { variantId: string; at: string }>(a: T, b: T) {
  return [{ variantId: a.variantId, scheduledFor: b.at }, { variantId: b.variantId, scheduledFor: a.at }];
}
