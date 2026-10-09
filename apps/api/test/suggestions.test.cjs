// C4 suggestion rules. Pure, no database, no AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/ai/suggestions/suggestion-rules.js');

const now = new Date('2026-10-09T05:00:00Z'); // 14:00 JST Friday
const thread = (over) => ({ id: 't1', name: 'Yuna', platformLabel: 'LINE', lastDirection: 'inbound', lastAt: '2026-10-08T05:00:00Z', status: 'needs_reply', archived: false, hasPendingDraft: false, preview: '予約できますか？', ...over });

test('No post in the next 3 days -> one create_post_draft for tonight 20:00 JST, listed first', () => {
  const out = rules.computeSuggestions({ now, timeZone: 'Asia/Tokyo', plannedPostTimes: [], threads: [thread()], dismissedKeys: new Set() });
  assert.equal(out[0].kind, 'create_post_draft');
  assert.equal(out[0].input.date, '2026-10-09');
  assert.equal(out[0].input.plannedFor, '2026-10-09T11:00:00.000Z');
  assert.equal(out[1].kind, 'draft_reply');
});

test('A post planned within 3 days -> no post suggestion', () => {
  const out = rules.computeSuggestions({ now, timeZone: 'Asia/Tokyo', plannedPostTimes: ['2026-10-11T11:00:00Z'], threads: [], dismissedKeys: new Set() });
  assert.equal(out.length, 0);
});

test('After 20:00 the post suggestion moves to tomorrow', () => {
  const late = new Date('2026-10-09T12:30:00Z'); // 21:30 JST
  const out = rules.computeSuggestions({ now: late, timeZone: 'Asia/Tokyo', plannedPostTimes: [], threads: [], dismissedKeys: new Set() });
  assert.equal(out[0].input.date, '2026-10-10');
});

test('Only unanswered, active threads without a waiting draft become draft_reply, oldest first', () => {
  const out = rules.computeSuggestions({ now, timeZone: 'Asia/Tokyo', plannedPostTimes: ['2026-10-09T11:00:00Z'], dismissedKeys: new Set(), threads: [
    thread({ id: 'new', lastAt: '2026-10-09T04:00:00Z' }),
    thread({ id: 'old', lastAt: '2026-10-07T04:00:00Z' }),
    thread({ id: 'answered', lastDirection: 'outbound' }),
    thread({ id: 'done', status: 'done' }),
    thread({ id: 'spam', status: 'spam_scam' }),
    thread({ id: 'archived', archived: true }),
    thread({ id: 'pending', hasPendingDraft: true })
  ] });
  assert.deepEqual(out.map((s) => s.input.threadId), ['old', 'new']);
  assert.ok(out.every((s) => /Nothing is sent yet/.test(s.detail)));
});

test('Dismissed suggestions stay hidden for the day', () => {
  const out = rules.computeSuggestions({ now, timeZone: 'Asia/Tokyo', plannedPostTimes: [], threads: [thread()], dismissedKeys: new Set(['draft_reply:t1', 'create_post_draft:2026-10-09']) });
  assert.equal(out.length, 0);
});

test('Time zone helpers', () => {
  assert.equal(rules.zoneOffset(now, 'Asia/Tokyo'), '+09:00');
  assert.equal(rules.localDate(new Date('2026-10-09T16:00:00Z'), 'Asia/Tokyo'), '2026-10-10');
  assert.equal(rules.eveningSlot('2026-10-10', 'Asia/Tokyo'), '2026-10-10T11:00:00.000Z');
});
