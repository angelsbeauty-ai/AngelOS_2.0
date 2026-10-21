// Calendar posting: no double post (Postiz-scheduled + unconfirmed Meta). Fake Supabase only.
const test = require('node:test');
const assert = require('node:assert/strict');
const pub = require('../dist/social/social-publisher.service.js');
const logic = require('../dist/social/publish-logic.js');
const content = require('../dist/content/content.service.js');

function fakeDb(state) {
  const writes = [];
  const q = (table) => {
    const c = { table, op: 'select', filters: {}, payload: null };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; }, lte() { return b; }, neq() { return b; },
      eq(k, v) { c.filters[k] = v; return b; },
      update(p) { c.op = 'update'; c.payload = p; return b; }, upsert(p) { c.op = 'upsert'; c.payload = p; writes.push(c); return Promise.resolve({ error: null }); },
      maybeSingle() { return Promise.resolve({ data: state.attempt ?? null }); },
      then(res, rej) {
        if (c.op === 'update') { writes.push(c); return Promise.resolve({ data: [{ id: 'v1' }], error: null }).then(res, rej); }
        if (table === 'content_variants' && c.filters.status === 'scheduled') return Promise.resolve({ data: [state.variant], error: null }).then(res, rej);
        if (table === 'content_variants') return Promise.resolve({ data: [{ status: 'published' }] }).then(res, rej);
        return Promise.resolve({ data: [] }).then(res, rej);
      }
    };
    return b;
  };
  return { writes, from: q, storage: { from: () => ({ createSignedUrl: async () => ({ data: {} }) }) } };
}

function job(state) {
  const db = fakeDb(state);
  const svc = new pub.SocialPublisherService({});
  let calls = 0;
  svc.client = () => db;
  svc.postiz = () => ({ publish: async () => { calls += 1; return { status: 'published', providerPostId: 'new' }; } });
  return { svc, db, calls: () => calls };
}

test('dueAction: Postiz-held posts and unconfirmed Meta posts are never re-sent', () => {
  assert.equal(logic.dueAction('postiz', { provider_post_id: 'pz1' }, null), 'postiz_scheduled');
  assert.equal(logic.dueAction('postiz', { provider_post_id: null }, null), 'publish');
  assert.equal(logic.dueAction('meta', {}, { status: 'unknown' }), 'needs_check');
  assert.equal(logic.dueAction('postiz', { provider_post_id: 'pz1' }, { status: 'published' }), 'already_published');
});

test('5-minute job: Postiz-scheduled post is recorded as published, publish() is NOT called', async () => {
  const prev = process.env.POSTIZ_API_KEY; process.env.POSTIZ_API_KEY = 'k';
  const { svc, db, calls } = job({ variant: { id: 'v1', workspace_id: 'w', content_post_id: 'p', platform: 'threads', status: 'scheduled', provider_post_id: 'pz1', post: { status: 'scheduled' } } });
  const r = await svc.publishDue(new Date());
  process.env.POSTIZ_API_KEY = prev;
  assert.equal(r.processed, 1);
  assert.equal(calls(), 0);
  const v = db.writes.find((w) => w.table === 'content_variants' && w.payload.status === 'published');
  assert.equal(v.payload.provider_post_id, 'pz1');
});

test('5-minute job: an earlier unconfirmed Meta attempt becomes needs-check, not a re-post', async () => {
  const { svc, db, calls } = job({ attempt: { status: 'unknown', attempt_no: 1 }, variant: { id: 'v1', workspace_id: 'w', content_post_id: 'p', platform: 'instagram', status: 'scheduled', post: { status: 'scheduled' } } });
  await svc.publishDue(new Date());
  assert.equal(calls(), 0);
  const a = db.writes.find((w) => w.table === 'content_publish_attempts' && w.op === 'update');
  assert.equal(a.payload.status, 'unknown');
  assert.match(a.payload.error_message, /didn't confirm/);
});

test('failure reason reaches the API response in plain words', () => {
  const out = content.withPublishErrors({ variants: [{ status: 'failed', attempts: [{ status: 'unknown', error_message: logic.NEEDS_CHECK_REASON('instagram') }] }, { status: 'scheduled', attempts: [] }] });
  assert.equal(out.variants[0].needs_check, true);
  assert.match(out.variants[0].publish_error, /Instagram didn't confirm/);
  assert.equal(out.variants[1].publish_error, null);
});

test('Try again on an unconfirmed Meta post needs a check first (no double post)', () => {
  assert.equal(logic.retryDecision({}, { status: 'unknown' }, false), 'needs_check');
  assert.equal(logic.retryDecision({}, { status: 'unknown' }, true), 'publish');
  assert.equal(logic.retryDecision({ provider_post_id: 'ig1' }, { status: 'unknown' }, true), 'already_published');
  assert.equal(logic.retryDecision({}, { status: 'published' }, true), 'already_published');
  assert.equal(logic.retryDecision({}, { status: 'failed' }, false), 'publish');
});
