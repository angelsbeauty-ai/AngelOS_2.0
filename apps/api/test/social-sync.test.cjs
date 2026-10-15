// Social sync helpers: conversations → threads shape, posts, permission reasons. Fake fetch only (read-only GETs).
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../dist/sync/meta-sync.js');
const fake = (responses) => { const calls = []; return { calls, fetch: async (url) => { calls.push(url); const r = responses.shift(); return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json }; } }; };

test('facebook conversations: contact = non-page participant, messages oldest first', async () => {
  const f = fake([{ json: { data: [{ participants: { data: [{ id: 'PAGE', name: 'Angels Beauty' }, { id: 'U1', name: 'Mika' }] }, messages: { data: [
    { id: 'm2', message: 'Thanks!', from: { id: 'PAGE' }, created_time: '2026-10-02T10:00:00+0000' },
    { id: 'm1', message: 'Is Saturday free?', from: { id: 'U1', name: 'Mika' }, created_time: '2026-10-01T10:00:00+0000' }] } }] } }]);
  const out = await s.fetchConversations({ graphBase: 'https://g', pageId: 'PAGE', ownId: 'PAGE', token: 't', platform: 'facebook' }, f.fetch);
  assert.equal(out.length, 1); assert.equal(out[0].contactId, 'U1'); assert.equal(out[0].contactName, 'Mika');
  assert.deepEqual(out[0].messages.map((m) => m.id), ['m1', 'm2']);
  assert.ok(f.calls[0].includes('/PAGE/conversations?')); assert.ok(!f.calls[0].includes('platform=instagram'));
});
test('instagram conversations use platform=instagram and the IG account as own id', async () => {
  const f = fake([{ json: { data: [{ participants: { data: [{ id: 'IG1', username: 'angels' }, { id: 'C9', username: 'kana' }] }, messages: { data: [] } }] } }]);
  const out = await s.fetchConversations({ graphBase: 'https://g', pageId: 'PAGE', ownId: 'IG1', token: 't', platform: 'instagram' }, f.fetch);
  assert.equal(out[0].contactId, 'C9'); assert.equal(out[0].contactName, 'kana');
  assert.ok(f.calls[0].includes('platform=instagram'));
});
test('permission error → plain "Needs permission" reason', async () => {
  const f = fake([{ ok: false, status: 403, json: { error: { code: 10, message: '(#10) This endpoint requires the pages_messaging permission' } } }]);
  await assert.rejects(s.fetchConversations({ graphBase: 'https://g', pageId: 'P', ownId: 'P', token: 't', platform: 'facebook' }, f.fetch), (e) => {
    assert.match(s.plainGraphReason(e, 'pages_messaging'), /^Needs permission: pages_messaging/); return true; });
});
test('instagram posts stop at the 90-day cutoff and map formats', async () => {
  const now = Date.parse('2026-10-16T00:00:00Z');
  const f = fake([{ json: { data: [
    { id: 'a', caption: 'Brows\nmore', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-10-10T00:00:00+0000', permalink: 'https://ig/a' },
    { id: 'b', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-09-01T00:00:00+0000' },
    { id: 'old', media_type: 'IMAGE', timestamp: '2026-05-01T00:00:00+0000' }] } }]);
  const out = await s.fetchInstagramPosts({ graphBase: 'https://g', igUserId: 'IG', token: 't', days: 90 }, f.fetch, now);
  assert.deepEqual(out.map((p) => [p.id, p.format]), [['a', 'reel'], ['b', 'carousel']]);
  assert.equal(s.postTitle(out[0].caption, 'instagram', out[0].createdAt), 'Brows');
  assert.equal(s.postTitle('', 'facebook', '2026-09-01T00:00:00.000Z'), 'Facebook post 2026-09-01');
});
