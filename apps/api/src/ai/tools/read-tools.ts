/**
 * One shared set of READ tools for the assistant: text chat (function calling) and voice use exactly this list
 * through the same runner and the same /ai/tools/:name endpoint. Every query is scoped to one studio with an
 * explicit workspace_id filter on top of RLS. Tools return structured JSON; answer cards are drawn from this JSON,
 * never from model text. A value we cannot measure is null (shown as "Unavailable"), never guessed.
 * Client data is minimised: names and the fields needed to answer, no phone, email, notes or message bodies.
 */
export type Area = 'bookings' | 'clients' | 'messages' | 'posts' | 'analytics' | 'money' | 'services' | 'campaigns';
export const AREAS: Area[] = ['bookings', 'clients', 'messages', 'posts', 'analytics', 'money', 'services', 'campaigns'];

export interface ReadToolDef { name: string; area: Area; description: string; parameters: Record<string, unknown> }
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const period = { type: 'string', enum: ['today', '7d', '30d', 'month', 'last_month', '90d'], description: 'Time period. Default 30d.' };

export const READ_TOOLS: ReadToolDef[] = [
  { name: 'get_bookings', area: 'bookings', description: 'Bookings between two dates (max 92 days). Times in the studio time zone.', parameters: obj({ from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD, inclusive' } }, ['from']) },
  { name: 'search_clients', area: 'clients', description: 'Find clients by name or list new/inactive ones. Returns names and status only.', parameters: obj({ query: { type: 'string' }, filter: { type: 'string', enum: ['new', 'inactive', 'all'] } }) },
  { name: 'list_threads', area: 'messages', description: 'Inbox conversations: unread, needing a reply, or by platform (max 20).', parameters: obj({ filter: { type: 'string', enum: ['unread', 'needs_reply', 'all'] }, platform: { type: 'string', enum: ['line', 'instagram', 'facebook', 'tiktok'] } }) },
  { name: 'list_posts', area: 'posts', description: 'Social posts by status: draft, scheduled or published.', parameters: obj({ status: { type: 'string', enum: ['draft', 'scheduled', 'published'] } }) },
  { name: 'get_analytics', area: 'analytics', description: 'Reach, follower change, bookings and booking value for a period, plus weekly reach for the last 8 weeks.', parameters: obj({ period, platform: { type: 'string', enum: ['instagram', 'facebook', 'tiktok', 'line'] } }) },
  { name: 'get_money', area: 'money', description: 'Money received, expenses and net for a period.', parameters: obj({ period }) },
  { name: 'list_services_prices', area: 'services', description: 'Active services with duration and standard price.', parameters: obj({}) },
  { name: 'list_campaigns_tasks', area: 'campaigns', description: 'Active campaigns and open tasks.', parameters: obj({}) }
];
export const READ_TOOL_NAMES = new Set(READ_TOOLS.map((t) => t.name));
export const toolArea = (name: string) => READ_TOOLS.find((t) => t.name === name)?.area ?? null;

/** OpenAI Responses API function-tool format. Voice (Realtime) uses the same shape. */
export const functionTools = (enabled: Set<Area> = new Set(AREAS)) => READ_TOOLS.filter((t) => enabled.has(t.area)).map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }));

const DAY = 86400000;
export function periodRange(p: unknown, now: Date): { start: Date; end: Date; days: number; label: string } {
  const key = typeof p === 'string' ? p : '30d';
  if (key === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); return { start: s, end: now, days: 1, label: 'today' }; }
  if (key === 'month') { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s, end: now, days: Math.max(1, Math.ceil((+now - +s) / DAY)), label: 'this month' }; }
  if (key === 'last_month') { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s, end: e, days: Math.round((+e - +s) / DAY), label: 'last month' }; }
  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30;
  return { start: new Date(+now - days * DAY), end: now, days, label: `last ${days} days` };
}

type Db = { from: (t: string) => any };
const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
const shortName = (n?: string | null) => { if (!n) return null; const [a, b] = String(n).trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; };

export class AreaOffError extends Error { constructor(public area: Area) { super(`${area} is off in What AngelOS can see`); } }

/** Reads the per-area switches. Missing table or row = on (Angel's approved default). */
export async function enabledAreas(db: Db, workspaceId: string): Promise<Set<Area>> {
  const on = new Set<Area>(AREAS);
  try {
    const { data, error } = await db.from('ai_data_access').select('area,enabled').eq('workspace_id', workspaceId);
    if (!error) for (const r of data ?? []) if (r.enabled === false) on.delete(r.area);
  } catch { /* table not created yet */ }
  return on;
}

