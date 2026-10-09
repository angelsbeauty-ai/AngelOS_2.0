/**
 * AngelOS brain taxonomy. Turns something a person did into a FIXED topic key + a template summary.
 * Nothing from the original text is ever copied into the output: summaries and tags come only
 * from this file. That is what keeps the brain "summaries only, no transcripts".
 */

export type BrainKind = 'owner_request' | 'owner_preference' | 'client_request';

export interface BrainNote {
  kind: BrainKind;
  topic: string;
  summary: string;
  tags: string[];
}

interface TopicDef { key: string; label: string; patterns: RegExp[] }

/** What owners ask AngelOS (the AI chat) to help with. Order matters: first match wins per topic, several topics may match. */
export const OWNER_TOPICS: TopicDef[] = [
  { key: 'social_posts', label: 'social media posts', patterns: [/\b(post|posts|caption|instagram|insta|reel|reels|story|stories|hashtag|content)\b/i, /投稿|インスタ|キャプション/] },
  { key: 'client_replies', label: 'replying to clients', patterns: [/\b(reply|respond|answer|message|messages|dm|dms|line)\b/i, /返信|メッセージ|返事/] },
  { key: 'bookings', label: 'bookings and the calendar', patterns: [/\b(booking|bookings|appointment|appointments|schedule|calendar|slot|slots|availability)\b/i, /予約|スケジュール|空き/] },
  { key: 'rebooking_followups', label: 'rebooking and follow-ups', patterns: [/\b(rebook|re-book|follow[- ]?up|touch[- ]?up|remind|reminder|retention|come back)\b/i, /リタッチ|再来|リマインド/] },
  { key: 'pricing_promotions', label: 'prices and promotions', patterns: [/\b(price|prices|pricing|discount|promo|promotion|campaign|deal|offer)\b/i, /料金|値段|割引|キャンペーン/] },
  { key: 'marketing_growth', label: 'getting more clients', patterns: [/\b(marketing|market|grow|growth|more clients|new clients|advertis\w*|reach|followers)\b/i, /集客|宣伝|新規/] },
  { key: 'money', label: 'sales and money', patterns: [/\b(revenue|sales|income|profit|expense|expenses|money|earn\w*|finance)\b/i, /売上|収入|経費/] },
  { key: 'aftercare', label: 'aftercare advice', patterns: [/\b(aftercare|after care|healing|heal)\b/i, /アフターケア/] },
  { key: 'academy', label: 'students and courses', patterns: [/\b(student|students|course|courses|class|classes|training|academy)\b/i, /スクール|講座|受講/] },
  { key: 'translation', label: 'translation and Japanese', patterns: [/\b(translate|translation|japanese|english)\b/i, /翻訳|日本語|英語/] },
  { key: 'insights', label: 'stats and insights', patterns: [/\b(stats|statistics|insight|insights|analytics|how many|numbers|report)\b/i, /分析|統計/] }
];

/** Client message intents (from messaging.classifyIntent) -> topic. */
export const CLIENT_INTENT_LABELS: Record<string, string> = {
  booking: 'booking an appointment',
  reschedule: 'moving an appointment',
  price: 'prices',
  location: 'directions and location',
  aftercare: 'aftercare',
  student: 'courses and training',
  follow_up: 'follow-ups',
  complaint: 'a problem or complaint',
  inquiry: 'general questions'
};

/** Owner preference settings that are worth remembering (value lists are fixed by the DTOs). */
export const PREFERENCE_LABELS: Record<string, Record<string, string>> = {
  reply_tone: { casual_friendly: 'casual, friendly replies', warm_polite: 'warm, polite replies', professional: 'professional replies', playful: 'playful replies' },
  emoji_level: { none: 'no emoji in replies', light: 'a little emoji in replies', lots: 'lots of emoji in replies' },
  reply_length: { short: 'short replies', medium: 'medium-length replies', detailed: 'detailed replies' },
  learn_from_replies: { on: 'AngelOS learning from her replies', off: 'AngelOS not learning from her replies' },
  assistant_tone: { warm_professional: 'a warm, professional assistant', direct: 'a direct assistant', calm: 'a calm assistant', friendly: 'a friendly assistant', custom: 'a custom assistant personality' },
  assistant_length: { concise: 'concise assistant answers', balanced: 'balanced assistant answers', detailed: 'detailed assistant answers' }
};

