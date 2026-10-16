/** Meta-Insights-style numbers from stored daily account metrics and post snapshots. Pure: no I/O. */
export interface DailyRow { platform: string; metric_date: string; followers: number | null; engagement: number | null; reach: number | null }
export interface PostRow { variantId: string; platform: string; published_at: string | null; views: number | null; interactions: number | null; post: unknown }
export type MetricKey = 'views' | 'interactions' | 'follows' | 'linkClicks';

export function dayList(endIso: string, days: number): string[] {
  const end = Date.parse(`${endIso}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
}

/* Stored account rows are SNAPSHOTS (followers count; likes+comments on the latest posts), never per-day amounts,
   so they are never summed: snapshot metrics use the latest value in the window, follows use the net follower gain. */
const lastIn = (rows: DailyRow[], days: string[], k: 'followers' | 'engagement') => { const set = new Set(days); const xs = rows.filter((r) => set.has(r.metric_date) && r[k] != null).sort((a, b) => a.metric_date.localeCompare(b.metric_date)); return xs.length ? { first: xs[0][k] as number, last: xs[xs.length - 1][k] as number, n: xs.length } : null; };
function levelSeries(rows: DailyRow[], days: string[], k: 'followers' | 'engagement'): Array<number | null> { const by = new Map(rows.map((r) => [r.metric_date, r[k]])); return days.map((d) => by.get(d) ?? null); }
function gainSeries(rows: DailyRow[], days: string[]): Array<number | null> {
  const sorted = rows.filter((r) => r.followers != null).sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  return days.map((d) => { const t = sorted.find((r) => r.metric_date === d); const p = [...sorted].reverse().find((r) => r.metric_date < d); return t && p ? (t.followers as number) - (p.followers as number) : null; });
}
function postSeries(posts: PostRow[], days: string[], k: 'views' | 'interactions'): Array<number | null> { return days.map((d) => { const xs = posts.filter((p) => p.published_at?.slice(0, 10) === d && p[k] != null); return xs.length ? xs.reduce((s, p) => s + (p[k] as number), 0) : 0; }); }
const postSum = (posts: PostRow[], days: string[], k: 'views' | 'interactions') => { const set = new Set(days); const xs = posts.filter((p) => p.published_at && set.has(p.published_at.slice(0, 10)) && p[k] != null); return xs.length ? xs.reduce((s, p) => s + (p[k] as number), 0) : null; };
const add = (a: number | null, b: number | null) => a == null ? b : b == null ? a : a + b;
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
  const byP = (p: string) => input.rows.filter((r) => r.platform === p);
  const postsP = (p: string) => input.posts.filter((x) => x.platform === p);
  const cards = metrics.map((m) => {
    let total: number | null = null, previous: number | null = null; let lines: Array<{ platform: string; points: Array<number | null> }> = [];
    for (const p of input.platforms) {
      if (m === 'views' || m === 'interactions') {
        // Per-post numbers (views / likes+comments+saves+shares) summed by publish date: no double counting.
        let c = postSum(postsP(p), cur, m), pr = postSum(postsP(p), prevDays, m);
        let pts = c == null ? null : postSeries(postsP(p), cur, m);
        if (m === 'interactions' && c == null) { const a = lastIn(byP(p), cur, 'engagement'), b = lastIn(byP(p), prevDays, 'engagement'); c = a?.last ?? null; pr = b?.last ?? null; pts = a ? levelSeries(byP(p), cur, 'engagement') : null; }
        total = add(total, c); previous = add(previous, pr); if (pts) lines.push({ platform: p, points: pts });
      } else if (m === 'follows') {
        const a = lastIn(byP(p), [...prevDays.slice(-1), ...cur], 'followers'), b = lastIn(byP(p), [...prevDays], 'followers');
        if (a && a.n > 1) { total = add(total, a.last - a.first); lines.push({ platform: p, points: gainSeries(byP(p), cur) }); }
        if (b && b.n > 1) previous = add(previous, b.last - b.first);
      }
    }
    if (m === 'linkClicks') { total = input.linkClicks?.current ?? null; previous = input.linkClicks?.previous ?? null; }
    lines = lines.filter((l) => l.points.some((x) => x != null));
    return { key: m, total, previous, change: pctChange(total, previous), lines };
  });
  const views = cards[0];
  const headline = views.total == null ? null : { metric: 'views', change: views.change, total: views.total };
  const top = (key: 'views' | 'interactions') => [...input.posts].filter((p) => p[key] != null).sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 12)
    .map((p) => ({ variantId: p.variantId, platform: p.platform, published_at: p.published_at, value: p[key] as number, post: p.post }));
  return { days: n, from: cur[0], to: cur[cur.length - 1], cards, headline, top: { views: top('views'), interactions: top('interactions'), follows: [] as unknown[] } };
}
