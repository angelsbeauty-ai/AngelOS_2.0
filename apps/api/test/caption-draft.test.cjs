// Composer caption templates. No network, no database, no AI credits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { composeCaption, parseComposerCaption } = require('../dist/content/caption-draft.js');

test('a fresh Japanese caption does not invent a price or a client', () => {
  const draft = composeCaption({ objective: 'bookings', language: 'ja', tone: 'write', seed: 0 });
  assert.match(draft.caption, /メッセージ/);
  assert.equal(draft.caption, draft.captionJa);
  assert.doesNotMatch(draft.captionJa, /\d+円/);
  assert.doesNotMatch(draft.captionEn, /\d/);
  assert.ok(draft.hashtags.every((tag) => tag.startsWith('#')));
});

test('price tone uses a placeholder, never a yen amount', () => {
  const draft = composeCaption({ objective: 'bookings', language: 'both', tone: 'price', caption: 'ご相談はメッセージでどうぞ。', captionEn: 'Message us to talk it through.' });
  assert.match(draft.captionJa, /\[価格\]/);
  assert.match(draft.captionEn, /\[price\]/);
  assert.doesNotMatch(`${draft.captionJa}\n${draft.captionEn}`, /\d+円|\$\d/);
});

test('shorter keeps the first sentence and again changes the opening', () => {
  const long = composeCaption({ objective: 'education', language: 'en', tone: 'write', seed: 0 });
  const short = composeCaption({ objective: 'education', language: 'en', tone: 'shorter', caption: long.captionEn });
  assert.ok(short.captionEn.length <= long.captionEn.length);
  const again = composeCaption({ objective: 'education', language: 'ja', tone: 'again', seed: 1 });
  const first = composeCaption({ objective: 'education', language: 'ja', tone: 'write', seed: 0 });
  assert.notEqual(again.captionJa, first.captionJa);
});

test('a model caption with a made-up price is rejected', () => {
  assert.equal(parseComposerCaption('{"captionJa":"初回9800円です","captionEn":"First visit is 9800 yen"}'), null);
  const ok = parseComposerCaption('{"captionJa":"メッセージくださいね","captionEn":"Send a message","hashtags":["art"]}');
  assert.equal(ok.hashtags[0], '#art');
});