const SAFE_TAG = /^[a-z0-9_]{1,30}$/;

function langTag(language?: string | null) {
  return language === 'ja' ? 'ja' : language === 'en' ? 'en' : null;
}

function cleanTags(tags: Array<string | null | undefined>) {
  return Array.from(new Set(tags.filter((t): t is string => !!t && SAFE_TAG.test(t)))).slice(0, 8);
}

/** Owner typed something to AngelOS. Returns 0..3 topic notes; never any of the typed words. */
export function noteOwnerRequest(text: string, language?: string | null): BrainNote[] {
  const value = (text ?? '').slice(0, 4000);
  const hits = OWNER_TOPICS.filter((topic) => topic.patterns.some((p) => p.test(value))).slice(0, 3);
  const lang = langTag(language) ?? (/[\u3040-\u30ff\u4e00-\u9faf]/.test(value) ? 'ja' : 'en');
  return hits.map((topic) => ({
    kind: 'owner_request' as const,
    topic: topic.key,
    summary: `Owner asked AngelOS for help with ${topic.label}.`,
    tags: cleanTags(['owner', 'ai_chat', topic.key, lang])
  }));
}

/** A client message arrived and was classified. Only the intent key is used. */
export function noteClientRequest(intent: string, platform?: string | null, language?: string | null): BrainNote | null {
  const key = CLIENT_INTENT_LABELS[intent] ? intent : 'inquiry';
  return {
    kind: 'client_request',
    topic: `client_${key}`,
    summary: `Clients asked about ${CLIENT_INTENT_LABELS[key]}.`,
    tags: cleanTags(['client', key, platform && SAFE_TAG.test(platform) ? platform : null, langTag(language)])
  };
}

/** Owner changed a setting. Only known setting/value pairs are recorded. */
export function notePreference(setting: string, value: string | boolean): BrainNote | null {
  const normalized = typeof value === 'boolean' ? (value ? 'on' : 'off') : String(value);
  const label = PREFERENCE_LABELS[setting]?.[normalized];
  if (!label) return null;
  return {
    kind: 'owner_preference',
    topic: `${setting}_${normalized}`,
    summary: `Owner prefers ${label}.`,
    tags: cleanTags(['owner', 'preference', setting])
  };
}

export function topicLabel(kind: string, topic: string): string {
  if (kind === 'client_request') return CLIENT_INTENT_LABELS[topic.replace(/^client_/, '')] ?? topic;
  if (kind === 'owner_request') return OWNER_TOPICS.find((t) => t.key === topic)?.label ?? topic;
  for (const [setting, values] of Object.entries(PREFERENCE_LABELS)) {
    for (const [value, label] of Object.entries(values)) if (`${setting}_${value}` === topic) return label;
  }
  return topic;
}

/** Client topics that make sense as a marketing angle (not complaints / vague questions). */
const MARKETING_TOPICS = new Set(['client_price', 'client_aftercare', 'client_booking', 'client_location', 'client_student', 'client_reschedule']);

/** "clients often ask about prices and aftercare" from topic counts (own workspace first, else anonymised aggregate). */
export function marketingHintFrom(rows: Array<{ topic: string; count: number }>, scope: 'own' | 'all'): string | null {
  const top = rows
    .filter((row) => MARKETING_TOPICS.has(row.topic) && row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((row) => CLIENT_INTENT_LABELS[row.topic.replace(/^client_/, '')]);
  if (!top.length) return null;
  const list = top.join(' and ');
  return scope === 'own' ? `your clients often ask about ${list}` : `clients at many studios often ask about ${list}`;
}
