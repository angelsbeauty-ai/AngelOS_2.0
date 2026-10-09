// Pure learning logic. No network, no database, no AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const style = require('../dist/ai/style/style-analyzer.js');
const { mockTaskResponse } = require('../dist/ai/mock-provider.js');
const { buildClientReplyInstructions } = require('../dist/messaging/reply-prompt.js');

const names = ['Yuna Sato', '山田 花子'];
const aftercareJa = (n) => `${n}さん、本日はありがとうございました✨ 7日間は施術部分を濡らさないようにして、かさぶたは無理に取らないでくださいね。気になることがあればいつでも連絡くださいね🌸`;
const samples = [
  { body: aftercareJa('山田'), createdAt: '2026-10-01T10:00:00Z' },
  { body: aftercareJa('花子'), createdAt: '2026-10-03T10:00:00Z' },
  { body: aftercareJa('山田').replace('7日間は', '一週間は'), createdAt: '2026-10-05T10:00:00Z' },
  { body: 'Hi Yuna! Thank you so much for coming today! See you at your touch-up 😊', createdAt: '2026-10-02T10:00:00Z' },
  { body: 'Hi Yuna! Your appointment is on 10/12 at 14:00. Call 090-1234-5678 if you are late 😊', createdAt: '2026-10-04T10:00:00Z' }
];

test('Style profile is a summary of numbers and short masked patterns, not transcripts', () => {
  const learned = style.analyzeStyle(samples, names);
  assert.equal(learned.sampleCount, 5);
  assert.deepEqual(learned.languageMix, { en: 2, ja: 3 });
  assert.ok(learned.emojiPerReply >= 1);
  assert.ok(learned.topEmojis.includes('🌸'));
  assert.equal(learned.usesClientName, true);
  const json = JSON.stringify(learned);
  for (const secret of ['Yuna', '山田', '花子', '090-1234-5678', '14:00']) assert.equal(json.includes(secret), false, secret);
  assert.ok(json.length < 1200, 'profile stays small');
});

test('Masking removes names (whole words only), phones, dates and times', () => {
  const masked = style.maskPersonal('Hi Yuna! Leeway: 10/12 at 14:00, call 090-1234-5678, mail a@b.co', ['Yuna Lee']);
  assert.equal(masked, 'Hi {name}! Leeway: [date] at [time], call [phone], mail [email]');
});

test('A reply sent 3+ times becomes ONE suggested saved reply (aftercare), names masked', () => {
  const found = style.findRepeatedReplies(samples, names);
  assert.equal(found.length, 1);
  assert.equal(found[0].category, 'aftercare');
  assert.equal(found[0].language, 'ja');
  assert.equal(found[0].occurrences, 3);
  assert.match(found[0].body, /^\{name\}さん/);
  assert.equal(found[0].body.includes('山田'), false);
  assert.equal(found[0].title, 'Aftercare (JA)');
  // Stable fingerprint across runs
  assert.equal(style.findRepeatedReplies(samples, names)[0].fingerprint, found[0].fingerprint);
});

test('Replies sent only twice are not suggested', () => {
  assert.equal(style.findRepeatedReplies(samples.slice(0, 2), names).length, 0);
});

test('Draft context uses manual settings first, learned style, and the matching saved reply, under budget', () => {
  const learned = style.analyzeStyle(samples, names);
  const savedReplies = [
    { title: 'Aftercare', category: 'aftercare', body_en: 'Aftercare EN', body_ja: '{name}さん、アフターケアです🌸' },
    ...Array.from({ length: 200 }, (_, i) => ({ title: `Reply ${i}`, category: 'other', body_en: 'x'.repeat(400), body_ja: 'あ'.repeat(400) }))
  ];
  const ctx = style.buildReplyStyleContext({ manual: { reply_tone: 'casual_friendly', emoji_level: 'light', reply_length: 'short', style_notes: 'Always say see you soon' }, learned, savedReplies, intent: 'aftercare', language: 'ja' });
  assert.match(ctx, /casual and friendly/);
  assert.match(ctx, /Always say see you soon/);
  assert.match(ctx, /SAVED_REPLY_MATCH: \{name\}さん、アフターケアです🌸/);
  assert.ok(style.estimateTokens(ctx) <= 2400, `context too big: ${style.estimateTokens(ctx)}`);
});

test('Mock draft uses the approved saved reply (deterministic, free)', () => {
  const styleContext = style.buildReplyStyleContext({ savedReplies: [{ title: 'Aftercare', category: 'aftercare', body_en: null, body_ja: '{name}さん、アフターケアです🌸' }], intent: 'aftercare', language: 'ja' });
  const out = mockTaskResponse({ instructions: buildClientReplyInstructions({ language: 'ja', clientName: '山田', intent: 'aftercare', knownClient: true, doNotAutoMessage: false, styleContext }), input: 'x' });
  assert.equal(out, '山田さん、アフターケアです🌸');
});
