const test = require('node:test');
const assert = require('node:assert/strict');
const { voiceInstructions, voiceTools, voiceToolKinds } = require('../dist/ai/voice/voice.service.js');
const { assistantTools } = require('../dist/ai/tools/read-tools.js');
const { TOOLS, proposeToolDefs, proposalFromArgs } = require('../dist/ai/tools/registry.js');

const thread = '11111111-1111-4111-8111-111111111111';
const names = ts => ts.map(t => t.name).sort();
const now = new Date('2026-11-08T03:00:00Z');

test('general voice tools are exactly the text-chat assistantTools (+ look_up_studio summary)', () => {
  const text = names(assistantTools());
  assert.deepEqual(names(voiceTools()).filter(n => n !== 'look_up_studio'), text);
  for (const n of ['get_bookings', 'search_clients', 'list_threads', 'read_thread', 'list_posts', 'get_analytics', 'get_money', 'list_services_prices', 'list_campaigns_tasks', 'draft_reply',
    'block_time', 'record_expense', 'create_post_draft', 'draft_client_message', 'propose_memory', 'update_assistant_name', 'create_automation']) assert.ok(text.includes(n), n);
  // Every approve-gated registry tool is exposed, so a new one cannot be text-only.
  assert.equal(proposeToolDefs().length, TOOLS.filter(t => t.kind !== 'read').length);
  assert.deepEqual(names(voiceTools(thread)), text);
  const kinds = Object.fromEntries(voiceToolKinds(voiceTools()).map(k => [k.name, k.kind]));
  assert.equal(kinds.propose_memory, 'propose'); assert.equal(kinds.draft_reply, 'draft'); assert.equal(kinds.get_bookings, 'read');
  assert.deepEqual(assistantTools(undefined, 'student'), []);
});

test('voice prompts tell the model it can propose skills/rules; the refusal is gone', () => {
  for (const p of [voiceInstructions({ assistantName: 'A', workspaceName: 'S' }), voiceInstructions({ assistantName: 'A', workspaceName: 'S', thread: 'x' })]) {
    assert.match(p, /propose_memory/);
    assert.match(p, /Never say you cannot add or change skills or rules/);
    assert.doesNotMatch(p, /can't directly add or change skills/i);
    assert.doesNotMatch(p, /Settings stay off/);
    assert.match(p, /never send|can never send/i);
  }
});

test('"add a skill" by voice becomes a proposed Approve card for workflow memory, not a write', () => {
  const p = proposalFromArgs('propose_memory', { kind: 'skill', content: 'Always offer a touch-up 6 weeks after brows' }, now, 'Asia/Tokyo');
  assert.equal(p.key, 'propose_memory'); assert.equal(p.kind, 'change');
  assert.deepEqual(p.input, { category: 'workflow', content: 'Always offer a touch-up 6 weeks after brows' });
  assert.match(p.summary, /Add skill.*saved only after you approve/);
  assert.equal(proposalFromArgs('propose_memory', { kind: 'rule', content: 'Close at 18:00 on Fridays' }, now, 'Asia/Tokyo').input.category, 'preference');
  assert.throws(() => proposalFromArgs('send_message', {}, now, 'Asia/Tokyo'));
});

test('other proposals map to the same inputs the Approve executor already runs (JST)', () => {
  const b = proposalFromArgs('block_time', { day: '2026-11-10', from: '14:00', to: '16:00' }, now, 'Asia/Tokyo');
  assert.equal(b.input.startAt, '2026-11-10T05:00:00.000Z'); assert.equal(b.input.endAt, '2026-11-10T07:00:00.000Z');
  assert.deepEqual(proposalFromArgs('draft_client_message', { clientName: 'Yuki', about: 'touch-up due' }, now, 'Asia/Tokyo').input, { clientName: 'Yuki', about: 'touch-up due' });
  assert.equal(proposalFromArgs('record_expense', { amount: 3000, category: 'supplies' }, now, 'Asia/Tokyo').input.amount, 3000);
});
