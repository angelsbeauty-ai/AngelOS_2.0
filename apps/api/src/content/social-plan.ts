/**
 * Pure planning logic for B0.5 (campaigns, 30-day plan, ideas bank). No network, no AI.
 * Dates are local YYYY-MM-DD strings in the workspace time zone.
 */

export type PlanCategory = 'results' | 'education' | 'behind_the_scenes' | 'testimonial' | 'offer';
export interface PlannedPost { date: string; category: PlanCategory; title: string; objective: string; format: 'photo' | 'carousel' | 'reel' | 'story'; platforms: string[] }
export interface ContentIdea { key: string; title: string; angle: string; source: 'season' | 'photos' | 'services' | 'slow_day' | 'mix'; date?: string; objective: string }

export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  results: 'Results', education: 'Education', behind_the_scenes: 'Behind the scenes', testimonial: 'Client story', offer: 'Offer / Academy'
};
const CATEGORY_FORMAT: Record<PlanCategory, PlannedPost['format']> = { results: 'carousel', education: 'reel', behind_the_scenes: 'reel', testimonial: 'photo', offer: 'photo' };
const CATEGORY_OBJECTIVE: Record<PlanCategory, string> = { results: 'bookings', education: 'education', behind_the_scenes: 'trust', testimonial: 'trust', offer: 'bookings' };
const CATEGORY_TITLES: Record<PlanCategory, string[]> = {
  results: ['Fresh brows result', 'Healed result after 6 weeks', 'Soft lip blush result', 'Before & after: natural brows', 'Eyeliner result'],
  education: ['How long do PMU brows last?', 'Aftercare in 3 steps', 'Who is PMU right for?', 'Powder vs. hair strokes'],
  behind_the_scenes: ['A day at the studio', 'Mapping the perfect brow shape', 'Choosing the right pigment'],
  testimonial: ['What clients say'],
  offer: ['Booking open this month', 'Academy: next intake']
};

/** Mix 40/25/15/10/10 (results / education / behind the scenes / testimonial / offer). */
export function mixCounts(total: number): Record<PlanCategory, number> {
  const weights: Array<[PlanCategory, number]> = [['results', 0.4], ['education', 0.25], ['behind_the_scenes', 0.15], ['testimonial', 0.1], ['offer', 0.1]];
  const counts = Object.fromEntries(weights.map(([k, w]) => [k, Math.floor(total * w)])) as Record<PlanCategory, number>;
  let left = total - Object.values(counts).reduce((a, b) => a + b, 0);
  const order = [...weights].sort((a, b) => (total * b[1] % 1) - (total * a[1] % 1));
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) counts[order[i][0]] += 1;
  return counts;
}

export function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d + days));
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`), b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** Interleaves categories so the same kind is not posted twice in a row when avoidable. */
function interleave(counts: Record<PlanCategory, number>): PlanCategory[] {
  const left = { ...counts };
  const out: PlanCategory[] = [];
  const total = Object.values(left).reduce((a, b) => a + b, 0);
  for (let i = 0; i < total; i++) {
    const options = (Object.keys(left) as PlanCategory[]).filter((k) => left[k] > 0).sort((a, b) => left[b] - left[a]);
    const pick = options.find((k) => k !== out[out.length - 1]) ?? options[0];
    out.push(pick); left[pick] -= 1;
  }
  return out;
}

/** Evenly spaced posts between two dates (inclusive), skipping existing busy days when possible. */
export function planPosts(input: { startsOn: string; endsOn: string; count: number; busyDays?: string[]; platforms?: string[]; mix?: Record<PlanCategory, number> }): PlannedPost[] {
  const span = Math.max(0, daysBetween(input.startsOn, input.endsOn));
  const count = Math.max(1, Math.min(input.count, span + 1));
  const busy = new Set(input.busyDays ?? []);
  const categories = interleave(input.mix ?? mixCounts(count));
  const used = new Set<string>();
  const seen: Record<string, number> = {};
  return categories.map((category, index) => {
    let offset = count === 1 ? 0 : Math.round((index * span) / (count - 1));
    let date = addDaysLocal(input.startsOn, offset);
    for (let shift = 1; (busy.has(date) || used.has(date)) && shift <= 3; shift++) {
      const next = offset + shift <= span ? addDaysLocal(input.startsOn, offset + shift) : date;
      if (!busy.has(next) && !used.has(next)) { date = next; break; }
    }
    used.add(date);
    const titles = CATEGORY_TITLES[category];
    const title = titles[(seen[category] = (seen[category] ?? -1) + 1) % titles.length];
    return { date, category, title, objective: CATEGORY_OBJECTIVE[category], format: CATEGORY_FORMAT[category], platforms: input.platforms ?? ['instagram', 'facebook'] };
  });
}

/** Campaign = 1 post every ~3 days (3..10 posts) + a LINE broadcast in the middle. */
export function planCampaign(input: { startsOn: string; endsOn: string; goal: string; busyDays?: string[] }) {
  const span = Math.max(0, daysBetween(input.startsOn, input.endsOn));
  const count = Math.max(3, Math.min(10, Math.round((span + 1) / 3)));
  const mix: Record<PlanCategory, number> = input.goal === 'academy_students'
    ? { results: Math.ceil(count * 0.3), education: Math.ceil(count * 0.3), behind_the_scenes: 1, testimonial: 0, offer: 0 }
    : { results: Math.ceil(count * 0.4), education: Math.ceil(count * 0.2), behind_the_scenes: 1, testimonial: 0, offer: 0 };
  const used = Object.values(mix).reduce((a, b) => a + b, 0);
  mix.offer = Math.max(1, count - used);
  const posts = planPosts({ startsOn: input.startsOn, endsOn: input.endsOn, count: Object.values(mix).reduce((a, b) => a + b, 0), busyDays: input.busyDays, mix });
  const lineBroadcastOn = addDaysLocal(input.startsOn, Math.floor(span / 2));
  return { posts, lineBroadcastOn };
}

const SEASON: Array<{ month: number; day: number; key: string; title: string; angle: string; objective: string }> = [
  { month: 1, day: 8, key: 'seijinshiki', title: 'Coming of Age Day (成人式) brows', angle: 'Look your best for 成人式 photos: book brows 2–4 weeks before', objective: 'bookings' },
  { month: 2, day: 14, key: 'valentine', title: 'Valentine\'s lip blush', angle: 'Soft lip blush for Valentine\'s Day', objective: 'bookings' },
  { month: 3, day: 10, key: 'graduation', title: 'Graduation & new job season', angle: 'Fresh start for spring: graduation and new jobs', objective: 'bookings' },
  { month: 4, day: 20, key: 'golden_week', title: 'Golden Week slots', angle: 'Golden Week: limited slots, book early', objective: 'availability' },
  { month: 6, day: 1, key: 'rainy_season', title: 'Rainy season (梅雨) proof brows', angle: 'Brows that survive humidity and rain', objective: 'education' },
  { month: 7, day: 1, key: 'okinawa_summer', title: 'Okinawa summer: beach-proof brows', angle: 'Swim, sweat, still perfect brows', objective: 'bookings' },
  { month: 8, day: 5, key: 'obon', title: 'Obon (お盆) homecoming look', angle: 'Look fresh for family visits at お盆', objective: 'bookings' },
  { month: 10, day: 20, key: 'halloween', title: 'Halloween behind the scenes', angle: 'Fun studio content for Halloween', objective: 'engagement' },
  { month: 11, day: 10, key: 'year_end_touch_up', title: 'Year-end touch-up push', angle: 'Touch-ups before the new year', objective: 'bookings' },
  { month: 12, day: 20, key: 'nenmatsu', title: 'Year-end (年末) thank you', angle: 'Thank clients for the year; new-year slots open', objective: 'trust' },
  { month: 12, day: 1, key: 'academy_january', title: 'Academy January intake', angle: 'Start your PMU career in the new year', objective: 'education' }
];

export function seasonalIdeas(today: string, horizonDays = 60): ContentIdea[] {
  const year = Number(today.slice(0, 4));
  const out: ContentIdea[] = [];
  for (const y of [year, year + 1]) {
    for (const s of SEASON) {
      const date = `${y}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
      const diff = daysBetween(today, date);
      if (diff >= 0 && diff <= horizonDays) out.push({ key: `season:${s.key}:${y}`, title: s.title, angle: s.angle, source: 'season', date, objective: s.objective });
    }
  }
  return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

