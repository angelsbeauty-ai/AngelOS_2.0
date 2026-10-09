import { createHash } from 'node:crypto';

/**
 * Pure, deterministic analysis of the owner's own replies to clients.
 * Output is a LEARNING (numbers + short masked patterns), never a copy of conversations.
 */
export interface ReplySample { body: string; createdAt?: string }

export interface LearnedStyle {
  sampleCount: number;
  languageMix: { en: number; ja: number };
  avgLength: { en: number | null; ja: number | null };
  lengthBand: 'short' | 'medium' | 'long';
  emojiPerReply: number;
  topEmojis: string[];
  exclamationRate: number;
  greetings: string[];
  closings: string[];
  formality: 'casual' | 'polite' | 'formal';
  usesClientName: boolean;
}

export interface RepeatedReplyCandidate {
  body: string;
  language: 'en' | 'ja';
  occurrences: number;
  category: string;
  title: string;
  fingerprint: string;
  lastSeenAt: string | null;
}

const JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g;
const EMOJI = /\p{Extended_Pictographic}/gu;

export function replyLanguage(text: string): 'en' | 'ja' {
  return (text.match(JA) ?? []).length >= 2 ? 'ja' : 'en';
}

/** Masks client names, emails, phone numbers, URLs with ids, dates and times. */
export function maskPersonal(text: string, names: string[] = []): string {
  let out = text;
  const sorted = [...new Set(names.flatMap((name) => [name, ...name.split(/[\s\u3000]+/)]).map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Latin names only as whole words ("Lee" must not hit "Leeway"); Japanese names as written.
    out = /^[\x00-\x7F]+$/.test(name) ? out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '{name}') : out.split(name).join('{name}');
  }
  out = out
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b\d{4}-\d{1,2}-\d{1,2}\b/g, '[date]')
    .replace(/\b\d{1,2}:\d{2}\b/g, '[time]')
    .replace(/(\+?\d[\d\s-]{8,}\d)/g, '[phone]')
    .replace(/\d{1,2}月\d{1,2}日/g, '[日付]')
    .replace(/\d{1,2}時(\d{1,2}分)?/g, '[時間]');
  return out.replace(/\{name\}(\s*\{name\})+/g, '{name}');
}

function tokens(text: string): Set<string> {
  const lower = text.toLowerCase().replace(EMOJI, ' ');
  const set = new Set<string>();
  for (const word of lower.match(/[a-z]{2,}/g) ?? []) set.add(word);
  const ja = (lower.match(JA) ?? []).join('');
  for (let i = 0; i < ja.length - 1; i += 1) set.add(ja.slice(i, i + 2));
  return set;
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a); const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

function firstClause(text: string) {
  return text.trim().split(/[\n!！?？。.]/)[0].trim().slice(0, 40);
}
function lastClause(text: string) {
  const parts = text.trim().split(/(?<=[\n!！?？。.])/).map((p) => p.trim()).filter(Boolean);
  return (parts[parts.length - 1] ?? '').slice(0, 40);
}
function topPatterns(values: string[], min = 2, max = 3) {
  const counts = new Map<string, number>();
  for (const value of values) if (value && value.length >= 2) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, max).map(([value]) => value);
}