export async function runReadTool(db: Db, workspaceId: string, name: string, args: Record<string, any> = {}, now = new Date(), enabled?: Set<Area>): Promise<Record<string, unknown>> {
  const area = toolArea(name);
  if (!area) throw new Error(`Unknown tool: ${name}`);
  const on = enabled ?? await enabledAreas(db, workspaceId);
  if (!on.has(area)) throw new AreaOffError(area);
  const q = (t: string, cols: string) => db.from(t).select(cols).eq('workspace_id', workspaceId);

  if (name === 'get_bookings') {
    const from = new Date(`${String(args.from ?? now.toISOString().slice(0, 10))}T00:00:00+09:00`);
    let to = new Date(`${String(args.to ?? args.from ?? now.toISOString().slice(0, 10))}T00:00:00+09:00`); to = new Date(+to + DAY);
    if (+to - +from > 92 * DAY) to = new Date(+from + 92 * DAY);
    const { data, error } = await q('appointments', 'id,start_at,end_at,service_name,status,client:clients(display_name)').gte('start_at', from.toISOString()).lt('start_at', to.toISOString()).order('start_at');
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((r: any) => r.status !== 'cancelled');
    return { area, from: from.toISOString(), to: to.toISOString(), count: rows.length, bookings: rows.map((r: any) => ({ id: r.id, start_at: r.start_at, end_at: r.end_at, service: r.service_name, status: r.status, client: shortName(r.client?.display_name) })) };
  }
  if (name === 'search_clients') {
    let b = q('clients', 'id,display_name,status,created_at');
    if (args.query) b = b.ilike('display_name', `%${String(args.query).replace(/[%_]/g, '')}%`);
    if (args.filter === 'new') b = b.gte('created_at', new Date(+now - 30 * DAY).toISOString());
    if (args.filter === 'inactive') b = b.eq('status', 'inactive');
    const { data, error } = await b.limit(20);
    if (error) throw new Error(error.message);
    return { area, count: (data ?? []).length, clients: (data ?? []).map((c: any) => ({ id: c.id, name: shortName(c.display_name), status: c.status })) };
  }
  if (name === 'list_threads') {
    let b = q('message_threads', 'id,contact_display_name,status,owner_unread,last_message_at,channel:messaging_channels(provider),client:clients(display_name)').is('archived_at', null);
    if (args.filter === 'unread') b = b.eq('owner_unread', true);
    if (args.filter === 'needs_reply') b = b.eq('status', 'needs_reply');
    const { data, error } = await b.order('last_message_at', { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((r: any) => !args.platform || r.channel?.provider === args.platform);
    return { area, count: rows.length, threads: rows.map((r: any) => ({ id: r.id, name: shortName(r.client?.display_name ?? r.contact_display_name), platform: r.channel?.provider ?? null, unread: Boolean(r.owner_unread), needs_reply: r.status === 'needs_reply', at: r.last_message_at })) };
  }
  if (name === 'list_posts') {
    const status = ['draft', 'scheduled', 'published'].includes(args.status) ? args.status : 'scheduled';
    const { data, error } = await q('content_variants', 'id,platform,status,scheduled_for,published_at,post:content_posts(title)').eq('status', status).order(status === 'published' ? 'published_at' : 'scheduled_for', { ascending: status !== 'published' }).limit(20);
    if (error) throw new Error(error.message);
    return { area, status, count: (data ?? []).length, posts: (data ?? []).map((r: any) => ({ id: r.id, title: r.post?.title ?? null, platform: r.platform, at: r.published_at ?? r.scheduled_for })) };
  }
  if (name === 'get_analytics') {
    const r = periodRange(args.period, now);
    const prevStart = new Date(+r.start - (+r.end - +r.start));
    const weeksStart = new Date(+now - 56 * DAY);
    const metricsFrom = new Date(Math.min(+prevStart, +weeksStart)).toISOString().slice(0, 10);
    let m = q('social_account_metrics', 'platform,metric_date,followers,reach').gte('metric_date', metricsFrom);
    if (args.platform) m = m.eq('platform', args.platform);
    const [met, appts] = await Promise.all([m.order('metric_date'), q('appointments', 'start_at,status,price_snapshot,currency,source').gte('start_at', r.start.toISOString()).lt('start_at', r.end.toISOString())]);
    const rows: any[] = met.error ? [] : met.data ?? [];
    const inRange = (d: string, s: Date, e: Date) => { const t = Date.parse(`${d}T00:00:00Z`); return t >= +s - DAY && t < +e; };
    const cur = rows.filter((x) => inRange(x.metric_date, r.start, r.end));
    const prev = rows.filter((x) => inRange(x.metric_date, prevStart, r.start));
    const reachKnown = cur.some((x) => x.reach != null);
    const lastFollowers = (list: any[]) => { const by = new Map<string, number>(); for (const x of list) if (x.followers != null) by.set(x.platform, Number(x.followers)); return by.size ? [...by.values()].reduce((a, b) => a + b, 0) : null; };
    const firstFollowers = (list: any[]) => { const by = new Map<string, number>(); for (const x of list) if (x.followers != null && !by.has(x.platform)) by.set(x.platform, Number(x.followers)); return by.size ? [...by.values()].reduce((a, b) => a + b, 0) : null; };
    const fNow = lastFollowers(cur); const fStart = firstFollowers(cur);
    const weekly: Array<number | null> = [];
    for (let w = 7; w >= 0; w--) { const s = new Date(+now - (w + 1) * 7 * DAY); const e = new Date(+now - w * 7 * DAY); const wk = rows.filter((x) => inRange(x.metric_date, s, e) && x.reach != null); weekly.push(wk.length ? sum(wk, 'reach') : null); }
    const booked = appts.error ? null : (appts.data ?? []).filter((a: any) => a.status !== 'cancelled');
    const valueKnown = booked ? booked.some((a: any) => a.price_snapshot != null) : false;
    return {
      area, period: r.label, from: r.start.toISOString(), to: r.end.toISOString(), platform: args.platform ?? null,
      reach: reachKnown ? sum(cur, 'reach') : null,
      reach_before: prev.some((x) => x.reach != null) ? sum(prev, 'reach') : null,
      followers: fNow, followers_change: fNow != null && fStart != null ? fNow - fStart : null,
      bookings: booked ? booked.length : null,
      booking_value: booked && valueKnown ? sum(booked, 'price_snapshot') : null,
      currency: booked?.find((a: any) => a.currency)?.currency ?? null,
      bookings_from_instagram: booked ? booked.filter((a: any) => a.source === 'instagram').length : null,
      weekly_reach: weekly,
      sources: [...new Set(cur.map((x) => x.platform))],
      updated_at: rows.length ? rows[rows.length - 1].metric_date : null
    };
  }
  if (name === 'get_money') {
    const r = periodRange(args.period, now);
    const [pay, exp] = await Promise.all([
      q('client_payment_entries', 'entry_type,amount,currency').gte('occurred_at', r.start.toISOString()).lt('occurred_at', r.end.toISOString()),
      q('business_expenses', 'amount,currency').gte('occurred_at', r.start.toISOString()).lt('occurred_at', r.end.toISOString())
    ]);
    const p = pay.error ? null : pay.data ?? []; const e = exp.error ? null : exp.data ?? [];
    const received = p ? sum(p.filter((x: any) => x.entry_type === 'payment' || x.entry_type === 'deposit'), 'amount') - sum(p.filter((x: any) => x.entry_type === 'refund'), 'amount') : null;
    const spent = e ? sum(e, 'amount') : null;
    return { area, period: r.label, received, spent, net: received != null && spent != null ? received - spent : null, currency: p?.[0]?.currency ?? e?.[0]?.currency ?? null };
  }
  if (name === 'list_services_prices') {
    const { data, error } = await q('services', 'id,name,duration_minutes,standard_price,currency,active').eq('active', true).order('name');
    if (error) throw new Error(error.message);
    return { area, services: (data ?? []).map((s: any) => ({ id: s.id, name: s.name, minutes: s.duration_minutes, price: s.standard_price, currency: s.currency })) };
  }
  // list_campaigns_tasks
  const [c, t] = await Promise.all([q('content_campaigns', 'id,name,status,starts_on,ends_on').neq('status', 'archived').limit(20), q('tasks', 'id,title,status,due_at').neq('status', 'done').limit(20)]);
  return { area, campaigns: c.error ? null : c.data ?? [], tasks: t.error ? null : t.data ?? [] };
}
