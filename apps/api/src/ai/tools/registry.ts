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
  { key: 'update_assistant_name', kind: 'change', risk: 'low', label: 'Change my name', example: 'Call yourself Mika', touchesClients: false },
  { key: 'create_automation', kind: 'change', risk: 'low', label: 'Save a repeating task as an automation (off until you turn it on)', example: 'Make an automation that reminds clients the day before', touchesClients: false }
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
  if (/\b(automation|automate|workflow)\b/.test(t)) {
    const task = text.replace(/^(please\s+)?(can you\s+)?(make|create|add|set up|setup)\s+(an?\s+)?(automation|workflow)\s+(that|to|for)?\s*/i, '').trim() || text;
    return make('create_automation', { task }, `Save an automation, off until you turn it on: “${task.slice(0, 160)}”`);
  }
  return null;
}

/**
 * Function-calling schemas for every approve-gated tool in TOOLS (text chat AND live voice use these).
 * Each call only PROPOSES: it becomes an Approve card (ai_action_runs status 'proposed'); nothing changes until her tap.
 * A new non-read TOOLS entry must add its schema here, or proposeToolDefs() throws (and the test fails), so it can never be text-only.
 */
const s = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const PROPOSE_SCHEMAS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  block_time: { description: 'Propose blocking time or a day off in her calendar. Shows an Approve card; nothing is blocked until she taps Approve.', parameters: s({ day: { type: 'string', description: 'YYYY-MM-DD' }, from: { type: 'string', description: 'HH:MM, omit for the whole day' }, to: { type: 'string', description: 'HH:MM, omit for the whole day' }, title: { type: 'string' } }, ['day']) },
  record_expense: { description: 'Propose recording an expense. Shows an Approve card; nothing is saved until she taps Approve.', parameters: s({ amount: { type: 'number', description: 'Amount in yen' }, category: { type: 'string', enum: ['supplies', 'rent', 'marketing', 'education', 'equipment', 'fees', 'other'] }, note: { type: 'string' } }, ['amount']) },
  create_post_draft: { description: 'Propose a social post DRAFT about a topic. Shows an Approve card; never posts.', parameters: s({ topic: { type: 'string' }, day: { type: 'string', description: 'Optional planned day YYYY-MM-DD' } }, ['topic']) },
  draft_client_message: { description: 'Propose a new message DRAFT to a client by name (not a reply in an open thread; use draft_reply for that). Shows an Approve card; it is never sent by this tool.', parameters: s({ clientName: { type: 'string' }, about: { type: 'string', description: 'What the message should say, in English' } }, ['clientName', 'about']) },
  propose_memory: { description: 'Propose adding a skill, rule, preference, or fact for the assistant (e.g. "add a skill that…", "change the rule that…", "remember that…"). Shows an Approve card; it is saved only after she taps Approve.', parameters: s({ kind: { type: 'string', enum: ['skill', 'rule', 'preference', 'business_knowledge'] }, content: { type: 'string', description: 'The full skill or rule text, as it should be saved' } }, ['kind', 'content']) },
  update_assistant_name: { description: 'Propose changing the assistant name. Shows an Approve card.', parameters: s({ displayName: { type: 'string' } }, ['displayName']) },
  create_automation: { description: 'Propose saving a repeating task as an automation (saved OFF). Shows an Approve card.', parameters: s({ task: { type: 'string' } }, ['task']) }
};

/** Every approve-gated (non-read) registry tool as a function tool. */
export function proposeToolDefs() {
  return TOOLS.filter((t) => t.kind !== 'read').map((t) => {
    const schema = PROPOSE_SCHEMAS[t.key];
    if (!schema) throw new Error(`Approve-gated tool ${t.key} has no function schema`);
    return { type: 'function', name: t.key, description: schema.description, parameters: schema.parameters };
  });
}
export const PROPOSE_TOOL_NAMES = new Set(TOOLS.filter((t) => t.kind !== 'read').map((t) => t.key));

const MEMORY_CATEGORY: Record<string, string> = { skill: 'workflow', rule: 'preference', preference: 'preference', business_knowledge: 'business_knowledge' };

/** Turns a model function call into the same PlannedTool the text planner makes. Pure; throws on bad input. */
export function proposalFromArgs(key: string, args: Record<string, any>, now: Date, timeZone: string): PlannedTool {
  if (!PROPOSE_TOOL_NAMES.has(key)) throw new Error(`Unknown tool: ${key}`);
  const def = TOOLS.find((x) => x.key === key)!;
  const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const make = (input: Record<string, any>, summary: string): PlannedTool => ({ key, kind: def.kind, risk: def.risk, input, summary });
  const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : null);
  const hm = (v: unknown) => (/^\d{2}:\d{2}$/.test(str(v)) ? str(v) : null);
  if (key === 'block_time') {
    const d = day(args.day); if (!d) throw new Error('Which day?');
    const from = hm(args.from), to = hm(args.to);
    const range = from && to && from < to ? [from, to] : null;
    const title = str(args.title, 80) || (range ? 'Blocked' : 'Day off');
    return make({ day: d, from: range?.[0] ?? null, to: range?.[1] ?? null, startAt: localIso(d, range ? range[0] : '00:00', timeZone), endAt: range ? localIso(d, range[1], timeZone) : localIso(addDays(d, 1), '00:00', timeZone), title, blockType: 'personal' },
      range ? `Block ${d} ${range[0]}–${range[1]} (no bookings then)` : `Day off on ${d} (no bookings that day)`);
  }
  if (key === 'record_expense') {
    const amount = Math.round(Number(args.amount));
    if (!(amount > 0)) throw new Error('How much was it?');
    const category = ['supplies', 'rent', 'marketing', 'education', 'equipment', 'fees', 'other'].includes(args.category) ? args.category : 'other';
    const note = str(args.note, 80) || null;
    return make({ amount, category, note }, `Record expense ¥${amount.toLocaleString('en-US')} · ${category}${note ? ` (${note})` : ''}`);
  }
  if (key === 'create_post_draft') {
    const topic = str(args.topic, 160); if (!topic) throw new Error('What is the post about?');
    const d = day(args.day);
    return make({ topic, plannedFor: d ? localIso(d, '20:00', timeZone) : null }, `Make a post draft about “${topic}” (not posted)`);
  }
  if (key === 'draft_client_message') {
    const clientName = str(args.clientName, 80), about = str(args.about);
    if (!clientName || !about) throw new Error('Which client, and what should it say?');
    return make({ clientName, about }, `Write a message draft to ${clientName}: “${about}”. You approve it again before it is sent.`);
  }
  if (key === 'propose_memory') {
    const content = str(args.content, 240); if (content.length < 2) throw new Error('What should it say?');
    const kind = MEMORY_CATEGORY[args.kind] ? String(args.kind) : 'preference';
    const label = kind === 'skill' ? 'Add skill' : kind === 'rule' ? 'Add rule' : 'Remember';
    return make({ category: MEMORY_CATEGORY[kind], content }, `${label}: “${content}” (saved only after you approve)`);
  }
  if (key === 'update_assistant_name') {
    const displayName = str(args.displayName, 40); if (displayName.length < 2) throw new Error('Which name?');
    return make({ displayName }, `Change my name to ${displayName}`);
  }
  const task = str(args.task, 500); if (!task) throw new Error('What should the automation do?');
  return make({ task }, `Save an automation, off until you turn it on: “${task.slice(0, 160)}”`);
}
