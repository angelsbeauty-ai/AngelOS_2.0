// B9 Academy helpers. Pure, no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../dist/academy/academy-logic.js');

test('video links: https only, YouTube/Vimeo embeds, files', () => {
  assert.equal(a.videoInfo('http://youtube.com/watch?v=abc').kind, 'none');
  assert.equal(a.videoInfo('https://www.youtube.com/watch?v=abc123').embedUrl, 'https://www.youtube-nocookie.com/embed/abc123');
  assert.equal(a.videoInfo('https://youtu.be/xyz').embedUrl, 'https://www.youtube-nocookie.com/embed/xyz');
  assert.equal(a.videoInfo('https://vimeo.com/12345').embedUrl, 'https://player.vimeo.com/video/12345');
  assert.equal(a.videoInfo('https://cdn.example.com/a.mp4').kind, 'file');
  assert.equal(a.videoInfo('javascript:alert(1)').kind, 'none');
});

test('checklist, progress and reorder', () => {
  assert.deepEqual(a.sanitizeChecklist([' Map brows ', '', null, 'x'.repeat(300)]).map((s) => s.length), [9, 200]);
  assert.equal(a.sanitizeChecklist(Array(40).fill('a')).length, 30);
  assert.equal(a.progressPercent(['a', 'b', 'c'], ['a', 'z']), 33);
  assert.equal(a.progressPercent([], ['a']), 0);
  assert.equal(a.validReorder(['a', 'b'], ['b', 'a']), true);
  assert.equal(a.validReorder(['a', 'b'], ['a', 'a']), false);
  assert.equal(a.validReorder(['a', 'b'], ['a', 'c']), false);
});

test('practice photo: checks real image bytes and size', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]).toString('base64');
  assert.equal(a.decodePracticePhoto(`data:image/jpeg;base64,${jpeg}`).contentType, 'image/jpeg');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]).toString('base64');
  assert.equal(a.decodePracticePhoto(png).ext, 'png');
  assert.throws(() => a.decodePracticePhoto(Buffer.from('<svg onload=alert(1)>').toString('base64')), /JPEG, PNG or WebP/);
  assert.throws(() => a.decodePracticePhoto(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]).toString('base64')), /5 MB/);
});
