const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../dist/ai/ai.service.js');

test('chat title is the first words of her first message', () => {
  assert.equal(ai.conversationTitle('  Who   needs a reply? '), 'Who needs a reply?');
  assert.equal(ai.conversationTitle('x'.repeat(80)).length, 48);
  assert.equal(ai.conversationTitle('   '), 'New conversation');
});

test('past chats skip empty conversations', () => {
  const out = ai.conversationSummaries([
    { id: 'a', title: 'Hi', updated_at: '2026-10-21', ai_messages: [{ count: 2 }] },
    { id: 'b', title: 'New conversation', updated_at: '2026-10-22', ai_messages: [{ count: 0 }] }
  ]);
  assert.deepEqual(out.map((r) => r.id), ['a']);
  assert.equal(out[0].messageCount, 2);
});
