/**
 * C1: the AngelOS tools registry. Pure intent parsing, no database, no AI calls.
 * "read" tools answer straight away from her own records. Every other tool only PROPOSES:
 * the owner sees an approval card and nothing changes until she taps Approve.
 * Client-facing tools only ever create a draft; sending still needs its own Approve in the conversation.
 */
import { localDate, zoneOffset } from '../suggestions/suggestion-rules';

export type ToolKind = 'read' | 'draft' | 'change';
export interface ToolDef { key: string; kind: ToolKind; risk: 'low' | 'medium' | 'high'; label: string; example: string; touchesClients: boolean }

export const TOOLS: ToolDef[] = [
  { key: 'today_schedule', kind: 'read', risk: 'low', label: "Tell you today's or tomorrow's bookings", example: "What's on today?", touchesClients: false },
  { key: 'who_owes', kind: 'read', risk: 'low', label: 'Tell you who still owes money', example: 'Who still owes me?', touchesClients: false },
  { key: 'money_summary', kind: 'read', risk: 'low', label: 'Tell you money received', example: 'How much did I make this week?', touchesClients: false },
  { key: 'block_time', kind: 'change', risk: 'low', label: 'Block time or add a day off', example: 'Block tomorrow 2-4pm', touchesClients: false },
  { key: 'record_expense', kind: 'change', risk: 'medium', label: 'Record an expense', example: 'I spent 3000 yen on supplies', touchesClients: false },
  { key: 'create_post_draft', kind: 'draft', risk: 'low', label: 'Make a social post draft', example: 'Make a post about lip blush healing', touchesClients: false },
  { key: 'draft_client_message', kind: 'draft', risk: 'medium', label: 'Write a client message draft (you approve before it is sent)', example: 'Message Yuki that her touch-up is due', touchesClients: true },
  { key: 'propose_memory', kind: 'change', risk: 'medium', label: 'Remember a preference', example: 'Remember that I close at 6 on Fridays', touchesClients: false },
  { key: 'update_assistant_name', kind: 'change', risk: 'low', label: 'Change my name', example: 'Call yourself Mika', touchesClients: false }
];

export interface PlannedTool { key: string; kind: ToolKind; risk: 'low' | 'medium' | 'high'; input: Record<string, any>; summary: string }

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const EXPENSE_WORDS: Array<[RegExp, string]> = [[/suppl|pigment|needle|ink|glove/i, 'supplies'], [/rent/i, 'rent'], [/ads?\b|marketing|instagram|promo/i, 'marketing'], [/course|class|training|education/i, 'education'], [/machine|equipment|lamp|chair|bed/i, 'equipment'], [/fee|commission|bank/i, 'fees']];

