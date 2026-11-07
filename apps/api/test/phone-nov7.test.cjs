const test = require('node:test');
const assert = require('node:assert/strict');
const { voiceInstructions, voiceTools } = require('../dist/ai/voice/voice.service.js');
const { fetchInstagramPosts, fetchFacebookPosts, postPreviewUrl } = require('../dist/sync/meta-sync.js');
const { SocialSyncService } = require('../dist/sync/social-sync.service.js');

const thread = '11111111-1111-4111-8111-111111111111';
test('chat voice exposes only a same-thread draft with mandatory English meaning; never a send tool', () => {
  const tools = voiceTools(thread);
  assert.deepEqual(tools.map(t => t.name), ['draft_reply']);
  assert.deepEqual(tools[0].parameters.properties.threadId.enum, [thread]);
  assert.ok(tools[0].parameters.required.includes('meaning'));
  assert.ok(!voiceTools().some(t => /send|approve/.test(t.name)));
  const instructions = voiceInstructions({ assistantName: 'Assistant', workspaceName: 'Studio', thread: `Conversation threadId: ${thread}\nClient: 日本語のメッセージ` });
  assert.match(instructions, /plain English/);
  assert.match(instructions, /reply is Japanese only/);
  assert.match(instructions, /Only her tap on Approve sends/);
});

test('Meta sync requests actual photos, carousel covers and video posters, not permalinks', async () => {
  const requests = [];
  const fetch = async url => {
    requests.push(new URL(url));
    return { ok: true, json: async () => ({ data: [
      { id: 'p', caption: 'caption', timestamp: '2026-11-01T00:00:00Z', created_time: '2026-11-01T00:00:00Z', media_type: 'IMAGE', media_url: 'https://cdn.example/post.jpg', full_picture: 'https://cdn.example/facebook.jpg' }
    ] }) };
  };
  const ig = await fetchInstagramPosts({ graphBase: 'https://graph.example', igUserId: 'ig', token: 'test-only', days: 30 }, fetch, Date.parse('2026-11-07'));
  const fb = await fetchFacebookPosts({ graphBase: 'https://graph.example', pageId: 'page', token: 'test-only', days: 30 }, fetch, Date.parse('2026-11-07'));
  assert.equal(ig[0].previewUrl, 'https://cdn.example/post.jpg');
  assert.equal(fb[0].previewUrl, 'https://cdn.example/facebook.jpg');
  assert.match(requests[0].searchParams.get('fields'), /media_url,thumbnail_url/);
  assert.match(requests[1].searchParams.get('fields'), /full_picture/);
  assert.equal(postPreviewUrl({ media_type: 'VIDEO', media_url: 'https://cdn.example/reel.mp4', thumbnail_url: 'https://cdn.example/cover.jpg' }, 'instagram'), 'https://cdn.example/cover.jpg');
  assert.equal(postPreviewUrl({ media_type: 'CAROUSEL_ALBUM', children: { data: [{ media_type: 'IMAGE', media_url: 'https://cdn.example/first.jpg' }] } }, 'instagram'), 'https://cdn.example/first.jpg');
  assert.equal(postPreviewUrl({ media_url: 'javascript:alert(1)' }, 'instagram'), null);
  assert.equal(postPreviewUrl({ media_url: 'https://cdn.example/?access_token=private' }, 'instagram'), null);
  assert.equal(postPreviewUrl({ media_type: 'VIDEO', media_url: 'https://cdn.example/reel.mp4' }, 'instagram'), null);
});

