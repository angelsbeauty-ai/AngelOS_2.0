/**
 * C4 "AngelOS suggests": free, rule-based candidates. Marketing first, then messages.
 * Pure function so it is fully testable without a database or AI calls.
 */
export type SuggestionKind = 'create_post_draft' | 'draft_reply' | 'client_message' | 'post_now';

export interface Suggestion {
  key: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  preview?: string | null;
  input: Record<string, string>;
  priority: number;
}

export interface ThreadFact {
  id: string;
  name: string;
  platformLabel: string;
  lastDirection: 'inbound' | 'outbound' | null;
  lastAt: string | null;
  status: string;
  archived: boolean;
  hasPendingDraft: boolean;
  preview: string | null;
}

export interface SuggestionInput {
  now: Date;
  timeZone: string;
  /** scheduled_for of every non-failed post variant in the next days */
  plannedPostTimes: string[];
  threads: ThreadFact[];
  dismissedKeys: Set<string>;
  /** Marketing context (Step 4 brain), e.g. "clients often ask about prices" */
  marketingHint?: string | null;
}

/** YYYY-MM-DD for a date in the workspace time zone. */
export function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "+09:00" style offset for a time zone at a given moment (handles DST zones too). */
export function zoneOffset(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return '+00:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
}

/** Evening slot (default 20:00 local, within the JST 19:00–21:00 default best time). */
export function eveningSlot(day: string, timeZone: string, hour = 20): string {
  const probe = new Date(`${day}T12:00:00Z`);
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00${zoneOffset(probe, timeZone)}`).toISOString();
}

export function computeSuggestions(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  const days = [0, 1, 2].map((offset) => localDate(new Date(input.now.getTime() + offset * 86400000), input.timeZone));
  const plannedDays = new Set(input.plannedPostTimes.map((iso) => localDate(new Date(iso), input.timeZone)));

  // 1) Marketing first: no post planned in the next 3 days -> a draft post for the first empty evening.
  if (!days.some((day) => plannedDays.has(day))) {
    const target = days.find((day) => eveningSlot(day, input.timeZone) > input.now.toISOString()) ?? days[1];
    const key = `create_post_draft:${target}`;
    if (!input.dismissedKeys.has(key)) {
      const label = new Date(`${target}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
      out.push({
        key, kind: 'create_post_draft', priority: 1,
        title: 'Nothing is planned on social for the next 3 days',
        detail: `Approve and AngelOS writes a post draft for ${label}, 20:00${input.marketingHint ? ` (${input.marketingHint})` : ''}. It stays a draft until you schedule it.`,
        input: { date: target, plannedFor: eveningSlot(target, input.timeZone) }
      });
    }
  }

  // 2) Unanswered client messages, oldest first -> AI reply draft (never sent without Approve).
  const unanswered = input.threads
    .filter((t) => t.lastDirection === 'inbound' && !t.archived && !t.hasPendingDraft && !['done', 'spam_scam'].includes(t.status))
    .sort((a, b) => String(a.lastAt).localeCompare(String(b.lastAt)));
  for (const thread of unanswered) {
    const key = `draft_reply:${thread.id}`;
    if (input.dismissedKeys.has(key)) continue;
    const waitedHours = thread.lastAt ? Math.max(0, Math.round((input.now.getTime() - new Date(thread.lastAt).getTime()) / 3600000)) : 0;
    out.push({
      key, kind: 'draft_reply', priority: 2,
      title: `Reply to ${thread.name}`,
      detail: `${thread.platformLabel} · waiting ${waitedHours < 1 ? 'less than an hour' : waitedHours < 48 ? `${waitedHours}h` : `${Math.round(waitedHours / 24)} days`}. Approve and AngelOS writes a reply draft for you to check. Nothing is sent yet.`,
      preview: thread.preview,
      input: { threadId: thread.id }
    });
  }
  return out.sort((a, b) => a.priority - b.priority).slice(0, 12);
}
