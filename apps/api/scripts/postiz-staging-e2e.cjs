// Staging e2e for post scheduling: key check → channels → schedule (30 days out) → delete.
// Usage: POSTIZ_API_URL=https://<host>/api/public/v1 POSTIZ_API_KEY=... node scripts/postiz-staging-e2e.cjs
// Never prints the key. Deletes what it creates, so nothing publishes.
const { PostizPublishingAdapter, postizBase } = require('../dist/content/postiz-publishing.adapter.js');
(async () => {
  const base = postizBase(); console.log('base', base);
  const a = new PostizPublishingAdapter();
  const s = await a.status(); console.log('status', s);
  if (!s.configured) { console.log('BLOCKED: POSTIZ_API_KEY not set'); process.exit(2); }
  if (!s.keyValid) { console.log('BLOCKED: key refused'); process.exit(2); }
  const platform = ['instagram', 'facebook', 'threads', 'tiktok'].find((p) => s.channels.some((c) => c.startsWith(p)));
  if (!platform) { console.log('BLOCKED: no connected channels'); process.exit(3); }
  const when = new Date(Date.now() + 30 * 864e5).toISOString();
  const r = await a.schedule({ platform, format: 'photo', caption: 'AngelOS staging test (auto-deleted)', hashtags: [], idempotencyKey: 'e2e', scheduledFor: when });
  console.log('schedule', { ok: r.ok, id: r.providerPostId, code: r.code, error: r.error });
  if (!r.ok) process.exit(4);
  const c = await a.cancel(r.providerPostId); console.log('cancel', c);
  process.exit(c.ok ? 0 : 5);
})().catch((e) => { console.error(e.message); process.exit(1); });
