// Japanese quality check for an AI model. Usage: OPENAI_API_KEY=... node scripts/ja-quality.mjs [model]
// Sends ~8 salon prompts, then runs simple checks: mostly Japanese script, casual-polite (no stiff 〜でございます),
// no English leakage, no invented prices, length limits. Prints a table + overall score. Costs a few cents; never run in CI.
const key = process.env.OPENAI_API_KEY;
const model = process.argv[2] || process.env.AI_NEXT_MODEL || 'gpt-6-luna';
if (!key) { console.error('No OPENAI_API_KEY in this environment. Not running.'); process.exit(2); }
const SYS = 'あなたは沖縄のアートメイクサロンのアシスタントです。お客様への返信を、自然でやさしい丁寧語（です・ます）で短く書いてください。価格や空き状況は与えられた情報以外は書かないでください。';
const cases = [
  ['眉のアートメイク、来週の土曜日空いてますか？', { maxLen: 160 }],
  ['痛みはどれくらいですか？', { maxLen: 200 }],
  ['リタッチはいつ頃がいいですか？前回は3月でした。', { maxLen: 200 }],
  ['妊娠中でも施術できますか？', { maxLen: 200, mustInclude: ['医師|お医者|控え'] }],
  ['予約をキャンセルしたいです。明日の14時です。', { maxLen: 160 }],
  ['Can you reply in Japanese: thank the client for coming today.', { maxLen: 160 }],
  ['インスタ用に眉の仕上がり写真のキャプションを書いて（ハッシュタグなし）', { maxLen: 220 }],
  ['料金はいくらですか？', { maxLen: 200, forbid: ['\\d{1,3}(,\\d{3})+円', '\\d+円'] }]
];
const score = (t, o) => {
  const ja = (t.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length / Math.max(1, t.replace(/\s/g, '').length);
  const issues = [];
  if (ja < 0.6) issues.push(`ja ${Math.round(ja * 100)}%`);
  if (/[A-Za-z]{12,}/.test(t)) issues.push('english');
  if (/ございます|させていただきます.*させていただきます/.test(t)) issues.push('stiff');
  if (!/(です|ます|ね|よ)/.test(t)) issues.push('no polite ending');
  if (t.length > o.maxLen) issues.push(`long ${t.length}`);
  for (const f of o.forbid ?? []) if (new RegExp(f).test(t)) issues.push('invented price');
  for (const m of o.mustInclude ?? []) if (!new RegExp(m).test(t)) issues.push(`missing ${m}`);
  return issues;
};
let pass = 0;
for (const [input, o] of cases) {
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions: SYS, input }) });
  const j = await r.json(); const text = (j.output_text ?? j.output?.flatMap((x) => x.content ?? []).map((c) => c.text ?? '').join('') ?? '').trim();
  const issues = r.ok ? score(text, o) : [`HTTP ${r.status}`];
  if (!issues.length) pass++;
  console.log(`${issues.length ? 'FAIL' : 'ok  '} | ${input.slice(0, 24)} | ${issues.join(', ')}\n     ${text.replace(/\n/g, ' ').slice(0, 160)}`);
}
console.log(`\n${model}: ${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
