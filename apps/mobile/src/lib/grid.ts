import type { ContentPost, ContentVariant } from './content';

export type GridTab = 'grid' | 'reels' | 'stories';
export type GridFilter = 'published' | 'scheduled' | 'drafts' | 'archive';

const isIg = (v: ContentVariant) => v.platform === 'instagram' || v.platform.startsWith('instagram_');
export const igVariant = (p: ContentPost) => (p.variants ?? []).find(isIg) ?? null;

/** Real content statuses behind each filter (default Published, like Meta Business Suite). */
const STATUSES: Record<GridFilter, string[]> = {
  published: ['published', 'analyzed'],
  scheduled: ['approved', 'scheduled', 'publishing'],
  drafts: ['draft', 'prepared'],
  archive: ['archived']
};

function formatOf(p: ContentPost, v: ContentVariant | null): string { return v?.format ?? p.primary_format ?? 'photo'; }
export function tabOf(p: ContentPost): GridTab { const f = formatOf(p, igVariant(p)); return f === 'reel' ? 'reels' : f === 'story' ? 'stories' : 'grid'; }

export function stateOf(p: ContentPost): string { return p.status === 'archived' ? 'archived' : igVariant(p)?.status ?? p.status; }
export const isScheduled = (p: ContentPost) => ['approved', 'scheduled', 'publishing'].includes(stateOf(p)) && Boolean(igVariant(p)?.scheduled_for);

/** Date shown/sorted: when it goes out (scheduled) or went out (published), else last edit. */
export function gridDate(p: ContentPost): Date | null {
  const v = igVariant(p) as (ContentVariant & { published_at?: string | null }) | null;
  const raw = v?.published_at ?? v?.scheduled_for ?? p.updated_at ?? p.created_at;
  if (!raw) return null; const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d;
}

export function isCarousel(p: ContentPost) { return formatOf(p, igVariant(p)) === 'carousel' || (p.media ?? []).length > 1; }
export function isVideo(p: ContentPost) { return formatOf(p, igVariant(p)) === 'reel' || (p.media ?? []).some((m) => m.asset?.media_type === 'video'); }

/** Instagram posts for a tab + filter, newest first (latest scheduled at the top, like the profile will look). */
export function gridPosts(all: ContentPost[], tab: GridTab, filter: GridFilter): ContentPost[] {
  const want = STATUSES[filter];
  return all.filter((p) => igVariant(p) && tabOf(p) === tab && want.includes(stateOf(p)))
    .sort((a, b) => (gridDate(b)?.getTime() ?? 0) - (gridDate(a)?.getTime() ?? 0));
}