export function analyzeStyle(samples: ReplySample[], names: string[] = []): LearnedStyle {
  const bodies = samples.map((s) => s.body.trim()).filter(Boolean);
  const masked = bodies.map((body) => maskPersonal(body, names));
  const en = masked.filter((b) => replyLanguage(b) === 'en');
  const ja = masked.filter((b) => replyLanguage(b) === 'ja');
  const avg = (list: string[]) => list.length ? Math.round(list.reduce((sum, b) => sum + [...b].length, 0) / list.length) : null;
  const avgAll = masked.length ? masked.reduce((sum, b) => sum + [...b].length, 0) / masked.length : 0;
  const emojiCounts = new Map<string, number>();
  let emojiTotal = 0;
  for (const body of masked) for (const emoji of body.match(EMOJI) ?? []) { emojiTotal += 1; emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1); }
  const formalHits = masked.filter((b) => /いたします|させていただ|ございます|申し上げ|kind regards|sincerely|dear /i.test(b)).length;
  const casualHits = masked.filter((b) => /ね[!！✨🌸😊]?$|よね|〜|hey|hi |!|！/i.test(b)).length;
  const formality: LearnedStyle['formality'] = formalHits > masked.length * 0.4 ? 'formal' : casualHits >= masked.length * 0.5 ? 'casual' : 'polite';
  return {
    sampleCount: masked.length,
    languageMix: { en: en.length, ja: ja.length },
    avgLength: { en: avg(en), ja: avg(ja) },
    lengthBand: avgAll < 90 ? 'short' : avgAll < 220 ? 'medium' : 'long',
    emojiPerReply: masked.length ? Math.round((emojiTotal / masked.length) * 10) / 10 : 0,
    topEmojis: [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e]) => e),
    exclamationRate: masked.length ? Math.round((masked.filter((b) => /[!！]/.test(b)).length / masked.length) * 100) / 100 : 0,
    greetings: topPatterns(masked.map(firstClause)),
    closings: topPatterns(masked.map(lastClause)),
    formality,
    usesClientName: masked.filter((b) => b.includes('{name}')).length >= Math.max(1, Math.ceil(masked.length * 0.3))
  };
}

const CATEGORY_RULES: Array<[string, RegExp, string]> = [
  ['aftercare', /aftercare|healing|scab|flak|wash|アフターケア|かさぶた|皮むけ|洗顔|濡らさ/i, 'Aftercare'],
  ['prices', /price|yen|¥|cost|料金|円|値段/i, 'Prices'],
  ['directions', /address|parking|station|map|住所|駐車場|場所|駅/i, 'Directions'],
  ['deposit', /deposit|デポジット|前金/i, 'Deposit'],
  ['cancellation', /cancel|キャンセル/i, 'Cancellation'],
  ['booking', /book|appointment|available|slot|予約|空き/i, 'Booking'],
  ['follow_up', /how are|how is|checking in|その後|調子/i, 'Follow-up']
];

export function guessCategory(text: string): { category: string; label: string } {
  for (const [category, re, label] of CATEGORY_RULES) if (re.test(text)) return { category, label };
  return { category: 'other', label: 'Repeated reply' };
}

/** Replies the owner sent at least `minCount` times (similar wording) become saved-reply suggestions. */
export function findRepeatedReplies(samples: ReplySample[], names: string[] = [], minCount = 3, threshold = 0.6): RepeatedReplyCandidate[] {
  const items = samples
    .map((s) => ({ body: maskPersonal(s.body.trim(), names), at: s.createdAt ?? null }))
    .filter((s) => [...s.body].length >= 15);
  const clusters: Array<{ members: typeof items }> = [];
  for (const item of items) {
    let best: { cluster: (typeof clusters)[number]; score: number } | null = null;
    for (const cluster of clusters) {
      const score = similarity(item.body, cluster.members[0].body);
      if (score >= threshold && (!best || score > best.score)) best = { cluster, score };
    }
    if (best) best.cluster.members.push(item); else clusters.push({ members: [item] });
  }
  return clusters.filter((c) => c.members.length >= minCount).map((cluster) => {
    // Representative = the member most similar to all the others (the "usual" wording).
    let rep = cluster.members[0]; let repScore = -1;
    for (const candidate of cluster.members) {
      const score = cluster.members.reduce((sum, other) => sum + similarity(candidate.body, other.body), 0);
      if (score > repScore) { rep = candidate; repScore = score; }
    }
    const language = replyLanguage(rep.body);
    const { category, label } = guessCategory(rep.body);
    const lastSeenAt = cluster.members.map((m) => m.at).filter(Boolean).sort().pop() ?? null;
    return {
      body: rep.body.slice(0, 2000), language, occurrences: cluster.members.length, category,
      title: `${label} (${language.toUpperCase()})`,
      fingerprint: createHash('sha256').update([...tokens(rep.body)].sort().join(' ')).digest('hex').slice(0, 32),
      lastSeenAt
    };
  }).sort((a, b) => b.occurrences - a.occurrences);
}

/** Rough token estimate: Japanese ~1 token per character, other text ~1 token per 4 characters. */
export function estimateTokens(text: string): number {
  const ja = (text.match(JA) ?? []).length;
  return ja + Math.ceil((text.length - ja) / 4);
}

