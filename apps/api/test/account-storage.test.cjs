const test = require('node:test');
const assert = require('node:assert/strict');
const { purgeWorkspaceStorage } = require('../dist/account/account-storage.js');

function fake(rows, failBucket) {
  const removed = [];
  return { removed, from: (t) => ({ select: () => ({ eq: async (col, v) => { assert.equal(t, 'media_assets'); assert.equal(col, 'workspace_id'); return { data: rows.filter((r) => r.ws === v), error: null }; } }) }),
    storage: { from: (b) => ({ remove: async (p) => { if (b === failBucket) return { error: { message: 'nope' } }; removed.push([b, p]); return { error: null }; } }) } };
}

test('delete account: removes every storage file of the studio, chunked by bucket', async () => {
  const rows = [...Array(150)].map((_, i) => ({ ws: 'w1', storage_bucket: 'media', storage_path: `w1/${i}.jpg` }))
    .concat([{ ws: 'w1', storage_bucket: null, storage_path: 'w1/x.jpg' }, { ws: 'w1', storage_bucket: 'media', storage_path: null }, { ws: 'w2', storage_bucket: 'media', storage_path: 'w2/a.jpg' }]);
  const s = fake(rows);
  assert.equal(await purgeWorkspaceStorage(s, 'w1'), 151);
  assert.ok(s.removed.every(([, p]) => p.every((x) => x.startsWith('w1/'))), 'never touches another studio');
  assert.ok(s.removed.every(([, p]) => p.length <= 100));
});

test('delete account: a storage error stops the delete', async () => {
  await assert.rejects(purgeWorkspaceStorage(fake([{ ws: 'w1', storage_bucket: 'media', storage_path: 'w1/a' }], 'media'), 'w1'), /Could not delete studio media/);
});
