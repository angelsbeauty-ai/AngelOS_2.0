// Social account status from the existing Meta flags: not connected / connected / ~60-day token reconnect.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readMetaConfig } = require('../dist/meta/meta.config.js');
const { metaAccountStatus } = require('../dist/meta/meta-accounts.js');
const on = { META_PUBLISHING_ENABLED: 'true', META_PAGE_ACCESS_TOKEN: 'x', META_IG_USER_ID: '1', META_PAGE_ID: '2' };
const now = new Date('2026-10-16T00:00:00Z');
test('off by default', () => { assert.equal(metaAccountStatus('instagram', readMetaConfig({}), now).status, 'not_connected'); });
test('connected when flags + keys, token far away', () => {
  const r = metaAccountStatus('instagram', readMetaConfig({ ...on, META_TOKEN_EXPIRES_AT: '2026-12-10T00:00:00Z' }), now);
  assert.equal(r.status, 'connected'); assert.equal(r.tokenExpiresAt, '2026-12-10T00:00:00.000Z');
});
test('connected when no expiry is known', () => { assert.equal(metaAccountStatus('facebook', readMetaConfig(on), now).status, 'connected'); });
test('needs reconnect inside 7 days and after expiry', () => {
  assert.equal(metaAccountStatus('instagram', readMetaConfig({ ...on, META_TOKEN_EXPIRES_AT: '2026-10-20T00:00:00Z' }), now).status, 'needs_reconnect');
  const r = metaAccountStatus('facebook', readMetaConfig({ ...on, META_TOKEN_EXPIRES_AT: '2026-10-01T00:00:00Z' }), now);
  assert.equal(r.status, 'needs_reconnect'); assert.match(r.detail, /expired/);
});
test('bad date is ignored', () => { assert.equal(metaAccountStatus('instagram', readMetaConfig({ ...on, META_TOKEN_EXPIRES_AT: 'soon' }), now).status, 'connected'); });
