/** Meta-Insights-style numbers from stored daily account metrics and post snapshots. Pure: no I/O. */
export interface DailyRow { platform: string; metric_date: string; followers: number | null; engagement: number | null; reach: number | null }
export interface PostRow { variantId: string; platform: string; published_at: string | null; views: number | null; interactions: number | null; post: unknown }
export type MetricKey = 'views' | 'interactions' | 'follows' | 'linkClicks';

export function dayList(endIso: string, days: number): string[] {
  const end = Date.parse(`${endIso}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
}

function seriesFor(rows: DailyRow[], days: string[], metric: MetricKey): Array<number | null> {
  const by = new Map(rows.map((r) => [r.metric_date, r]));
  if (metric === 'follows') {
    const sorted = [...rows].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
    return days.map((d) => {
      const today = by.get(d); if (today?.followers == null) return null;
      const prev = [...sorted].reverse().find((r) => r.metric_date < d && r.followers != null);
      return prev ? Math.max(0, today.followers - (prev.followers as number)) : null;
    });
  }
  if (metric === 'linkClicks') return days.map(() => null);
  return days.map((d) => { const r = by.get(d); const v = metric === 'views' ? r?.reach : r?.engagement; return v == null ? null : v; });
}

const sum = (xs: Array<number | null>) => xs.some((x) => x != null) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export function buildInsights(input: { rows: DailyRow[]; platforms: string[]; today: string; days?: number; linkClicks?: { current: number | null; previous: number | null }; posts: PostRow[] }) {
  const n = input.days ?? 30;
  const cur = dayList(input.today, n);
  const prevDays = dayList(new Date(Date.parse(`${input.today}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10), n);
  const metrics: MetricKey[] = ['views', 'interactions', 'follows', 'linkClicks'];
  const cards = metrics.map((m) => {
    const lines = input.platforms.map((p) => ({ platform: p, points: seriesFor(input.rows.filter((r) => r.platform === p), cur, m) }));
    const prevLines = input.platforms.map((p) => seriesFor(input.rows.filter((r) => r.platform === p), prevDays, m));
    let total = sum(lines.flatMap((l) => l.points)); let previous = sum(prevLines.flat());
    if (m === 'linkClicks') { total = input.linkClicks?.current ?? null; previous = input.linkClicks?.previous ?? null; }
    return { key: m, total, previous, change: pctChange(total, previous), lines: lines.filter((l) => l.points.some((x) => x != null)) };
  });
  const views = cards[0];
  const headline = views.total == null ? null : { metric: 'views', change: views.change, total: views.total };
  const top = (key: 'views' | 'interactions') => [...input.posts].filter((p) => p[key] != null).sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 12)
    .map((p) => ({ variantId: p.variantId, platform: p.platform, published_at: p.published_at, value: p[key] as number, post: p.post }));
  return { days: n, from: cur[0], to: cur[cur.length - 1], cards, headline, top: { views: top('views'), interactions: top('interactions'), follows: [] as unknown[] } };
}
