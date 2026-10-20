const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dir = path.join(__dirname, '../../mobile/src/i18n');
const en = require(path.join(dir, 'en.json'));
const ja = require(path.join(dir, 'ja.json'));
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const get = (o, k) => k.split('.').reduce((a, x) => a?.[x], o);

test('EN and JA have the same translation keys', () => { assert.deepEqual(keys(ja), keys(en)); });
test('JA strings are really Japanese and keep placeholders', () => {
  for (const k of keys(en)) {
    const e = get(en, k); const j = get(ja, k);
    assert.ok(j && j.length > 0, k);
    assert.deepEqual((j.match(/{{\w+}}/g) ?? []).sort(), (e.match(/{{\w+}}/g) ?? []).sort(), `placeholders ${k}`); // JA word order may differ
  }
  // Emoji, acronyms (SNS) and counters like "1 / {{count}}" are fine; an untranslated English sentence is not.
  const english = keys(ja).filter((k) => { const v = get(ja, k); return !/[\u3040-\u30ff\u4e00-\u9faf]/.test(v) && /[A-Za-z]{4,}/.test(v.replace(/{{\w+}}/g, '')); });
  assert.ok(english.length <= 2, `untranslated JA strings: ${english.join(', ')}`);
});
