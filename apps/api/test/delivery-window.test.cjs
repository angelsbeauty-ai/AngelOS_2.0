const test = require('node:test');
const assert = require('node:assert/strict');
const { LineMessagingAdapter, parseLineWebhook, replyTokenFresh } = require('../dist/messaging/line-messaging.adapter');
const { MetaGraphMessagingAdapter, metaWindow } = require('../dist/meta/meta-messaging.adapter');

const lineCfg = { enabled: true, channelSecret: 's', channelAccessToken: 't', apiBase: 'https://line.test' };
function fakeFetch(responses, calls) {
  return async (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); const r = responses.shift(); return { ok: r.ok, status: r.status, headers: new Map([['x-line-request-id', 'rq']]), json: async () => r.json || {}, text: async () => '' }; };
}

test('LINE webhook keeps the reply token', () => {
  const [m] = parseLineWebhook({ destination: 'B', events: [{ type: 'message', replyToken: 'rt1', timestamp: Date.now(), source: { type: 'user', userId: 'U1' }, message: { id: '9', type: 'text', text: 'hi' } }] });
  assert.equal(m.replyToken, 'rt1');
});

test('reply token is fresh only under 50s', () => {
  const now = Date.now();
  assert.equal(replyTokenFresh(new Date(now - 10_000).toISOString(), now), true);
  assert.equal(replyTokenFresh(new Date(now - 70_000).toISOString(), now), false);
  assert.equal(replyTokenFresh(null, now), false);
});

test('LINE uses free reply API with a fresh token', async () => {
  const calls = []; const a = new LineMessagingAdapter(lineCfg, fakeFetch([{ ok: true, status: 200 }], calls));
  const r = await a.send({ externalThreadId: 'line:U1', body: 'hi', idempotencyKey: 'k', replyToken: 'rt', lastInboundAt: new Date().toISOString() });
  assert.equal(r.status, 'sent'); assert.match(calls[0].url, /reply$/); assert.equal(r.raw.transport, 'line-reply');
});

test('LINE falls back to push when reply fails or token is stale', async () => {
  const calls = []; const a = new LineMessagingAdapter(lineCfg, fakeFetch([{ ok: false, status: 400 }, { ok: true, status: 200 }], calls));
  const r = await a.send({ externalThreadId: 'line:U1', body: 'hi', idempotencyKey: 'k', replyToken: 'rt', lastInboundAt: new Date().toISOString() });
  assert.equal(r.status, 'sent'); assert.match(calls[1].url, /push$/);
  const calls2 = []; const b = new LineMessagingAdapter(lineCfg, fakeFetch([{ ok: true, status: 200 }], calls2));
  await b.send({ externalThreadId: 'line:U1', body: 'hi', idempotencyKey: 'k', replyToken: 'rt', lastInboundAt: new Date(Date.now() - 120_000).toISOString() });
  assert.equal(calls2.length, 1); assert.match(calls2[0].url, /push$/);
});

test('Meta window: open, human agent, closed', () => {
  const now = Date.now(); const h = 3_600_000;
  assert.equal(metaWindow(new Date(now - h).toISOString(), now), 'open');
  assert.equal(metaWindow(new Date(now - 30 * h).toISOString(), now), 'human_agent');
  assert.equal(metaWindow(new Date(now - 8 * 24 * h).toISOString(), now), 'closed');
});

const metaCfg = { messagingEnabled: true, sendEnabled: true, appSecret: 'x', pageToken: 'p', pageId: 'P', igUserId: 'I', graphBase: 'https://g.test' };
test('Meta uses HUMAN_AGENT tag after 24h and refuses after 7 days', async () => {
  const calls = []; const a = new MetaGraphMessagingAdapter('facebook', metaCfg, fakeFetch([{ ok: true, status: 200, json: { message_id: 'm' } }], calls));
  const r = await a.send({ externalThreadId: 'facebook:1', body: 'hi', idempotencyKey: 'k', lastInboundAt: new Date(Date.now() - 30 * 3_600_000).toISOString() });
  assert.equal(r.status, 'sent'); assert.equal(calls[0].body.messaging_type, 'MESSAGE_TAG'); assert.equal(calls[0].body.tag, 'HUMAN_AGENT');
  const calls2 = []; const b = new MetaGraphMessagingAdapter('facebook', metaCfg, fakeFetch([], calls2));
  const r2 = await b.send({ externalThreadId: 'facebook:1', body: 'hi', idempotencyKey: 'k', lastInboundAt: new Date(Date.now() - 9 * 24 * 3_600_000).toISOString() });
  assert.equal(r2.status, 'failed'); assert.equal(calls2.length, 0);
});
