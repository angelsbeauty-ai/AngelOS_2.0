// Shared read tools: every tool is scoped to one studio, honours the per-area switches,
// and returns null (unavailable) instead of guessing. Pure, in-memory fake DB, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const rt = require('../dist/ai/tools/read-tools.js');
const vt = require('../dist/ai/voice/voice-token.js');

const A = 'ws-a', B = 'ws-b';
const now = new Date('2026-10-20T07:00:00Z');
const rows = {
  appointments: [
    { workspace_id: A, id: 'a1', start_at: '2026-10-20T04:00:00Z', end_at: '2026-10-20T05:00:00Z', service_name: 'Brows', status: 'confirmed', price_snapshot: 20000, currency: 'JPY', source: 'instagram', client: { display_name: 'Mei Tanaka' } },
    { workspace_id: B, id: 'b1', start_at: '2026-10-20T04:00:00Z', end_at: '2026-10-20T05:00:00Z', service_name: 'OTHER STUDIO', status: 'confirmed', price_snapshot: 99999, currency: 'JPY', source: 'instagram', client: { display_name: 'Other Client' } }
  ],
  clients: [{ workspace_id: A, id: 'c1', display_name: 'Mei Tanaka', status: 'active', created_at: '2026-10-01T00:00:00Z', phone: '090', email: 'x@y' }, { workspace_id: B, id: 'c2', display_name: 'Mei Other', status: 'active', created_at: '2026-10-01T00:00:00Z' }],
  message_threads: [{ workspace_id: A, id: 't1', contact_display_name: 'Yuki Sato', status: 'needs_reply', owner_unread: true, archived_at: null, last_message_at: '2026-10-20T06:00:00Z', channel: { provider: 'line' } }, { workspace_id: B, id: 't2', contact_display_name: 'Leak', status: 'needs_reply', owner_unread: true, archived_at: null, last_message_at: '2026-10-20T06:00:00Z', channel: { provider: 'line' } }],
  content_variants: [{ workspace_id: A, id: 'p1', platform: 'instagram', status: 'scheduled', scheduled_for: '2026-10-21T09:00:00Z', post: { title: 'Healed brows' } }, { workspace_id: B, id: 'p2', platform: 'instagram', status: 'scheduled', scheduled_for: '2026-10-21T09:00:00Z', post: { title: 'Leak' } }],
  social_account_metrics: [{ workspace_id: A, platform: 'instagram', metric_date: '2026-10-01', followers: 1800, reach: 500 }, { workspace_id: A, platform: 'instagram', metric_date: '2026-10-19', followers: 1886, reach: 700 }, { workspace_id: B, platform: 'instagram', metric_date: '2026-10-19', followers: 50000, reach: 99999 }],
  client_payment_entries: [{ workspace_id: A, entry_type: 'payment', amount: 20000, currency: 'JPY', occurred_at: '2026-10-19T00:00:00Z' }, { workspace_id: B, entry_type: 'payment', amount: 99999, currency: 'JPY', occurred_at: '2026-10-19T00:00:00Z' }],
  business_expenses: [{ workspace_id: A, amount: 3000, currency: 'JPY', occurred_at: '2026-10-18T00:00:00Z' }, { workspace_id: B, amount: 77777, currency: 'JPY', occurred_at: '2026-10-18T00:00:00Z' }],
  services: [{ workspace_id: A, id: 's1', name: 'Brows', duration_minutes: 90, standard_price: 20000, currency: 'JPY', active: true }, { workspace_id: B, id: 's2', name: 'Leak', duration_minutes: 1, standard_price: 1, currency: 'JPY', active: true }],
  content_campaigns: [{ workspace_id: A, id: 'k1', name: 'Autumn', status: 'active' }, { workspace_id: B, id: 'k2', name: 'Leak', status: 'active' }],
  tasks: [{ workspace_id: A, id: 'x1', title: 'Order pigment', status: 'open' }, { workspace_id: B, id: 'x2', title: 'Leak', status: 'open' }],
  client_messages: [{ workspace_id: A, thread_id: 't1', id: 'cm1', direction: 'inbound', body: 'Hi', status: 'received', created_at: '2026-10-20T06:00:00Z' }, { workspace_id: B, thread_id: 't1', id: 'cm2', direction: 'inbound', body: 'Leak', status: 'received', created_at: '2026-10-20T06:00:00Z' }],
  ai_data_access: []
};

