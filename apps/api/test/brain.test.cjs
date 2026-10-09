// AngelOS brain: summaries/tags/counts only. No network, no database, no AI credits.
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const brain = require('../dist/ai/brain/brain-taxonomy.js');

const PRIVATE = 'Hi it is Yuna Sato, yuna.sato@example.com, 090-1234-5678. Can you write an Instagram post about my healed brows and send a reminder to Mika for her touch up?';

test('owner request becomes fixed topics; none of the typed words are kept', () => {
  const notes = brain.noteOwnerRequest(PRIVATE);
  assert.ok(notes.length >= 1 && notes.length <= 3);
  assert.deepEqual(notes.map((n) => n.topic).sort(), ['bookings', 'rebooking_followups', 'social_posts'].filter((t) => notes.some((n) => n.topic === t)).sort());
  assert.ok(notes.some((n) => n.topic === 'social_posts'));
  const stored = JSON.stringify(notes).toLowerCase();
  for (const secret of ['yuna', 'sato', 'example.com', '090', '1234', 'mika', 'brows', 'healed']) {
    assert.ok(!stored.includes(secret), `"${secret}" must not be stored`);
  }
  for (const n of notes) assert.match(n.summary, /^Owner asked AngelOS for help with [a-z ,-]+\.$/);
});

test('Japanese owner request is tagged ja and still stores no text', () => {
  const notes = brain.noteOwnerRequest('山田さんへのインスタ投稿を作って');
  assert.equal(notes[0].topic, 'social_posts');
  assert.ok(notes[0].tags.includes('ja'));
  assert.ok(!JSON.stringify(notes).includes('山田'));
});

test('client request keeps intent only; unknown intents and odd platforms are made safe', () => {
  const note = brain.noteClientRequest('price', 'line', 'ja');
  assert.deepEqual(note, { kind: 'client_request', topic: 'client_price', summary: 'Clients asked about prices.', tags: ['client', 'price', 'line', 'ja'] });
  const odd = brain.noteClientRequest('<script>', 'Insta Gram!', 'xx');
  assert.equal(odd.topic, 'client_inquiry');
  assert.deepEqual(odd.tags, ['client', 'inquiry']);
});

test('preferences: only known setting/value pairs are remembered', () => {
  assert.equal(brain.notePreference('reply_tone', 'casual_friendly').topic, 'reply_tone_casual_friendly');
  assert.equal(brain.notePreference('learn_from_replies', false).topic, 'learn_from_replies_off');
  assert.equal(brain.notePreference('style_notes', 'call me Angel'), null);
  assert.equal(brain.notePreference('reply_tone', 'anything else'), null);
});

test('every possible topic and summary fits the database checks (topic key, <=140 chars, <=8 tags)', () => {
  const notes = [
    ...brain.OWNER_TOPICS.flatMap((t) => brain.noteOwnerRequest(t.key.replace(/_/g, ' ') + ' ' + t.patterns.map((p) => p.source).join(' '))),
    ...Object.keys(brain.CLIENT_INTENT_LABELS).map((i) => brain.noteClientRequest(i, 'instagram', 'en')),
    ...Object.entries(brain.PREFERENCE_LABELS).flatMap(([s, v]) => Object.keys(v).map((value) => brain.notePreference(s, value === 'on' ? true : value === 'off' ? false : value)))
  ];
  assert.ok(notes.length > 25);
  for (const n of notes) {
    assert.match(n.topic, /^[a-z0-9_]{2,60}$/);
    assert.ok(n.summary.length <= 140);
    assert.ok(n.tags.length <= 8 && n.tags.every((t) => /^[a-z0-9_]{1,30}$/.test(t)));
    assert.notEqual(brain.topicLabel(n.kind, n.topic), n.topic);
  }
});

test('marketing hint comes from topic counts only', () => {
  assert.equal(brain.marketingHintFrom([{ topic: 'client_aftercare', count: 4 }, { topic: 'client_complaint', count: 9 }, { topic: 'client_price', count: 7 }], 'own'), 'your clients often ask about prices and aftercare');
  assert.equal(brain.marketingHintFrom([{ topic: 'client_inquiry', count: 9 }], 'own'), null);
  assert.match(brain.marketingHintFrom([{ topic: 'client_location', count: 3 }], 'all'), /^clients at many studios/);
});

test('migration 0018: no text/voice columns, aggregates return no ids, only the backend may call the functions', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../supabase/migrations/0018_v1_ai_brain_summaries.sql'), 'utf8');
  const table = sql.slice(sql.indexOf('create table'), sql.indexOf(');', sql.indexOf('create table')));
  for (const col of ['body', 'content', 'transcript', 'voice', 'audio', 'email', 'client_id', 'user_id', 'message']) {
    assert.ok(!new RegExp(`^\\s*${col}\\b`, 'mi').test(table), `no ${col} column`);
  }
  assert.match(sql, /returns table \(kind text, topic text, workspaces bigint, requests bigint\)/);
  assert.match(sql, /revoke all on function public\.ai_brain_topic_aggregates\(integer, integer\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.ai_brain_topic_aggregates\(integer, integer\) to service_role/);
  assert.match(sql, /enable row level security/);
  assert.ok(!/for (insert|update|delete|all)/i.test(sql), 'members cannot write brain rows');
});

test('founder brain API is behind the founder guard', () => {
  const { FounderController } = require('../dist/founder/founder.controller.js');
  const { FounderGuard } = require('../dist/founder/founder.guard.js');
  const guards = Reflect.getMetadata('__guards__', FounderController) ?? [];
  assert.ok(guards.includes(FounderGuard));
  assert.equal(Reflect.getMetadata('path', FounderController.prototype.brainAggregates), 'brain/aggregates');
});
