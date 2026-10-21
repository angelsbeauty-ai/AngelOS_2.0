const test = require('node:test');
const assert = require('node:assert/strict');
const { lineConfigFromRow } = require('../dist/messaging/line-workspace-config.js');
const { LineMessagingAdapter } = require('../dist/messaging/line-messaging.adapter.js');

const off = { enabled: false };
const open = (v) => v.replace('enc:', '');

test('studio LINE bot from line_connections is used for sending, env only as fallback', () => {
  const cfg = lineConfigFromRow({ status: 'connected', channel_secret_enc: 'enc:sec', access_token_enc: 'enc:tok' }, off, open);
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.channelAccessToken, 'tok');
  assert.equal(lineConfigFromRow(null, off, open), off);
  assert.equal(lineConfigFromRow({ status: 'disconnected', access_token_enc: 'enc:tok' }, off, open), off);
  assert.equal(lineConfigFromRow({ status: 'connected', access_token_enc: 'x' }, off, () => { throw new Error('bad'); }), off);
});

test('manual send from a thread pushes with the studio token', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, headers: { get: () => 'req1' }, text: async () => '' }; };
  const cfg = lineConfigFromRow({ status: 'connected', channel_secret_enc: 'enc:sec', access_token_enc: 'enc:tok' }, off, open);
  const res = await new LineMessagingAdapter(cfg, fetchImpl).send({ externalThreadId: 'line:U123', body: 'Hello', idempotencyKey: 'message:1' });
  assert.equal(res.status, 'sent');
  assert.match(calls[0].url, /\/v2\/bot\/message\/push$/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(calls[0].init.body).to, 'U123');
});