function addDays(day: string, n: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/** Finds a day in the message (today, tomorrow, weekday, 2026-10-12, 10/12). */
export function parseDay(text: string, now: Date, timeZone: string): string | null {
  const today = localDate(now, timeZone);
  const t = text.toLowerCase();
  if (/\btoday\b|今日/.test(t)) return today;
  if (/\btomorrow\b|明日/.test(t)) return addDays(today, 1);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return iso[0];
  const md = /\b(\d{1,2})\/(\d{1,2})\b/.exec(t);
  if (md) {
    const year = Number(today.slice(0, 4));
    let candidate = `${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;
    if (candidate < today) candidate = `${year + 1}${candidate.slice(4)}`;
    return candidate;
  }
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) return addDays(today, ((i - dow + 7) % 7) || 7);
  }
  return null;
}

function hour24(h: number, mer?: string) { if (mer === 'pm' && h < 12) return h + 12; if (mer === 'am' && h === 12) return 0; return h; }

/** "2-4pm", "14:00-16:30", "from 2pm to 4pm" → ["14:00","16:00"]. */
export function parseTimeRange(text: string): [string, string] | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (!m) return null;
  const endMer = m[6]?.toLowerCase();
  const startMer = m[3]?.toLowerCase() ?? (endMer && Number(m[1]) <= Number(m[4]) ? endMer : undefined);
  const s = hour24(Number(m[1]), startMer), e = hour24(Number(m[4]), endMer);
  if (s > 23 || e > 24 || s * 60 + Number(m[2] ?? 0) >= e * 60 + Number(m[5] ?? 0)) return null;
  const f = (h: number, mm?: string) => `${String(h).padStart(2, '0')}:${mm ?? '00'}`;
  return [f(s, m[2]), f(e, m[5])];
}

export function localIso(day: string, time: string, timeZone: string) {
  return new Date(`${day}T${time}:00${zoneOffset(new Date(`${day}T12:00:00Z`), timeZone)}`).toISOString();
}

export function planTool(message: string, now: Date, timeZone: string): PlannedTool | null {
  const text = message.trim();
  const t = text.toLowerCase();
  const def = (key: string) => TOOLS.find((x) => x.key === key)!;
  const make = (key: string, input: Record<string, any>, summary: string): PlannedTool => ({ key, kind: def(key).kind, risk: def(key).risk, input, summary });

  const rename = /(?:call yourself|your name is|rename yourself to)\s+["“]?([^"”.,!?\n]{2,40})/i.exec(text);
  if (rename) return make('update_assistant_name', { displayName: rename[1].trim() }, `Change my name to ${rename[1].trim()}`);
  const remember = /(?:remember that|remember:)\s+(.{4,240})/i.exec(text);
  if (remember) return make('propose_memory', { category: 'preference', content: remember[1].trim() }, `Remember: “${remember[1].trim()}”`);

  if (/who (still )?owes|unpaid|not paid|still owe/.test(t)) return make('who_owes', {}, 'Who still owes money');
  if (/(how much|money|income|earn|made).*(today|week|month)/.test(t)) return make('money_summary', { period: /today/.test(t) ? 'today' : /month/.test(t) ? 'month' : 'week' }, 'Money received');
  if (/(what('s| is)? on|schedule|bookings?|appointments?|who('s| is) coming)/.test(t) && /(today|tomorrow|今日|明日)/.test(t) && !/\b(block|book (?!ings))/.test(t)) {
    return make('today_schedule', { day: parseDay(t, now, timeZone) ?? localDate(now, timeZone) }, 'Your bookings');
  }

  if (/\b(block|day off|days off|take off|i'?m off|busy|close)\b/.test(t) && !/\bpost\b/.test(t)) {
    const day = parseDay(t, now, timeZone);
    if (day) {
      const range = parseTimeRange(t);
      const startAt = localIso(day, range ? range[0] : '00:00', timeZone);
      const endAt = range ? localIso(day, range[1], timeZone) : localIso(addDays(day, 1), '00:00', timeZone);
      const title = range ? 'Blocked' : 'Day off';
      return make('block_time', { day, from: range?.[0] ?? null, to: range?.[1] ?? null, startAt, endAt, title, blockType: 'personal' }, range ? `Block ${day} ${range[0]}–${range[1]} (no bookings then)` : `Day off on ${day} (no bookings that day)`);
    }
  }

  const spent = /(?:spent|paid|bought|expense(?: of)?)\s*¥?\s*([\d,]+)\s*(?:yen|円|jpy)?(?:\s*(?:on|for)\s+(.{2,80}))?/i.exec(text);
  if (spent && /spent|expense|bought|paid .* (for|on)/i.test(text)) {
    const amount = Number(spent[1].replace(/,/g, ''));
    if (amount > 0) {
      const what = (spent[2] ?? '').trim().replace(/[.!]$/, '');
      const category = EXPENSE_WORDS.find(([re]) => re.test(what))?.[1] ?? 'other';
      return make('record_expense', { amount, category, note: what || null }, `Record expense ¥${amount.toLocaleString('en-US')} · ${category}${what ? ` (${what})` : ''}`);
    }
  }

  const post = /(?:make|create|write|draft)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:instagram\s+|social\s+)?(?:post|caption)\s+(?:about|for|on)\s+(.{3,160})/i.exec(text);
  if (post) return make('create_post_draft', { topic: post[1].trim().replace(/[.!]$/, ''), plannedFor: (() => { const d = parseDay(t, now, timeZone); return d ? localIso(d, '20:00', timeZone) : null; })() }, `Make a post draft about “${post[1].trim().replace(/[.!]$/, '')}” (not posted)`);

  const msg = /(?:[Mm]essage|[Tt]ext|[Ww]rite to|[Rr]emind|[Tt]ell)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)\s+(?:that|about|to|:)\s*(.{3,300})/u.exec(text);
  if (msg) return make('draft_client_message', { clientName: msg[1].trim(), about: msg[2].trim().replace(/[.!]$/, '') }, `Write a message draft to ${msg[1].trim()}: “${msg[2].trim().replace(/[.!]$/, '')}”. You approve it again before it is sent.`);
  return null;
}
