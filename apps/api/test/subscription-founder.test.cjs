const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesStagingFounderEnv } = require('../dist/common/guards/subscription-access.guard.js');

test('staging founders skip read-only by id or email; production does not', () => {
  const prev = { ids: process.env.FOUNDER_USER_IDS, email: process.env.FOUNDER_EMAIL };
  process.env.FOUNDER_USER_IDS = 'founder-1, founder-2';
  process.env.FOUNDER_EMAIL = 'Angel@studio.test';
  assert.equal(matchesStagingFounderEnv('staging', 'founder-2', 'other@studio.test'), true);
  assert.equal(matchesStagingFounderEnv('staging', 'student-1', 'angel@studio.test'), true);
  assert.equal(matchesStagingFounderEnv('staging', 'student-1', 'student@studio.test'), false);
  assert.equal(matchesStagingFounderEnv('production', 'founder-1', 'angel@studio.test'), false);
  assert.equal(matchesStagingFounderEnv('development', 'founder-1', null), false);
  if (prev.ids === undefined) delete process.env.FOUNDER_USER_IDS; else process.env.FOUNDER_USER_IDS = prev.ids;
  if (prev.email === undefined) delete process.env.FOUNDER_EMAIL; else process.env.FOUNDER_EMAIL = prev.email;
});
