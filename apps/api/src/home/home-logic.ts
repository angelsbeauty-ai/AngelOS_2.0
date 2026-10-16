/** Pure Home Command Center logic: period windows, box counts, and the factual (numbers-only) briefing. */
export type Period = 'day' | 'week' | 'month';

export interface ApptIn { id: string; start_at: string; end_at: string; status: string; service_name: string | null; client_id: string | null; client_name: string | null }
export interface ThreadIn { id: string; unread: boolean; needs_reply: boolean; status: string; intent: string; priority: string; needs_owner: boolean; name: string; platform_label: string; last_message_at: string | null; preview: string | null }
export interface SocialIn { platform: string; followers: number | null; engagement: number | null; reach: number | null; followersChange7d: number | null }
export interface PostIn { title: string; platform: string; published_at: string | null }
export interface SuggestionIn { key: string; title: string; reason?: string | null }

/** Local (Asia/Tokyo by default) start/end of the period that contains `now`. Week starts Monday. */
export function periodWindow(period: Period, now: Date, offsetMinutes = 540): { start: Date; end: Date } {
  const local = new Date(now.getTime() + offsetMinutes * 60000);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  let s: number, e: number;
  if (period === 'month') { s = Date.UTC(y, m, 1); e = Date.UTC(y, m + 1, 1); }
  else if (period === 'week') { const dow = (local.getUTCDay() + 6) % 7; s = Date.UTC(y, m, d - dow); e = s + 7 * 86400000; }
  else { s = Date.UTC(y, m, d); e = s + 86400000; }
  return { start: new Date(s - offsetMinutes * 60000), end: new Date(e - offsetMinutes * 60000) };
}

const ACTIVE = new Set(['requested', 'pending', 'confirmed', 'booked', 'scheduled', 'checked_in', 'in_progress']);

