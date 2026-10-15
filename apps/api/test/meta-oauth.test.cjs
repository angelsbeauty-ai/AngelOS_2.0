// Meta OAuth connect: flag gating, login URL, code exchange + page pick, state signing, token crypto.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readMetaOAuthConfig, buildMetaLoginUrl, exchangeCodeAndListPages, pickPage, META_OAUTH_SCOPES } = require('../dist/meta/meta-oauth.js');
const { encryptToken, decryptToken, signState, readState } = require('../dist/meta/meta-crypto.js');
const env = { META_OAUTH_ENABLED: 'true', META_APP_ID: '123', META_APP_SECRET: 'sec', META_OAUTH_REDIRECT_URI: 'https://api.example/meta/oauth/callback', META_TOKEN_KEY: 'k'.repeat(32) };
test('off unless flag + keys', () => {
  assert.equal(readMetaOAuthConfig({}), null);
  assert.equal(readMetaOAuthConfig({ ...env, META_OAUTH_ENABLED: 'false' }), null);
  assert.equal(readMetaOAuthConfig({ ...env, META_OAUTH_ENABLED: undefined, META_PUBLISHING_ENABLED: 'true' }), null);
  assert.equal(readMetaOAuthConfig({ ...env, META_TOKEN_KEY: 'short' }), null);
  assert.ok(readMetaOAuthConfig(env));
});
test('login url has all scopes and state', () => {
  const u = new URL(buildMetaLoginUrl(readMetaOAuthConfig(env), 'st'));
  assert.equal(u.hostname, 'www.facebook.com'); assert.equal(u.searchParams.get('client_id'), '123'); assert.equal(u.searchParams.get('state'), 'st');
  assert.deepEqual(u.searchParams.get('scope').split(','), META_OAUTH_SCOPES); assert.equal(META_OAUTH_SCOPES.length, 7);
});
test('exchange: short -> long -> pages, picks IG-linked page', async () => {
  const calls = [];
  const f = async (url) => { calls.push(url); const j = (b) => ({ ok: true, status: 200, json: async () => b });
    if (url.includes('fb_exchange_token')) return j({ access_token: 'LONG', expires_in: 5184000 });
    if (url.includes('oauth/access_token')) return j({ access_token: 'SHORT' });
    return j({ data: [{ id: '1', name: 'NoIG', access_token: 'P1' }, { id: '2', name: 'Studio', access_token: 'P2', instagram_business_account: { id: '99', username: 'angel' } }] }); };
  const r = await exchangeCodeAndListPages(readMetaOAuthConfig(env), 'CODE', f, Date.parse('2026-10-16T00:00:00Z'));
  assert.equal(calls.length, 3); assert.equal(r.userToken, 'LONG'); assert.equal(r.expiresAt, '2026-12-15T00:00:00.000Z');
  const p = pickPage(r.pages); assert.equal(p.pageId, '2'); assert.equal(p.igUsername, 'angel'); assert.equal(p.pageToken, 'P2');
});
test('exchange surfaces graph errors', async () => {
  const f = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad code' } }) });
  await assert.rejects(exchangeCodeAndListPages(readMetaOAuthConfig(env), 'x', f), /bad code/);
});
test('state round trip, tamper and expiry', () => {
  const s = signState({ w: 'ws', u: 'u1' }, 'secret', 600, 0);
  assert.deepEqual(readState(s, 'secret', 1000), { w: 'ws', u: 'u1', r: undefined });
  assert.equal(readState(s, 'other', 1000), null); assert.equal(readState(s, 'secret', 601000), null); assert.equal(readState(undefined, 'secret'), null);
});
test('token encrypt/decrypt', () => { const k = 'z'.repeat(32); const b = encryptToken('tok', k); assert.notEqual(b, 'tok'); assert.equal(decryptToken(b, k), 'tok'); assert.throws(() => decryptToken(b, 'y'.repeat(32))); });
test('pending page choice: per studio+user, no tokens exposed, expires', () => {
  const { putPending, getPending, clearPending, publicPages, PENDING_TTL_MS } = require('../dist/meta/meta-pending.js');
  const pages = [{ pageId: '1', pageName: 'Other', pictureUrl: null, igUserId: null, igUsername: null, igPictureUrl: null, pageTokenEnc: 'E1' },
    { pageId: '2', pageName: 'Angels Beauty', pictureUrl: 'p', igUserId: '9', igUsername: 'angelsbeauty', igPictureUrl: null, pageTokenEnc: 'E2' }];
  putPending({ workspaceId: 'w', userId: 'u', userTokenEnc: 'U', pages }, 0);
  assert.equal(getPending('w', 'other', 1), null); assert.equal(getPending('x', 'u', 1), null);
  const p = getPending('w', 'u', 1); assert.equal(p.pages.length, 2);
  const pub = publicPages(p); assert.equal(pub[1].pageName, 'Angels Beauty'); assert.ok(!JSON.stringify(pub).includes('E2'));
  assert.equal(getPending('w', 'u', PENDING_TTL_MS + 1), null);
  putPending({ workspaceId: 'w', userId: 'u', userTokenEnc: 'U', pages }); clearPending('w', 'u'); assert.equal(getPending('w', 'u'), null);
});
