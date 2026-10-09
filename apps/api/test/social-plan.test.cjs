// B0.5 planning logic + mock captions. No network, no database, no AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const plan = require('../dist/content/social-plan.js');
const { mockTaskResponse } = require('../dist/ai/mock-provider.js');
const { LineMessagingAdapter } = require('../dist/messaging/line-messaging.adapter.js');

test('30-day mix is 40/25/15/10/10 and sums to the total', () => {
  assert.deepEqual(plan.mixCounts(10), { results: 4, education: 3, behind_the_scenes: 1, testimonial: 1, offer: 1 });
  for (const n of [3, 7, 12, 16]) assert.equal(Object.values(plan.mixCounts(n)).reduce((a, b) => a + b, 0), n);
});

test('planPosts spreads posts inside the range, one per day, avoiding busy days', () => {
  const posts = plan.planPosts({ startsOn: '2026-10-10', endsOn: '2026-11-08', count: 12, busyDays: ['2026-10-10'] });
  assert.equal(posts.length, 12);
  const dates = posts.map((p) => p.date);
  assert.equal(new Set(dates).size, 12);
  assert.ok(!dates.includes('2026-10-10'));
  assert.ok(dates.every((d) => d >= '2026-10-10' && d <= '2026-11-08'));
  for (let i = 1; i < posts.length; i++) if (posts[i].category === posts[i - 1].category) assert.equal(posts[i].category, 'results');
});

test('campaign plan has 3..10 posts and a LINE broadcast inside the dates', () => {
  const p = plan.planCampaign({ startsOn: '2026-12-01', endsOn: '2026-12-14', goal: 'academy_students' });
  assert.ok(p.posts.length >= 3 && p.posts.length <= 10, String(p.posts.length));
  assert.ok(p.posts.some((x) => x.category === 'offer'));
  assert.ok(p.lineBroadcastOn >= '2026-12-01' && p.lineBroadcastOn <= '2026-12-14');
  assert.ok(plan.planCampaign({ startsOn: '2026-12-01', endsOn: '2027-02-28', goal: 'bookings' }).posts.length <= 10);
});

test('seasonal ideas include Japan dates in the window', () => {
  const ideas = plan.seasonalIdeas('2026-12-10', 60);
  assert.ok(ideas.some((i) => i.key === 'season:seijinshiki:2027'));
  assert.ok(ideas.some((i) => i.key.startsWith('season:nenmatsu')));
  assert.ok(ideas.every((i) => i.date >= '2026-12-10'));
});

test('mock caption list parses; bad answers fall back', () => {
  const titles = ['A', 'B', 'C'];
  const text = mockTaskResponse({ instructions: `CONTENT_PLAN_CAPTIONS\ntitles=${JSON.stringify(titles)}`, input: '' });
  assert.equal(plan.parseCaptionList(text, 3).length, 3);
  assert.equal(plan.parseCaptionList('not json', 3), null);
  assert.equal(plan.parseCaptionList('["only one"]', 3), null);
  assert.match(plan.starterCaption({ category: 'offer', title: 'Booking open' }, '10% off'), /10% off/);
});

test('mock LINE broadcast draft is Japanese only', () => {
  const ja = mockTaskResponse({ instructions: 'LINE_BROADCAST_DRAFT', input: 'x' });
  assert.match(ja, /[\u3040-\u30ff]/);
  assert.ok(!/[A-Za-z]{4,}/.test(ja.replace(/LINE/g, '')));
});

test('LINE estimate text is honest when not connected and warns when over quota', () => {
  assert.match(plan.lineEstimateText(null, null, null), /Connect LINE/);
  assert.match(plan.lineEstimateText(120, 200, 150), /more than you have left/);
});

test('LINE broadcast refuses when LINE is not configured (flag off)', async () => {
  const adapter = new LineMessagingAdapter({ enabled: false, channelSecret: undefined, channelAccessToken: undefined, apiBase: 'https://example.invalid' }, async () => { throw new Error('must not call network'); });
  const r = await adapter.broadcast('こんにちは', 'k');
  assert.equal(r.status, 'failed');
  assert.deepEqual(await adapter.audienceEstimate(), { recipients: null, quota: null, used: null, asOf: null });
});