export function scheduleBox(appts: ApptIn[], returningClientIds: Set<string>, touchUpsDue: number, now: Date) {
  const cancelled = appts.filter((a) => a.status === 'cancelled');
  const live = appts.filter((a) => a.status !== 'cancelled');
  const pending = live.filter((a) => a.status === 'requested' || a.status === 'pending');
  const upcoming = live.filter((a) => new Date(a.end_at) > now && (ACTIVE.has(a.status) || !['completed', 'no_show'].includes(a.status)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const withClient = live.filter((a) => a.client_id);
  const returning = withClient.filter((a) => returningClientIds.has(a.client_id!)).length;
  return {
    total: live.length, pending: pending.length, cancelled: cancelled.length, completed: live.filter((a) => a.status === 'completed').length,
    newClients: withClient.length - returning, returningClients: returning, touchUpsDue,
    next: upcoming[0] ? { id: upcoming[0].id, start_at: upcoming[0].start_at, end_at: upcoming[0].end_at, service: upcoming[0].service_name, client: upcoming[0].client_name, status: upcoming[0].status } : null,
    items: live.sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 30).map((a) => ({ id: a.id, start_at: a.start_at, end_at: a.end_at, service: a.service_name, client: a.client_name, status: a.status, returning: a.client_id ? returningClientIds.has(a.client_id) : null }))
  };
}

/** Read state (unread) is kept separate from booking state (intent/status). */
export function messagesBox(threads: ThreadIn[]) {
  const open = threads.filter((t) => t.status !== 'spam_scam');
  const important = open.filter((t) => t.priority === 'urgent' || t.needs_owner || t.status === 'needs_owner');
  return {
    total: open.length, unread: open.filter((t) => t.unread).length, needsReply: open.filter((t) => t.needs_reply).length, important: important.length,
    booking: { inProgress: open.filter((t) => t.status === 'booking_in_progress').length, reschedule: open.filter((t) => t.intent === 'reschedule').length, inquiries: open.filter((t) => t.intent === 'booking' || t.intent === 'price' || t.intent === 'inquiry').length },
    alerts: open.filter((t) => t.unread || t.needs_reply || important.includes(t)).sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')).slice(0, 20)
      .map((t) => ({ id: t.id, name: t.name, platform: t.platform_label, at: t.last_message_at, unread: t.unread, needsReply: t.needs_reply, important: important.includes(t), preview: t.preview }))
  };
}

export function socialBox(items: SocialIn[], posts: PostIn[]) {
  const followers = items.some((i) => i.followers != null) ? items.reduce((s, i) => s + (i.followers ?? 0), 0) : null;
  const engagement = items.some((i) => i.engagement != null) ? items.reduce((s, i) => s + (i.engagement ?? 0), 0) : null;
  const reach = items.some((i) => i.reach != null) ? items.reduce((s, i) => s + (i.reach ?? 0), 0) : null;
  const change = items.some((i) => i.followersChange7d != null) ? items.reduce((s, i) => s + (i.followersChange7d ?? 0), 0) : null;
  return { connected: items.map((i) => i.platform), followers, engagement, reach, followersChange7d: change, postsInPeriod: posts.length, recentPosts: posts.slice(0, 5), platforms: items };
}

export function assistantBox(suggestions: SuggestionIn[], pendingApprovals: number) {
  return { suggestions: suggestions.slice(0, 6), pendingApprovals };
}

export const WEEKLY_GOALS = { stories: 3, carousels: 1 };

/** Counts published posts this week. A missing format is not counted as a story or a carousel. */
export function weekCounts(rows: Array<{ format?: string | null }>) {
  const counts = { stories: 0, carousels: 0, reels: 0, photos: 0 };
  for (const row of rows) {
    if (row.format === 'story') counts.stories += 1;
    else if (row.format === 'carousel') counts.carousels += 1;
    else if (row.format === 'reel') counts.reels += 1;
    else if (row.format === 'photo') counts.photos += 1;
  }
  return { ...counts, goals: WEEKLY_GOALS };
}

/** The post with the most recorded views. No views means no inspiration — nothing is invented. */
export function pickInspiration(posts: Array<{ title: string | null; platform: string; views: number | null; published_at: string | null }>) {
  const ranked = posts.filter((p) => p.title && p.views != null);
  ranked.sort((a, b) => (b.views! - a.views!) || String(b.published_at).localeCompare(String(a.published_at)));
  const top = ranked[0];
  return top ? { title: top.title as string, platform: top.platform, views: top.views as number, published_at: top.published_at } : null;
}

type Summary = { schedule: ReturnType<typeof scheduleBox>; messages: ReturnType<typeof messagesBox>; social: ReturnType<typeof socialBox>; assistant: ReturnType<typeof assistantBox> };

/** Facts only. Used as the briefing when AI is off, and as the only input given to the AI. */
export function factLines(s: Summary, period: Period): string[] {
  const when = period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month';
  const out: string[] = [];
  out.push(s.schedule.total ? `${s.schedule.total} booking${s.schedule.total === 1 ? '' : 's'} ${when}${s.schedule.pending ? `, ${s.schedule.pending} waiting for confirmation` : ''}.` : `No bookings ${when}.`);
  if (s.schedule.cancelled) out.push(`${s.schedule.cancelled} cancellation${s.schedule.cancelled === 1 ? '' : 's'} ${when}.`);
  if (s.schedule.touchUpsDue) out.push(`${s.schedule.touchUpsDue} client${s.schedule.touchUpsDue === 1 ? ' is' : 's are'} due for a touch-up.`);
  out.push(s.messages.needsReply ? `${s.messages.needsReply} conversation${s.messages.needsReply === 1 ? '' : 's'} waiting for a reply${s.messages.important ? `, ${s.messages.important} marked important` : ''}.` : 'No messages waiting for a reply.');
  if (s.social.followers != null) out.push(`${s.social.followers.toLocaleString('en-US')} followers across connected accounts${s.social.followersChange7d ? ` (${s.social.followersChange7d > 0 ? '+' : ''}${s.social.followersChange7d} in 7 days)` : ''}.`);
  if (s.assistant.pendingApprovals) out.push(`${s.assistant.pendingApprovals} AI draft${s.assistant.pendingApprovals === 1 ? '' : 's'} waiting for your approval.`);
  return out;
}

export const BRIEFING_INSTRUCTIONS = 'You write a calm 2-3 sentence daily briefing for a beauty studio owner. Use ONLY the facts given. Do not add numbers, names, trends, advice or events that are not in the facts. If a fact says there is nothing, say so plainly. No greeting, no emojis.';
