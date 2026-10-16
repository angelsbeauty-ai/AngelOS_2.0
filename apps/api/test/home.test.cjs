const test = require('node:test');
const assert = require('node:assert');
const h = require('../dist/home/home-logic.js');

test('day window is local Tokyo midnight to midnight', () => {
  const { start, end } = h.periodWindow('day', new Date('2026-10-16T01:00:00Z'));
  assert.equal(start.toISOString(), '2026-10-15T15:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-16T15:00:00.000Z');
});
test('week starts Monday, month starts on the 1st', () => {
  assert.equal(h.periodWindow('week', new Date('2026-10-16T01:00:00Z')).start.toISOString(), '2026-10-11T15:00:00.000Z');
  assert.equal(h.periodWindow('month', new Date('2026-10-16T01:00:00Z')).start.toISOString(), '2026-09-30T15:00:00.000Z');
});
test('schedule counts new vs returning, pending, cancelled', () => {
  const a = (id, status, client) => ({ id, start_at: `2026-10-16T0${id}:00:00Z`, end_at: `2026-10-16T0${id}:30:00Z`, status, service_name: 'Brows', client_id: client, client_name: client });
  const s = h.scheduleBox([a('1', 'confirmed', 'c1'), a('2', 'requested', 'c2'), a('3', 'cancelled', 'c3')], new Set(['c1']), 2, new Date('2026-10-16T00:00:00Z'));
  assert.equal(s.total, 2); assert.equal(s.pending, 1); assert.equal(s.cancelled, 1);
  assert.equal(s.returningClients, 1); assert.equal(s.newClients, 1); assert.equal(s.touchUpsDue, 2); assert.equal(s.next.id, '1');
});
test('messages keep read state separate from booking state', () => {
  const t = (id, o) => ({ id, unread: false, needs_reply: false, status: 'waiting_client', intent: 'unknown', priority: 'today', needs_owner: false, name: id, platform_label: 'LINE', last_message_at: null, preview: null, ...o });
  const m = h.messagesBox([t('a', { unread: true, intent: 'booking' }), t('b', { status: 'booking_in_progress' }), t('c', { status: 'spam_scam', unread: true })]);
  assert.equal(m.unread, 1); assert.equal(m.booking.inProgress, 1); assert.equal(m.booking.inquiries, 1); assert.equal(m.total, 2);
});
test('weekly goals count only saved story and carousel formats', () => {
  const w = h.weekCounts([{ format: 'story' }, { format: 'story' }, { format: 'carousel' }, { format: 'reel' }, { format: null }, { format: 'photo' }]);
  assert.equal(w.stories, 2);
  assert.equal(w.carousels, 1);
  assert.equal(w.reels, 1);
  assert.equal(w.photos, 1);
  assert.deepEqual(w.goals, { stories: 3, carousels: 1 });
});
test('inspiration is the most-viewed titled post, or nothing', () => {
  assert.equal(h.pickInspiration([{ title: 'A', platform: 'instagram', views: null, published_at: '2026-10-01' }]), null);
  const top = h.pickInspiration([
    { title: 'Low', platform: 'instagram', views: 10, published_at: '2026-10-02' },
    { title: 'High', platform: 'facebook', views: 40, published_at: '2026-10-01' },
    { title: null, platform: 'instagram', views: 99, published_at: '2026-10-03' }
  ]);
  assert.equal(top.title, 'High');
  assert.equal(top.views, 40);
  assert.equal(top.platform, 'facebook');
});

const bill = require('../dist/ai/openai-bill.js');
test('OpenAI cost payload sums to dollars and a missing payload is not zero', () => {
  assert.equal(bill.sumCostUsd(null), null);
  assert.equal(bill.sumCostUsd({}), null);
  assert.equal(bill.sumCostUsd({ data: [{ results: [{ amount: { value: '10.00' } }, { amount: { value: 2.5 } }] }] }), 12.5);
  assert.equal(bill.sumCostUsd({ data: [] }), 0);
});
test('a real bill is split by use counts and still adds up', () => {
  assert.deepEqual(bill.shareBill(50, [30, 20]), [30, 20]);
  const parts = bill.shareBill(0.01, [1, 1, 1]);
  assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), 1);
  assert.deepEqual(bill.shareBill(50, []), []);
  assert.deepEqual(bill.shareBill(50, [0, 0]), [0, 0]);
});
test('empty studio briefing is honest and invents nothing', () => {
  const s = { schedule: h.scheduleBox([], new Set(), 0, new Date()), messages: h.messagesBox([]), social: h.socialBox([], []), assistant: h.assistantBox([], 0) };
  assert.deepEqual(h.factLines(s, 'day'), ['No bookings today.', 'No messages waiting for a reply.']);
  assert.equal(s.social.followers, null);
});

const u = require('../dist/ai/ai-usage.js');
test('AI meter: limits and friendly messages', () => {
  assert.equal(u.limitState(49, 100).limited, false);
  const d = u.limitState(50, 100); assert.equal(d.reason, 'daily'); assert.match(d.message, /50 AI uses for today/);
  assert.equal(u.limitState(3, 600).reason, 'monthly');
});
test('AI meter: Japan-time day and month bounds', () => {
  const b = u.jstBounds(new Date('2026-10-16T01:00:00Z'));
  assert.equal(b.day, '2026-10-15T15:00:00.000Z'); assert.equal(b.month, '2026-09-30T15:00:00.000Z');
});

const ins = require('../dist/social/insights-logic.js');
test('insights: snapshots are never summed; views come from per-post numbers', () => {
  const rows = [];
  for (let i = 0; i < 60; i++) { const d = new Date(Date.parse('2026-10-16T00:00:00Z') - i * 86400000).toISOString().slice(0, 10); rows.push({ platform: 'instagram', metric_date: d, followers: 1000 - i, engagement: i < 30 ? 20 : 40, reach: null }); }
  const posts = [{ variantId: 'a', platform: 'instagram', published_at: '2026-10-10T03:00:00Z', views: 100, interactions: null, post: {} }, { variantId: 'b', platform: 'instagram', published_at: '2026-08-30T03:00:00Z', views: 200, interactions: null, post: {} }];
  const out = ins.buildInsights({ rows, platforms: ['instagram', 'facebook'], today: '2026-10-16', posts });
  const [views, inter, follows, links] = out.cards;
  assert.equal(views.total, 100); assert.equal(views.previous, 200); assert.equal(views.change, -50);
  assert.equal(inter.total, 20); assert.equal(inter.previous, 40); // latest snapshot, not 30 x 20
  assert.equal(follows.total, 30);
  assert.equal(links.total, null);
  assert.equal(views.lines.length, 1);
  assert.equal(ins.pctChange(0, 0), 0); assert.equal(ins.pctChange(5, 0), null);
});
