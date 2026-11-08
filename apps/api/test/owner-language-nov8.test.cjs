const test = require('node:test');
const assert = require('node:assert/strict');
const { assistantLanguageFromUtterance, OWNER_SPEECH_RULES } = require('../dist/ai/owner-language.js');
const { voiceInstructions } = require('../dist/ai/voice/voice.service.js');
const { buildOperatingInstructions } = require('../dist/ai/angelos-operating-contract.js');

const jpThread = [
  'Conversation threadId: 11111111-1111-4111-8111-111111111111.',
  'Client: ゆき. App: line.',
  'The client writes in Japanese, so any reply draft is Japanese only.',
  'Recent messages: [2026-11-08 03:00] ゆき: 明日の予約時間を教えてください。'
].join('\n');

test('talk to me in English is detected, including similar phrasing', () => {
  assert.equal(assistantLanguageFromUtterance('Talk to me in English'), 'en');
  assert.equal(assistantLanguageFromUtterance('please talk in English from now on'), 'en');
  assert.equal(assistantLanguageFromUtterance('Can you speak in English?'), 'en');
  assert.equal(assistantLanguageFromUtterance('switch to English'), 'en');
  assert.equal(assistantLanguageFromUtterance('英語で話して'), 'en');
  assert.equal(assistantLanguageFromUtterance('What is booked tomorrow?'), null);
  assert.equal(assistantLanguageFromUtterance('Draft a reply in English for this client'), 'en');
});

test('home and client-chat voice always talk TO the owner in English, even with a Japan studio and Japanese client thread', () => {
  const home = voiceInstructions({
    assistantName: 'AngelOS',
    workspaceName: "Angel's Beauty",
    screen: 'home',
    context: 'Studio is in Okinawa, Japan. Next client: ゆき at 14:00.'
  });
  const chat = voiceInstructions({
    assistantName: 'AngelOS',
    workspaceName: "Angel's Beauty",
    thread: jpThread
  });
  for (const p of [home, chat]) {
    assert.match(p, /Always talk TO the owner in English/);
    assert.match(p, /Do not switch back to Japanese on the next turn/);
    assert.match(p, /permanent-makeup studio in Japan/);
    assert.doesNotMatch(p, /Use her language/);
    assert.match(p, /does not mean you speak Japanese to the owner/);
  }
  assert.match(chat, /reply is Japanese only/);
  assert.match(chat, /plain English meaning/);
  assert.match(chat, /Do not speak the Japanese draft to her as if it were the reply to her/);
  assert.match(chat, /Only her tap on Approve sends/);
});

test('text operating contract honors English-to-owner even when stored preference is Japanese', () => {
  const text = buildOperatingInstructions({
    workspaceName: "Angel's Beauty",
    profile: { display_name: 'AngelOS', tone: 'warm', response_length: 'short', proactivity: 'medium', personality_prompt: '', primary_language: 'ja' },
    roles: [{ role_key: 'personal_assistant', enabled: true }],
    approvedMemory: ['The studio is in Okinawa, Japan.'],
    context: { screen: 'home' }
  });
  assert.match(text, /Primary language preference \(stored assistant language\): ja/);
  assert.match(text, /Always talk TO the owner in English/);
  assert.ok(text.includes(OWNER_SPEECH_RULES));
  assert.doesNotMatch(text, /Use her language/);
});
