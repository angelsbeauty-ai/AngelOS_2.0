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
    assert.deepEqual(j.match(/{{\w+}}/g) ?? [], e.match(/{{\w+}}/g) ?? [], `placeholders ${k}`);
  }
  const japanese = keys(ja).filter((k) => /[\u3040-\u30ff\u4e00-\u9faf]/.test(get(ja, k)));
  assert.ok(japanese.length >= keys(ja).length - 2, 'almost every JA string contains Japanese');
});
