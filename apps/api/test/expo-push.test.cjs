// M48 server push helpers. No network: fetch is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../dist/push/expo-push.js');

test('builds one push per valid Expo token, opens the chat, android channel', () => {
  const m = p.buildMessagePush([{ token: 'ExponentPushToken[abc]', platform: 'ios' }, { token: 'junk', platform: 'ios' }, { token: 'ExpoPushToken[x]', platform: 'android' }], { threadId: 't1', title: 'Yui', body: 'x'.repeat(200), badge: 3 });
  assert.equal(m.length, 2);
  assert.deepEqual(m[0].data, { threadId: 't1' });
  assert.equal(m[0].body.length, 118);
  assert.equal(m[1].channelId, 'messages');
  assert.equal(m[0].badge, 3);
});

test('mute is respected until it ends', () => {
  assert.equal(p.isMuted('9999-12-31T00:00:00Z'), true);
  assert.equal(p.isMuted('2000-01-01T00:00:00Z'), false);
  assert.equal(p.isMuted(null), false);
});

test('sends in chunks and reports dead tokens', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true, json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }) }; };
  const r = await p.sendExpoPush([{ to: 'A' }, { to: 'B' }], fake);
  assert.equal(calls[0][0], 'https://exp.host/--/api/v2/push/send');
  assert.deepEqual(r, { sent: 1, invalid: ['B'] });
  assert.deepEqual(await p.sendExpoPush([], fake), { sent: 0, invalid: [] });
});