/** Minimal Supabase-like query builder over in-memory rows. Records whether workspace_id was filtered. */
function fakeDb(data = rows) {
  const log = [];
  return { log, from(table) {
    let list = [...(data[table] ?? [])]; const entry = { table, scoped: null }; log.push(entry);
    const b = {
      select() { return b; },
      eq(k, v) { if (k === 'workspace_id') entry.scoped = v; list = list.filter((r) => r[k] === v); return b; },
      neq(k, v) { list = list.filter((r) => r[k] !== v); return b; },
      is(k, v) { list = list.filter((r) => (r[k] ?? null) === v); return b; },
      gte(k, v) { list = list.filter((r) => String(r[k]) >= v); return b; },
      lt(k, v) { list = list.filter((r) => String(r[k]) < v); return b; },
      ilike(k, v) { const n = v.replace(/%/g, '').toLowerCase(); list = list.filter((r) => String(r[k]).toLowerCase().includes(n)); return b; },
      order() { return b; }, limit(n) { list = list.slice(0, n); return b; },
      then(res, rej) { return Promise.resolve({ data: list, error: null }).then(res, rej); }
    };
    return b;
  } };
}

const ARGS = { read_thread: { thread_id: 't1' }, get_bookings: { from: '2026-10-20' }, search_clients: { query: 'Mei' }, list_threads: { filter: 'unread' }, list_posts: { status: 'scheduled' }, get_analytics: { period: '30d' }, get_money: { period: '30d' }, list_services_prices: {}, list_campaigns_tasks: {} };

for (const tool of rt.READ_TOOLS) {
  test(`${tool.name}: only sees its own studio`, async () => {
    const db = fakeDb();
    const out = await rt.runReadTool(db, A, tool.name, ARGS[tool.name], now);
    const text = JSON.stringify(out);
    for (const leak of ['OTHER STUDIO', 'Other Client', 'Mei Other', 'Leak', '99999', '77777', '50000']) assert.ok(!text.includes(leak), `${tool.name} leaked ${leak}`);
    for (const q of db.log.filter((e) => e.table !== 'ai_data_access')) assert.equal(q.scoped, A, `${tool.name} queried ${q.table} without workspace scope`);
    assert.equal(out.area, tool.area);
  });
}

test('every tool is refused when its area is switched off', async () => {
  for (const tool of rt.READ_TOOLS) {
    const db = fakeDb({ ...rows, ai_data_access: [{ workspace_id: A, area: tool.area, enabled: false }] });
    await assert.rejects(rt.runReadTool(db, A, tool.name, ARGS[tool.name], now), (e) => e instanceof rt.AreaOffError);
  }
});

test('client data is minimised: no phone or email, short names', async () => {
  const out = await rt.runReadTool(fakeDb(), A, 'search_clients', { query: 'Mei' }, now);
  assert.deepEqual(out.clients, [{ id: 'c1', name: 'Mei T.', status: 'active' }]);
});

test('analytics numbers come from data; missing values are null, never guessed', async () => {
  const out = await rt.runReadTool(fakeDb(), A, 'get_analytics', { period: '30d' }, now);
  assert.equal(out.reach, 1200); assert.equal(out.followers, 1886); assert.equal(out.followers_change, 86);
  assert.equal(out.bookings, 1); assert.equal(out.booking_value, 20000); assert.equal(out.bookings_from_instagram, 1);
  const empty = await rt.runReadTool(fakeDb({ ...rows, social_account_metrics: [] }), A, 'get_analytics', { period: '30d' }, now);
  assert.equal(empty.reach, null); assert.equal(empty.followers, null); assert.equal(empty.followers_change, null);
});

test('function tool list follows the switches', () => {
  assert.equal(rt.functionTools().length, rt.READ_TOOLS.length);
  assert.ok(!rt.functionTools(new Set(['bookings'])).some((t) => t.name === 'get_money'));
});

test('voice token: scoped to one studio, short-lived, tamper-proof', () => {
  const t = vt.mintVoiceToken('u1', A, 600, Date.now(), 'k');
  assert.equal(vt.verifyVoiceToken(t, A, Date.now(), 'k').sub, 'u1');
  assert.equal(vt.verifyVoiceToken(t, B, Date.now(), 'k'), null);
  assert.equal(vt.verifyVoiceToken(t, A, Date.now() + 601000, 'k'), null);
  assert.equal(vt.verifyVoiceToken(t, A, Date.now(), 'other-key'), null);
  assert.equal(vt.verifyVoiceToken(t.slice(0, -2) + 'xx', A, Date.now(), 'k'), null);
});
