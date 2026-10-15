// AI model switch: off by default, caps fall back to the current model. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../dist/ai/model-policy.js');

test('switch is off by default', () => {
  p.resetModelUsage();
  assert.deepEqual(p.chooseModel('u1', new Date(), {}), { model: 'gpt-5.6-terra', reason: 'default' });
});
test('enabled: uses gpt-6-luna until the daily cap, then falls back', () => {
  p.resetModelUsage(); process.env.AI_DAILY_CAP_PER_USER = '2'; process.env.AI_MONTHLY_CAP_PER_USER = '3';
  const env = { AI_NEXT_MODEL_ENABLED: 'true' }; const d1 = new Date('2026-10-16T01:00:00Z');
  assert.equal(p.chooseModel('u1', d1, env).model, 'gpt-6-luna');
  assert.equal(p.chooseModel('u1', d1, env).model, 'gpt-6-luna');
  assert.deepEqual(p.chooseModel('u1', d1, env), { model: 'gpt-5.6-terra', reason: 'daily_cap' });
  assert.equal(p.chooseModel('u2', d1, env).reason, 'next');
  const d2 = new Date('2026-10-17T01:00:00Z');
  assert.equal(p.chooseModel('u1', d2, env).reason, 'next');
  assert.equal(p.chooseModel('u1', d2, env).reason, 'monthly_cap');
  delete process.env.AI_DAILY_CAP_PER_USER; delete process.env.AI_MONTHLY_CAP_PER_USER;
});
test('no user id never gets the next model', () => {
  assert.equal(p.chooseModel(undefined, new Date(), { AI_NEXT_MODEL_ENABLED: 'true' }).reason, 'no_user');
});