export function dataIdeas(input: { healedPhotos: number; topServices: string[]; slowDays: string[] }): ContentIdea[] {
  const out: ContentIdea[] = [];
  if (input.healedPhotos > 0) out.push({ key: `photos:healed:${input.healedPhotos}`, title: 'Show your newest healed results', angle: `${input.healedPhotos} new photo${input.healedPhotos === 1 ? '' : 's'} with marketing permission`, source: 'photos', objective: 'bookings' });
  for (const name of input.topServices.slice(0, 2)) out.push({ key: `service:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, title: `Why clients love ${name}`, angle: `Your most booked service: ${name}`, source: 'services', objective: 'bookings' });
  if (input.slowDays.length) out.push({ key: `slow:${input.slowDays[0]}`, title: 'Last-minute slot / model day', angle: `Quiet day coming up (${input.slowDays.slice(0, 3).join(', ')}): offer the slot`, source: 'slow_day', date: input.slowDays[0], objective: 'availability' });
  return out;
}

/** Free starter captions (English) used when AI is off or returns something unusable. */
export function starterCaption(post: { category: PlanCategory; title: string }, offer?: string | null): string {
  const base: Record<PlanCategory, string> = {
    results: 'Soft, natural results that still look like you. Swipe to see the details.',
    education: 'Quick answer to a question we hear every week. Save this for later.',
    behind_the_scenes: 'A peek behind the scenes: every brow is mapped by hand before we start.',
    testimonial: 'Kind words from a client this month. Thank you for trusting us.',
    offer: 'Booking is open. Message us on LINE or DM to choose your time.'
  };
  return [post.title + '.', base[post.category], offer ? `Offer: ${offer}` : '', 'DM or LINE us to book.'].filter(Boolean).join(' ').slice(0, 2200);
}

/** Parses the model's JSON array of captions; null if unusable. */
export function parseCaptionList(text: string, expected: number): string[] | null {
  const match = /\[[\s\S]*\]/.exec(text ?? '');
  if (!match) return null;
  try {
    const list = JSON.parse(match[0]);
    if (!Array.isArray(list) || list.length !== expected) return null;
    const out = list.map((item) => (typeof item === 'string' ? item : typeof item?.caption === 'string' ? item.caption : '').trim().slice(0, 2200));
    return out.every(Boolean) ? out : null;
  } catch { return null; }
}

/** Rough LINE estimate text for the approve card. */
export function lineEstimateText(recipients: number | null, quota: number | null, used: number | null): string {
  if (recipients == null) return 'Connect LINE to see how many friends this reaches.';
  const left = quota != null && used != null ? Math.max(0, quota - used) : null;
  const over = left != null && recipients > left;
  return `About ${recipients} message${recipients === 1 ? '' : 's'} (one per LINE friend).${left != null ? ` ${left} free messages left this month.` : ''}${over ? ' This is more than you have left, so LINE may refuse or charge.' : ''}`;
}
