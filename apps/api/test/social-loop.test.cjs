// Social minimum loop: token sealing, post status rollup, failure reasons, numbers (fake fetch only).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../dist/social/token-crypto.js');
const pub = require('../dist/social/social-publisher.service.js');
const ins = require('../dist/social/meta-insights.js');
const { LineMessagingAdapter } = require('../dist/messaging/line-messaging.adapter.js');
const { readMetaConfig } = require('../dist/meta/meta.config.js');
const env = { SOCIAL_TOKEN_KEY: 'a-long-random-test-key-123456' };

test('tokens seal and open; no key = refuse', () => {
  const s = crypto.sealToken('secret-token', env);
  assert.notEqual(s, 'secret-token'); assert.equal(crypto.openToken(s, env), 'secret-token');
  assert.equal(crypto.tokenKeyReady({}), false);
  assert.throws(() => crypto.sealToken('x', {}));
  assert.throws(() => crypto.openToken(s, { SOCIAL_TOKEN_KEY: 'another-long-random-key-999' }));
});
test('post status rollup', () => {
  assert.equal(pub.rollupStatus(['published', 'published']), 'published');
  assert.equal(pub.rollupStatus(['published', 'scheduled']), 'scheduled');
  assert.equal(pub.rollupStatus(['published', 'failed']), 'failed');
  assert.equal(pub.rollupStatus(['published', 'archived']), 'published');
});
test('failure reasons are plain and specific', () => {
  assert.match(pub.notConnectedReason('line'), /Connect LINE/);
  assert.match(pub.notConnectedReason('instagram'), /Instagram isn't connected/);
  assert.match(pub.notConnectedReason('tiktok'), /TikTok isn't connected yet/);
  for (const p of ['instagram', 'facebook', 'tiktok', 'line', 'x']) assert.doesNotMatch(pub.notConnectedReason(p), /postiz|key/i);
});
test('Meta numbers: followers + likes/comments, unknown stays null', async () => {
  const replies = [{ followers_count: 1200, media_count: 40 }, { data: [{ like_count: 10, comments_count: 2 }, { like_count: 5 }] }];
  const f = async () => { const j = replies.shift(); return { ok: true, json: async () => j }; };
  const n = await ins.metaNumbers('instagram', { ...readMetaConfig({}), igUserId: 'IG1', pageToken: 't' }, f);
  assert.deepEqual(n, { followers: 1200, engagement: 17, posts: 40, name: null, pictureUrl: null, error: null });
  const bad = await ins.metaNumbers('facebook', { ...readMetaConfig({}), pageId: 'P', pageToken: 't' }, async () => ({ ok: false, json: async () => ({ error: {} }) }));
  assert.equal(bad.followers, null); assert.equal(bad.engagement, null); assert.equal(bad.posts, null); assert.ok(bad.error);
  assert.equal(ins.metaReadReady('instagram', { ...readMetaConfig({}), igUserId: 'IG1', pageToken: 't' }), true);
  assert.equal(ins.metaReadReady('facebook', { ...readMetaConfig({ META_PUBLISHING_ENABLED: 'false' }), pageId: 'P', pageToken: 't' }), true);
  assert.equal(ins.metaReadReady('facebook', readMetaConfig({})), false);
});
test('LINE friend count; not ready = null', async () => {
  const a = new LineMessagingAdapter({ enabled: true, channelSecret: 's', channelAccessToken: 't', apiBase: 'https://x' }, async () => ({ ok: true, json: async () => ({ status: 'ready', followers: 300, targetedReaches: 280, blocks: 20 }) }));
  const r = await a.followers(new Date('2026-10-16T00:00:00Z'));
  assert.equal(r.followers, 300); assert.equal(r.date, '20261015');
  const off = await new LineMessagingAdapter({ enabled: false }).followers();
  assert.equal(off.followers, null);
});

test('publish routing: Instagram/Facebook via Meta, Threads/TikTok via Postiz', () => {
  const { publishRoute, POSTIZ_PLATFORMS } = require('../dist/content/postiz-publishing.adapter.js');
  assert.equal(publishRoute('instagram'), 'meta');
  assert.equal(publishRoute('instagram_reel'), 'meta');
  assert.equal(publishRoute('facebook'), 'meta');
  assert.equal(publishRoute('threads'), 'postiz');
  assert.equal(publishRoute('tiktok'), 'postiz');
  assert.equal(publishRoute('line'), 'line');
  assert.deepEqual(POSTIZ_PLATFORMS.filter((p) => p === 'instagram' || p === 'facebook'), []);
});
