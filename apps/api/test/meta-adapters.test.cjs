// Meta adapters: off by default, signature check, webhook parsing, IG container→publish, send switch. Fake fetch only.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readMetaConfig } = require('../dist/meta/meta.config.js');
const pub = require('../dist/meta/meta-publishing.adapter.js');
const msg = require('../dist/meta/meta-messaging.adapter.js');
const cfg = (over = {}) => ({ ...readMetaConfig({}), ...over });
const fake = (responses) => { const calls = []; return { calls, fetch: async (url, init) => { calls.push({ url, init }); const r = responses.shift(); return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json }; } }; };

test('everything is off with no env', () => {
  const c = readMetaConfig({});
  assert.equal(pub.metaPublishingReady('instagram', c), false);
  assert.equal(new msg.MetaGraphMessagingAdapter('instagram', c).status().ready, false);
});
test('signature: valid passes, wrong fails', () => {
  const body = '{"a":1}'; const sig = 'sha256=' + crypto.createHmac('sha256', 's3').update(body).digest('hex');
  assert.equal(msg.verifyMetaSignature(body, sig, 's3'), true);
  assert.equal(msg.verifyMetaSignature(body, sig, 'other'), false);
  assert.equal(msg.verifyMetaSignature(body, undefined, 's3'), false);
});
test('webhook parse: IG message in, echo skipped', () => {
  const out = msg.parseMetaWebhook({ object: 'instagram', entry: [{ id: 'IG1', messaging: [{ sender: { id: 'u1' }, recipient: { id: 'IG1' }, timestamp: 1, message: { mid: 'm1', text: '予約できますか？' } }, { sender: { id: 'IG1' }, message: { mid: 'm2', text: 'x', is_echo: true } }] }] });
  assert.equal(out.length, 1); assert.equal(out[0].externalThreadId, 'instagram:u1'); assert.equal(out[0].externalMessageId, 'instagram:m1');
});
test('IG publish: container then media_publish', async () => {
  const f = fake([{ json: { id: 'C1' } }, { json: { id: 'P1' } }]);
  const a = new pub.MetaPublishingAdapter(cfg({ publishingEnabled: true, pageToken: 'tok', igUserId: 'IG1' }), f.fetch);
  const r = await a.publish({ platform: 'instagram', format: 'photo', caption: 'hi', hashtags: ['#a'], idempotencyKey: 'k', imageUrl: 'https://x/y.jpg' });
  assert.equal(r.status, 'published'); assert.equal(r.providerPostId, 'P1');
  assert.match(f.calls[0].url, /IG1\/media$/); assert.match(f.calls[1].url, /IG1\/media_publish$/);
});
test('IG publish without photo fails honestly', async () => {
  const a = new pub.MetaPublishingAdapter(cfg({ publishingEnabled: true, pageToken: 'tok', igUserId: 'IG1' }), async () => { throw new Error('no call'); });
  assert.equal((await a.publish({ platform: 'instagram', format: 'photo', caption: 'hi', hashtags: [], idempotencyKey: 'k' })).status, 'failed');
});
test('DM send stays manual unless the send switch is on', async () => {
  const base = { messagingEnabled: true, appSecret: 's', pageToken: 't', igUserId: 'IG1' };
  const off = new msg.MetaGraphMessagingAdapter('instagram', cfg(base), async () => { throw new Error('no call'); });
  assert.equal((await off.send({ externalThreadId: 'instagram:u1', body: 'hi', idempotencyKey: 'k' })).status, 'manual');
  const f = fake([{ json: { message_id: 'mm' } }]);
  const on = new msg.MetaGraphMessagingAdapter('instagram', cfg({ ...base, sendEnabled: true }), f.fetch);
  assert.equal((await on.send({ externalThreadId: 'instagram:u1', body: 'hi', idempotencyKey: 'k' })).status, 'sent');
});
