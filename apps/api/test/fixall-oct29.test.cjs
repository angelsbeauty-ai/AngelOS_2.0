// Test-contact threads are hidden from Messages; the error log never carries tokens.
const test = require('node:test');
const assert = require('node:assert/strict');
const { isDemoSeedThread } = require('../dist/clients/demo-seed.js');
const { redactSecrets, routeOf } = require('../dist/common/all-exceptions.filter.js');

test('test / demo / proof contacts are filtered out of the conversation list', () => {
  assert.equal(isDemoSeedThread({ contact_display_name: 'Test Client A', client: null }), true);
  assert.equal(isDemoSeedThread({ contact_display_name: 'Someone', client: { display_name: 'Proof Client 3', source: 'manual' } }), true);
  assert.equal(isDemoSeedThread({ contact_display_name: 'Aiko', client: { display_name: 'Aiko', source: 'test seed' } }), true);
  assert.equal(isDemoSeedThread({ contact_display_name: 'Test Client', client: null }), false);
  assert.equal(isDemoSeedThread({ contact_display_name: 'Yuki Tanaka', client: { display_name: 'Yuki Tanaka', source: 'instagram' } }), false);
});

test('logged error lines redact tokens and keep route templates', () => {
  const line = redactSecrets('failed Bearer abc.def.ghi with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk and /x?access_token=EAAB123&x=1');
  assert.ok(!/abc\.def|eyJhbGci|EAAB123/.test(line), line);
  assert.match(line, /access_token=\[redacted\]&x=1/);
  assert.equal(routeOf({ baseUrl: '', route: { path: '/workspaces/:workspaceId/messaging/threads' } }), '/workspaces/:workspaceId/messaging/threads');
  assert.equal(routeOf({ originalUrl: '/workspaces/f288867b-5fbf-4f7b-ae7a-fcdbfe4510f9/x?token=1' }), '/workspaces/:id/x');
});