test('existing imports gain refreshed previews without duplicate posts or changed publication dates', async () => {
  const writes = [];
  const db = { from(table) {
    const filters = {};
    const q = {
      select() { return q; }, eq(k, v) { filters[k] = v; return q; }, in() { return q; },
      update(values) { writes.push({ table, values, filters }); return q; },
      then(resolve) { return Promise.resolve({ data: table === 'content_variants' ? [{ id: 'variant', provider_post_id: 'remote', capabilities_snapshot: { existing: true, imported: true } }] : [], error: null }).then(resolve); }
    }; return q;
  } };
  const count = await new SocialSyncService().importPosts(db, 'studio', 'instagram', [{ id: 'remote', previewUrl: 'https://cdn.example/fresh.jpg' }]);
  assert.equal(count, 0);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].filters, { workspace_id: 'studio', id: 'variant' });
  assert.deepEqual(writes[0].values, { capabilities_snapshot: { existing: true, imported: true, source: 'sync:instagram', preview_url: 'https://cdn.example/fresh.jpg' } });
});
test('invalid thread ids fail closed instead of silently opening a studio-wide session', () => {
  const { AiController } = require('../dist/ai/ai.controller.js');
  const calls = [];
  const controller = new AiController(null, null, null, { createSession(...args) { calls.push(args); return {}; } });
  for (const threadId of ['not-a-thread', '-'.repeat(36), 5]) assert.throws(() => controller.voiceSession({ id: 'owner' }, 'studio', { threadId }), /valid conversation/);
  assert.equal(calls.length, 0);
  controller.voiceSession({ id: 'owner' }, 'studio', { threadId: thread });
  assert.equal(calls[0][4], thread);
});
test('voice reads only the requested studio/thread, last 20, with the owner login; read errors stop session creation', async () => {
  const config = require('../dist/config/supabase.js');
  const usage = require('../dist/ai/ai-usage.js');
  const { VoiceService } = require('../dist/ai/voice/voice.service.js');
  const originalClient = config.createUserSupabaseClient, originalAllowed = usage.assertAiAllowed;
  const queries = []; let failMessages = false;
  config.createUserSupabaseClient = token => {
    assert.equal(token, 'owner-login-fixture');
    return { from(table) { const q = { table, filters: {} }; const b = {
      select() { return b; }, eq(k,v) { q.filters[k] = v; return b; }, neq(k,v) { q.exclude = [k,v]; return b; },
      order(k,v) { q.order = [k,v]; return b; }, limit(n) { q.limit = n; return b; }, maybeSingle() { return b; },
      then(resolve) { queries.push(q); return Promise.resolve({ data: table === 'workspaces' ? { name: 'Studio' } : table === 'ai_assistant_profiles' ? { display_name: 'Assistant' } : table === 'message_threads' ? { id: thread, contact_display_name: 'Fixture', channel: { provider: 'line' } } : [{ direction: 'inbound', body: '明日の予約時間を教えてください。', created_at: '2026-11-07T09:00:00Z' }], error: failMessages && table === 'client_messages' ? { message: 'Denied' } : null }).then(resolve); }
    }; return b; } };
  };
  usage.assertAiAllowed = async () => {};
  try {
    const service = new VoiceService(); service.status = () => ({ available: true, provider: 'openai' });
    let minted = 0; service.openaiSession = async (_user,_ws,_status,instructions,id) => { minted++; assert.equal(id, thread); assert.match(instructions, /明日の予約時間/); return {}; };
    const user = { id: 'owner', accessToken: 'owner-login-fixture' };
    await service.createSession(user, 'studio', 'chat', null, thread);
    const messages = queries.find(q => q.table === 'client_messages');
    assert.deepEqual(messages.filters, { workspace_id: 'studio', thread_id: thread }); assert.equal(messages.limit, 20);
    assert.deepEqual(messages.order, ['created_at', { ascending: false }]);
    failMessages = true;
    await assert.rejects(service.createSession(user, 'studio', 'chat', null, thread), /messages could not load/);
    assert.equal(minted, 1);
  } finally { config.createUserSupabaseClient = originalClient; usage.assertAiAllowed = originalAllowed; }
});
test('content pagination remains studio/user scoped and returns the requested next 100 records', async () => {
  const config = require('../dist/config/supabase.js'); const { ContentService } = require('../dist/content/content.service.js');
  const original = config.createUserSupabaseClient; const filters = {}; let range;
  config.createUserSupabaseClient = token => { assert.equal(token, 'owner-login-fixture'); return { from(table) { assert.equal(table, 'content_posts'); const q = { select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},range(a,b){range=[a,b];return q},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q; } }; };
  try { await new ContentService(null).list({accessToken:'owner-login-fixture'},'studio',100); assert.deepEqual(filters,{workspace_id:'studio'});assert.deepEqual(range,[100,199]); } finally { config.createUserSupabaseClient=original; }
});
