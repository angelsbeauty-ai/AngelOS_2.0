// Postiz scheduling adapter: schedule body, cancel, status. Fake fetch only (staging e2e lives in scripts/postiz-staging-e2e.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const { PostizPublishingAdapter, postizBase } = require('../dist/content/postiz-publishing.adapter.js');
const fake = (responses) => { const calls = []; return { calls, fetch: async (url, init) => { calls.push({ url, init }); const r = responses.shift(); return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json }; } }; };
const input = { platform: 'instagram', format: 'photo', caption: 'Hi', hashtags: ['#nails'], idempotencyKey: 'k', scheduledFor: '2026-12-01T10:00:00.000Z' };

test('self-hosted base from env', () => {
  assert.equal(postizBase({ POSTIZ_API_URL: 'https://x.example/api/public/v1/' }), 'https://x.example/api/public/v1');
  assert.equal(postizBase({}), 'https://api.postiz.com/public/v1');
});
test('no key: not_configured, no network', async () => {
  const f = fake([]); const r = await new PostizPublishingAdapter('', f.fetch, 'https://b').schedule(input);
  assert.equal(r.code, 'not_configured'); assert.equal(f.calls.length, 0);
});
test('schedule sends type schedule at the chosen date', async () => {
  const ints = [{ id: 'ig1', identifier: 'instagram' }];
  const f = fake([{ json: ints }, { json: ints }, { json: [{ postId: 'p9', integration: 'ig1' }] }]);
  const r = await new PostizPublishingAdapter('k', f.fetch, 'https://b').schedule(input);
  assert.equal(r.ok, true); assert.equal(r.providerPostId, 'p9');
  const body = JSON.parse(f.calls[2].init.body);
  assert.equal(f.calls[2].url, 'https://b/posts');
  assert.equal(body.type, 'schedule'); assert.equal(body.date, input.scheduledFor);
  assert.equal(body.posts[0].integration.id, 'ig1'); assert.equal(body.posts[0].settings.__type, 'instagram');
  assert.match(body.posts[0].value[0].content, /#nails/);
});
test('no channel connected: no_channel, nothing created', async () => {
  const f = fake([{ json: [] }, { json: [] }]);
  const r = await new PostizPublishingAdapter('k', f.fetch, 'https://b').schedule(input);
  assert.equal(r.code, 'no_channel'); assert.equal(f.calls.length, 2);
});
test('bad key: auth', async () => {
  const f = fake([{ status: 401, json: { msg: 'Invalid API key' } }, { status: 401, json: {} }]);
  assert.equal((await new PostizPublishingAdapter('k', f.fetch, 'https://b').schedule(input)).code, 'auth');
});
test('cancel deletes by id; 404 counts as gone', async () => {
  const f = fake([{ json: { id: 'p9' } }, { status: 404, json: {} }, { status: 500, json: {} }]);
  const a = new PostizPublishingAdapter('k', f.fetch, 'https://b');
  assert.equal((await a.cancel('p9')).ok, true); assert.equal(f.calls[0].init.method, 'DELETE'); assert.equal(f.calls[0].url, 'https://b/posts/p9');
  assert.equal((await a.cancel('p9')).ok, true);
  assert.equal((await a.cancel('p9')).ok, false);
});
