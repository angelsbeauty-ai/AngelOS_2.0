// read_thread + draft_reply: role guard, ai_data_access gate, studio scope, never send. Fake DB only.
const test = require('node:test');
const assert = require('node:assert/strict');
const rt = require('../dist/ai/tools/read-tools.js');

function db({ off = [], threads = { t1: 'w1' }, messages = [] } = {}) {
  const seen = [];
  const from = (table) => {
    const f = {}; let one = false;
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, is() { return b; },
      eq(k, v) { f[k] = v; return b; }, maybeSingle() { one = true; return b; },
      then(res, rej) {
        seen.push({ table, ...f });
        let data;
        if (table === 'ai_data_access') data = off.map((area) => ({ area, enabled: false }));
        else if (table === 'message_threads') data = threads[f.id] === f.workspace_id ? [{ id: f.id, contact_display_name: 'Yuki Tanaka', client: null, channel: { provider: 'line' } }] : [];
        else if (table === 'client_messages') data = messages.filter((m) => m.ws === f.workspace_id && m.thread === f.thread_id);
        else if (table === 'workspace_memberships') data = [{ role: f.user_id === 'student' ? 'student' : 'owner' }];
        return Promise.resolve({ data: one ? data : data, error: null }).then(res, rej);
      }
    };
    return b;
  };
  return { from, seen };
}
const msgs = [{ ws: 'w1', thread: 't1', id: 'm2', direction: 'outbound', sender_type: 'owner', body: 'See you then', status: 'sent', created_at: '2026-10-21T02:00:00Z' }, { ws: 'w1', thread: 't1', id: 'm1', direction: 'inbound', body: 'Can I come at 3?', status: 'received', created_at: '2026-10-21T01:00:00Z' }];

test('read_thread: returns recent messages oldest first, scoped to the studio', async () => {
  const r = await rt.runReadTool(db({ messages: msgs }), 'w1', 'read_thread', { thread_id: 't1', limit: 5 }, new Date(), undefined, 'owner');
  assert.deepEqual(r.messages.map((m) => m.from), ['client', 'studio']);
  assert.equal(r.name, 'Yuki T.');
  const other = await rt.runReadTool(db({ messages: msgs }), 'w2', 'read_thread', { thread_id: 't1' }, new Date(), undefined, 'owner');
  assert.equal(other.error, 'not_found');
});

test('role guard: students never get studio tools', async () => {
  await assert.rejects(rt.runReadTool(db(), 'w1', 'read_thread', { thread_id: 't1' }, new Date(), undefined, 'student'), rt.RoleNotAllowedError);
  await assert.rejects(rt.runDraftTool({ db: db(), workspaceId: 'w1', role: 'student', draftReply: async () => { throw new Error('must not run'); } }, 'draft_reply', { thread_id: 't1' }), rt.RoleNotAllowedError);
  assert.deepEqual(rt.functionTools(new Set(rt.AREAS), { role: 'student', drafts: true }), []);
  assert.deepEqual(rt.functionTools(new Set(rt.AREAS), { role: null, drafts: true }), []);
  const names = rt.functionTools(new Set(rt.AREAS), { role: 'owner', drafts: true }).map((t) => t.name);
  assert.ok(names.includes('read_thread') && names.includes('draft_reply'));
  assert.ok(rt.functionTools(new Set(rt.AREAS), { role: 'staff', drafts: true }).length > 0);
  assert.equal(await rt.memberRole(db(), 'w1', 'student'), 'student');
});

test('ai_data_access gate: messages off hides and blocks both tools', async () => {
  const enabled = await rt.enabledAreas(db({ off: ['messages'] }), 'w1');
  const names = rt.functionTools(enabled, { role: 'owner', drafts: true }).map((t) => t.name);
  assert.ok(!names.includes('read_thread') && !names.includes('draft_reply'));
  await assert.rejects(rt.runReadTool(db({ off: ['messages'] }), 'w1', 'read_thread', { thread_id: 't1' }, new Date(), undefined, 'owner'), rt.AreaOffError);
  let called = false;
  await assert.rejects(rt.runDraftTool({ db: db({ off: ['messages'] }), workspaceId: 'w1', role: 'owner', draftReply: async () => { called = true; return {}; } }, 'draft_reply', { thread_id: 't1' }), rt.AreaOffError);
  assert.equal(called, false);
});

test('draft_reply never sends: only the draft function runs, result is pending approval', async () => {
  const calls = [];
  const messaging = { draftReply: async (id, ins) => { calls.push(['draft', id, ins]); return { message: { id: 'd1', body: 'Yes, 3pm works!', status: 'pending_approval' }, reason: 'Nothing is sent until you tap Approve.' }; }, send: () => calls.push(['send']), approveDraft: () => calls.push(['approve']) };
  const r = await rt.runDraftTool({ db: db(), workspaceId: 'w1', role: 'owner', draftReply: (id, ins) => messaging.draftReply(id, ins) }, 'draft_reply', { thread_id: 't1', instructions: 'Say 3pm is fine' });
  assert.deepEqual(calls, [['draft', 't1', 'Say 3pm is fine']]);
  assert.equal(r.sent, false); assert.equal(r.requires_approval, true); assert.equal(r.status, 'pending_approval'); assert.equal(r.message_id, 'd1');
  // Another studio's thread: no draft at all.
  const none = await rt.runDraftTool({ db: db(), workspaceId: 'w2', role: 'owner', draftReply: async () => { throw new Error('must not run'); } }, 'draft_reply', { thread_id: 't1' });
  assert.equal(none.error, 'not_found');
  // The draft tool is never a read tool, so the voice/read endpoints cannot reach it.
  assert.equal(rt.READ_TOOL_NAMES.has('draft_reply'), false);
  await assert.rejects(rt.runReadTool(db(), 'w1', 'draft_reply', { thread_id: 't1' }, new Date(), undefined, 'owner'), /Unknown tool/);
});
