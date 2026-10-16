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
