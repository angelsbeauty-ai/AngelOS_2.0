// B1-B7: health form, money, insights and reminders logic. Pure functions, no network/database/AI.
const test = require('node:test');
const assert = require('node:assert/strict');
const hf = require('../dist/clients/health-form.js');
const bm = require('../dist/analytics/business-metrics.js');
const rm = require('../dist/automations/reminders.js');

const day = 86400000;
const now = new Date('2026-10-09T03:00:00Z'); // 12:00 JST

test('health form: red flags and bilingual questions', () => {
  for (const q of hf.HEALTH_QUESTIONS) { assert.ok(q.en && q.ja); assert.ok(!/[\u3040-\u30ff]/.test(q.en)); }
  const answers = hf.sanitizeAnswers({ blood_thinners: { answer: 'yes' }, diabetes: { answer: 'no' }, bogus: { answer: 'yes' } });
  assert.equal(answers.bogus, undefined);
  assert.deepEqual(hf.redFlagsFrom(answers), ['blood_thinners']);
});

test('touch-up due 6-10 weeks after first session, not if booked', () => {
  const t = [{ stage: 'first_session', performed_at: new Date(now - 50 * day).toISOString() }];
  assert.equal(hf.touchUpDue(t, 0, now), true);
  assert.equal(hf.touchUpDue(t, 1, now), false);
  assert.equal(hf.touchUpDue([{ stage: 'first_session', performed_at: new Date(now - 20 * day).toISOString() }], 0, now), false);
});

test('who owes: price minus payments and discounts', () => {
  const appts = [
    { id: 'a1', client_id: 'c1', service_name: 'Brows', status: 'completed', start_at: '2026-10-01T01:00:00Z', price_snapshot: 50000 },
    { id: 'a2', client_id: 'c2', service_name: 'Lips', status: 'completed', start_at: '2026-10-02T01:00:00Z', price_snapshot: 40000 },
    { id: 'a3', client_id: 'c3', service_name: 'Lips', status: 'confirmed', start_at: '2026-10-20T01:00:00Z', price_snapshot: 40000 }
  ];
  const pays = [
    { entry_type: 'deposit', amount: 10000, appointment_id: 'a1', occurred_at: '2026-09-20T00:00:00Z' },
    { entry_type: 'payment', amount: 40000, appointment_id: 'a2', occurred_at: '2026-10-02T03:00:00Z' }
  ];
  assert.deepEqual(bm.whoOwes(appts, pays).map((r) => [r.appointmentId, r.due]), [['a1', 40000]]);
  pays.push({ entry_type: 'refund', amount: 5000, appointment_id: 'a2', occurred_at: '2026-10-03T00:00:00Z' });
  assert.equal(bm.whoOwes(appts, pays).find((r) => r.appointmentId === 'a2').due, 5000);
});

test('business metrics: no-show rate, new vs returning, income change', () => {
  const a = (id, c, status, daysAgo) => ({ id, client_id: c, service_name: 'Brows', status, start_at: new Date(now - daysAgo * day).toISOString(), price_snapshot: 10000 });
  const appointments = [a('1', 'c1', 'completed', 5), a('2', 'c2', 'no_show', 6), a('3', 'c3', 'completed', 7), a('4', 'c4', 'cancelled', 8)];
  const history = [...appointments, a('0', 'c3', 'completed', 200), a('9', 'c1', 'confirmed', -10)];
  const payments = [{ entry_type: 'payment', amount: 20000, appointment_id: '1', occurred_at: new Date(now - 5 * day).toISOString() }, { entry_type: 'payment', amount: 10000, occurred_at: new Date(now - 40 * day).toISOString() }];
  const m = bm.businessMetrics({ now, days: 30, appointments, history, payments });
  assert.equal(m.bookings, 3); assert.equal(m.completed, 2); assert.equal(m.cancelled, 1); assert.equal(m.noShows, 1);
  assert.equal(m.noShowRate, 33);
  assert.equal(m.newClients, 2); assert.equal(m.returningClients, 1);
  assert.equal(m.rebookRate, 50);
  assert.equal(m.income, 20000); assert.equal(m.incomeChange, 100);
});

test('CSV is formula-injection safe but keeps negative numbers', () => {
  const csv = bm.toCsv([{ a: '=HYPERLINK("x")', b: -500, c: 'say "hi"' }], ['a', 'b', 'c']);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"-500"/);
  assert.match(csv, /"say ""hi"""/);
});

const rules = rm.mergeRules([]);
const client = (lang, dnm = false) => ({ display_name: 'Yuki Tanaka', language: lang, do_not_auto_message: dnm });
const appt = (id, status, daysFromNow, c) => ({ id, client_id: 'c-' + id, service_name: 'Brows', status, start_at: new Date(now.getTime() + daysFromNow * day).toISOString(), client: c });

test('reminders: day-before and aftercare, one language per message', () => {
  const out = rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules, clients: [], appointments: [appt('x', 'confirmed', 1, client('ja')), appt('y', 'completed', -3, client('en'))] });
  const before = out.find((r) => r.type === 'day_before');
  assert.ok(before); assert.equal(before.language, 'ja');
  assert.ok(/[\u3040-\u30ff]/.test(before.message)); assert.ok(!/[A-Za-z]{4,}/.test(before.message.replace(/Brows|Yuki/g, '')));
  assert.ok(before.meaningEn && !/[\u3040-\u30ff]/.test(before.meaningEn));
  const care = out.find((r) => r.type === 'aftercare_3');
  assert.ok(care); assert.equal(care.language, 'en'); assert.ok(!/[\u3040-\u30ff]/.test(care.message)); assert.equal(care.meaningEn, null);
  assert.equal(care.key, 'reminder:aftercare_3:y');
});

test('reminders: respect do-not-message and disabled rules', () => {
  const blocked = rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules, clients: [], appointments: [appt('x', 'confirmed', 1, client('ja', true))] });
  assert.equal(blocked.length, 0);
  const off = rules.map((r) => ({ ...r, enabled: r.type !== 'day_before' }));
  assert.equal(rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules: off, clients: [], appointments: [appt('x', 'confirmed', 1, client('en'))] }).length, 0);
});

test('reminders: touch-up due only when nothing booked; birthday', () => {
  const done = appt('t', 'completed', -50, client('en'));
  assert.ok(rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules, clients: [], appointments: [done] }).some((r) => r.type === 'touch_up_due'));
  const booked = { ...appt('u', 'confirmed', 5, client('en')), client_id: done.client_id };
  assert.ok(!rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules, clients: [], appointments: [done, booked] }).some((r) => r.type === 'touch_up_due'));
  const bday = rm.computeReminders({ now, timeZone: 'Asia/Tokyo', rules, appointments: [], clients: [{ id: 'b', display_name: 'Mai', language: 'ja', birthday: '1990-10-09' }] });
  assert.equal(bday.length, 1); assert.equal(bday[0].key, 'reminder:birthday:b:2026');
});
