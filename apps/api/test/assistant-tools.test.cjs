// C1 tools registry + C2 brand voice + live voice config. Pure, deterministic, no network or AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const reg = require('../dist/ai/tools/registry.js');
const voice = require('../dist/ai/style/brand-voice.js');
const live = require('../dist/ai/voice/voice.service.js');
const { mockTaskResponse } = require('../dist/ai/mock-provider.js');

const now = new Date('2026-10-09T03:00:00Z'); // Fri 12:00 JST
const tz = 'Asia/Tokyo';
const plan = (m) => reg.planTool(m, now, tz);

test('read tools answer directly', () => {
  assert.equal(plan("What's on today?").key, 'today_schedule');
  assert.equal(plan("who's coming tomorrow").input.day, '2026-10-10');
  assert.equal(plan('Who still owes me?').key, 'who_owes');
  assert.equal(plan('How much did I make this month?').input.period, 'month');
  for (const m of ["What's on today?", 'Who still owes me?']) assert.equal(plan(m).kind, 'read');
});

test('block time: hours and whole days, in Japan time', () => {
  const p = plan('Block tomorrow 2-4pm');
  assert.equal(p.key, 'block_time'); assert.equal(p.kind, 'change');
  assert.equal(p.input.startAt, '2026-10-10T05:00:00.000Z');
  assert.equal(p.input.endAt, '2026-10-10T07:00:00.000Z');
  const off = plan('I want a day off on monday');
  assert.equal(off.input.day, '2026-10-12'); assert.equal(off.input.title, 'Day off');
  assert.equal(off.input.startAt, '2026-10-11T15:00:00.000Z');
  assert.equal(plan('block 10/20 14:00-15:30').input.to, '15:30');
});

test('expense, post and client message become approval cards', () => {
  const e = plan('I spent 3,000 yen on pigments');
  assert.equal(e.key, 'record_expense'); assert.equal(e.input.amount, 3000); assert.equal(e.input.category, 'supplies');
  const p = plan('Make a post about lip blush healing');
  assert.equal(p.key, 'create_post_draft'); assert.equal(p.kind, 'draft'); assert.equal(p.input.topic, 'lip blush healing');
  const m = plan('Message Yuki Tanaka that her touch-up is due');
  assert.equal(m.key, 'draft_client_message'); assert.equal(m.input.clientName, 'Yuki Tanaka'); assert.match(m.summary, /approve it again before it is sent/);
  assert.equal(plan('Call yourself Mika').key, 'update_assistant_name');
  assert.equal(plan('Remember that I close at 6 on Fridays').key, 'propose_memory');
  assert.equal(plan('hello how are you'), null);
});

test('every registry tool except reads needs approval; client tools only draft', () => {
  for (const t of reg.TOOLS) {
    assert.ok(['read', 'draft', 'change'].includes(t.kind));
    if (t.touchesClients) assert.equal(t.kind, 'draft');
    const p = plan(t.example);
    assert.ok(p, `example plans: ${t.example}`); assert.equal(p.key, t.key);
  }
});

test('outreach mock stays in one language', () => {
  const ja = mockTaskResponse({ instructions: 'CLIENT_OUTREACH_DRAFT\nlanguage=ja\nClient name: Yuki', input: 'her touch-up is due' });
  assert.ok(/[\u3040-\u30ff]/.test(ja)); assert.ok(!/[A-Za-z]{3,}/.test(ja.replace('Yuki', '')));
  const en = mockTaskResponse({ instructions: 'CLIENT_OUTREACH_DRAFT\nlanguage=en\nClient name: Amy', input: 'your touch-up is due' });
  assert.ok(!/[\u3040-\u30ff]/.test(en)); assert.match(en, /^Hi Amy/);
});

test('brand voice line', () => {
  assert.equal(voice.brandVoiceLine(null), '');
  const line = voice.brandVoiceLine({ reply_tone: 'casual_friendly', emoji_level: 'light', reply_length: 'short', style_notes: 'Say "lovely"', learned: { topEmojis: ['✨', '🌸'] } });
  assert.match(line, /casual and friendly/); assert.match(line, /✨ 🌸/); assert.match(line, /lovely/);
  assert.doesNotMatch(voice.brandVoiceLine({ emoji_level: 'none', learned: { topEmojis: ['✨'] } }), /✨/);
});

test('live voice: off without key, never stores, instructions forbid changes', async () => {
  const prev = { mode: process.env.AI_PROVIDER_MODE, key: process.env.OPENAI_API_KEY };
  delete process.env.OPENAI_API_KEY; process.env.AI_PROVIDER_MODE = 'mock';
  const svc = new live.VoiceService();
  const st = svc.status();
  assert.equal(st.available, false); assert.equal(st.stored, false);
  const s = await svc.createSession({ id: 'u', accessToken: 'x' }, 'w', 'calendar');
  assert.equal(s.clientSecret, null);
  const text = live.voiceInstructions({ assistantName: 'AngelOS', workspaceName: 'Studio', screen: 'calendar' });
  assert.match(text, /cannot change bookings/); assert.match(text, /approval card/);
  if (prev.mode === undefined) delete process.env.AI_PROVIDER_MODE; else process.env.AI_PROVIDER_MODE = prev.mode;
  if (prev.key !== undefined) process.env.OPENAI_API_KEY = prev.key;
});
