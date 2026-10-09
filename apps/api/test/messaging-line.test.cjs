// Runs against the compiled API (npm run build:api first). No network, no database, no AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const line = require('../dist/messaging/line-messaging.adapter.js');
const lang = require('../dist/messaging/language.js');
const { mockTaskResponse } = require('../dist/ai/mock-provider.js');
const { buildClientReplyInstructions } = require('../dist/messaging/reply-prompt.js');
const { hasUnfilledPlaceholder, STARTER_SAVED_REPLIES } = require('../dist/messaging/saved-replies.service.js');
const { MetaMessagingAdapter, ManualMessagingAdapter } = require('../dist/messaging/provider-adapter.js');

const secret = 'test-channel-secret';
const body = JSON.stringify({ destination: 'Ubot', events: [{ type: 'message', timestamp: 1700000000000, source: { type: 'user', userId: 'U123' }, message: { id: '999', type: 'text', text: 'こんにちは、予約できますか？' } }] });
const sign = (raw, key = secret) => createHmac('sha256', key).update(raw).digest('base64');

test('LINE signature: valid signature passes', () => {
  assert.equal(line.verifyLineSignature(Buffer.from(body), sign(body), secret), true);
});
test('LINE signature: tampered body, wrong secret, missing header all fail', () => {
  assert.equal(line.verifyLineSignature(Buffer.from(body + ' '), sign(body), secret), false);
  assert.equal(line.verifyLineSignature(Buffer.from(body), sign(body, 'other'), secret), false);
  assert.equal(line.verifyLineSignature(Buffer.from(body), undefined, secret), false);
  assert.equal(line.verifyLineSignature(Buffer.from(body), sign(body), undefined), false);
  assert.equal(line.verifyLineSignature(Buffer.from(body), 'not-base64!!', secret), false);
});
test('LINE is OFF by default and needs both secrets', () => {
  assert.equal(line.lineStatus(line.readLineConfig({})).ready, false);
  assert.equal(line.lineStatus(line.readLineConfig({})).state, 'disabled');
  assert.equal(line.lineStatus(line.readLineConfig({ LINE_MESSAGING_ENABLED: 'true' })).state, 'needs_setup');
  assert.equal(line.lineStatus(line.readLineConfig({ LINE_MESSAGING_ENABLED: 'true', LINE_CHANNEL_SECRET: 'a', LINE_CHANNEL_ACCESS_TOKEN: 'b' })).ready, true);
});
test('LINE webhook parsing gives the shared thread/message structure; voice is never stored', () => {
  const events = line.parseLineWebhook({ destination: 'Ubot', events: [
    ...JSON.parse(body).events,
    { type: 'follow', source: { type: 'user', userId: 'U1' } },
    { type: 'message', source: { type: 'user', userId: 'U2' }, message: { id: '5', type: 'audio' } }
  ] });
  assert.equal(events.length, 2);
  assert.deepEqual(Object.keys(events[0]).sort(), ['body', 'externalAccountId', 'externalMessageId', 'externalThreadId', 'externalUserId', 'provider', 'sentAt']);
  assert.equal(events[0].externalThreadId, 'line:U123');
  assert.equal(events[0].externalAccountId, 'Ubot');
  assert.match(events[1].body, /not stored/);
});
test('LINE send: disabled adapter never calls the network', async () => {
  let called = false;
  const adapter = new line.LineMessagingAdapter(line.readLineConfig({}), async () => { called = true; return new Response('{}'); });
  const result = await adapter.send({ externalThreadId: 'line:U1', body: 'hi', idempotencyKey: 'k' });
  assert.equal(result.status, 'failed');
  assert.equal(called, false);
});
test('LINE send: push uses a stable UUID retry key', async () => {
  const seen = [];
  const config = { ...line.readLineConfig({ LINE_MESSAGING_ENABLED: 'true', LINE_CHANNEL_SECRET: 's', LINE_CHANNEL_ACCESS_TOKEN: 't' }) };
  const adapter = new line.LineMessagingAdapter(config, async (url, init) => { seen.push({ url, init }); return new Response('{}', { status: 200, headers: { 'x-line-request-id': 'r1' } }); });
  const result = await adapter.send({ externalThreadId: 'line:U1', body: 'hi', idempotencyKey: 'message:abc' });
  assert.equal(result.status, 'sent');
  assert.match(seen[0].url, /\/v2\/bot\/message\/push$/);
  assert.equal(JSON.parse(seen[0].init.body).to, 'U1');
  assert.match(seen[0].init.headers['X-Line-Retry-Key'], /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(line.retryKeyFor('message:abc'), line.retryKeyFor('message:abc'));
});
test('Instagram / Facebook adapters are honest stubs', async () => {
  for (const provider of ['instagram', 'facebook']) {
    const adapter = new MetaMessagingAdapter(provider);
    assert.equal(adapter.status().ready, false);
    assert.equal(adapter.status().state, 'needs_meta_approval');
    assert.equal((await adapter.send()).status, 'failed');
  }
  assert.equal((await new ManualMessagingAdapter().send({ externalThreadId: 'x', body: 'y', idempotencyKey: 'z' })).status, 'manual');
});
test('Reply language matches the client and never mixes EN and JA', () => {
  assert.equal(lang.chooseReplyLanguage('予約できますか？', 'en'), 'ja');
  assert.equal(lang.chooseReplyLanguage('Can I book?', 'ja'), 'en');
  assert.equal(lang.chooseReplyLanguage('👍', 'ja'), 'ja');
  assert.equal(lang.mixesLanguages('ありがとうございます✨ See you on Saturday at the studio!', 'ja'), true);
  assert.equal(lang.mixesLanguages('ありがとうございます✨ LINEで予約してくださいね https://example.com/book', 'ja'), false);
  assert.equal(lang.mixesLanguages('Thank you! ありがとう', 'en'), true);
});
test('Mock drafts are deterministic, casual Japanese for JA clients, never mixed', () => {
  const ja = mockTaskResponse({ instructions: buildClientReplyInstructions({ language: 'ja', clientName: '山田', intent: 'booking', knownClient: true, doNotAutoMessage: false }), input: 'x' });
  assert.equal(ja, '山田さん、メッセージありがとうございます✨ 確認してすぐにお返事しますね🌸');
  assert.equal(lang.mixesLanguages(ja, 'ja'), false);
  const en = mockTaskResponse({ instructions: buildClientReplyInstructions({ language: 'en', clientName: 'Yuna', intent: 'price', knownClient: true, doNotAutoMessage: false }), input: 'x' });
  assert.match(en, /^Hi Yuna/);
  assert.equal(lang.mixesLanguages(en, 'en'), false);
});
test('Starter saved replies: JA versions are Japanese-only and [brackets] block approval', () => {
  for (const reply of STARTER_SAVED_REPLIES) {
    assert.equal(lang.mixesLanguages(reply.body_ja.replace('{name}', '山田'), 'ja'), false, reply.title);
    assert.equal(lang.mixesLanguages(reply.body_en.replace('{name}', 'Yuna'), 'en'), false, reply.title);
  }
  assert.equal(hasUnfilledPlaceholder('Brows [price] yen'), true);
  assert.equal(hasUnfilledPlaceholder('Brows 45,000 yen'), false);
});