export interface ManualStyle { reply_tone?: string; emoji_level?: string; reply_length?: string; style_notes?: string }
export interface SavedReplyLite { title: string; category: string; body_en: string | null; body_ja: string | null }

const TONE_TEXT: Record<string, string> = {
  casual_friendly: 'casual and friendly (like a kind salon friend)',
  warm_polite: 'warm and polite',
  professional: 'professional and calm',
  playful: 'playful and upbeat'
};
const INTENT_CATEGORY: Record<string, string> = { price: 'prices', location: 'directions', aftercare: 'aftercare', booking: 'booking', reschedule: 'cancellation', follow_up: 'follow_up' };

/**
 * Builds the "how the owner writes" block for reply drafts. Manual settings win over learned ones.
 * Kept under `maxTokens` (default 2400) so the whole prompt stays under ~3k tokens.
 */
export function buildReplyStyleContext(input: { manual?: ManualStyle | null; learned?: Partial<LearnedStyle> | null; savedReplies?: SavedReplyLite[]; intent?: string; language: 'en' | 'ja'; maxTokens?: number }): string {
  const maxTokens = input.maxTokens ?? 2400;
  const lines: string[] = ['OWNER REPLY STYLE (follow it; manual settings win over learned patterns):'];
  const manual = input.manual ?? {};
  if (manual.reply_tone) lines.push(`- Tone: ${TONE_TEXT[manual.reply_tone] ?? manual.reply_tone}.`);
  if (manual.emoji_level) lines.push(`- Emoji: ${manual.emoji_level === 'none' ? 'no emoji' : manual.emoji_level === 'lots' ? 'several emoji are fine' : 'one or two light emoji'}.`);
  if (manual.reply_length) lines.push(`- Length: ${manual.reply_length}.`);
  if (manual.style_notes?.trim()) lines.push(`- Owner's notes: ${manual.style_notes.trim().slice(0, 600)}`);
  const learned = input.learned;
  if (learned?.sampleCount) {
    const avg = input.language === 'ja' ? learned.avgLength?.ja : learned.avgLength?.en;
    lines.push(`- Learned from ${learned.sampleCount} of her replies: ${learned.formality ?? 'polite'} formality${avg ? `, about ${avg} characters` : ''}, ${learned.emojiPerReply ?? 0} emoji per reply${learned.topEmojis?.length ? ` (often ${learned.topEmojis.join(' ')})` : ''}${learned.usesClientName ? ', uses the client\'s name' : ''}.`);
    const greet = (learned.greetings ?? []).filter((g) => replyLanguage(g) === input.language);
    const close = (learned.closings ?? []).filter((c) => replyLanguage(c) === input.language);
    if (greet.length) lines.push(`- Usual openings: ${greet.join(' / ')}`);
    if (close.length) lines.push(`- Usual closings: ${close.join(' / ')}`);
  }
  let out = lines.length > 1 ? lines.join('\n') : '';
  const replies = (input.savedReplies ?? []).filter((r) => (input.language === 'ja' ? r.body_ja : r.body_en ?? r.body_ja));
  const wanted = input.intent ? INTENT_CATEGORY[input.intent] : undefined;
  const match = wanted ? replies.find((r) => r.category === wanted) : undefined;
  if (match) {
    const body = (input.language === 'ja' ? match.body_ja : match.body_en) ?? '';
    const block = `\nBest matching approved saved reply ("${match.title}"). Use it, replacing {name}; keep any [brackets] for the owner to fill.\nSAVED_REPLY_MATCH: ${body.replace(/\n/g, ' ')}`;
    if (estimateTokens(out + block) <= maxTokens) out += block;
  }
  const others = replies.filter((r) => r !== match);
  if (others.length) {
    let section = '\nOther approved saved replies (facts and wording she uses):';
    for (const reply of others) {
      const body = ((input.language === 'ja' ? reply.body_ja : reply.body_en) ?? '').replace(/\n/g, ' ');
      const line = `\n- ${reply.title}: ${body}`;
      if (estimateTokens(out + section + line) > maxTokens) break;
      section += line;
    }
    if (section.includes('\n- ')) out += section;
  }
  return out.trim();
}
