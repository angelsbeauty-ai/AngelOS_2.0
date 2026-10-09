import { Linking, Platform, Share } from 'react-native';
import { apiFetch } from './api';

export type ContentObjective = 'reach' | 'engagement' | 'saves' | 'profile_visits' | 'inquiries' | 'bookings' | 'education' | 'trust' | 'availability';
export type ContentPlatform = 'instagram' | 'facebook' | 'tiktok' | 'line' | 'manual';
export type ContentFormat = 'reel' | 'story' | 'carousel' | 'photo';

export interface ContentVariant {
  id: string;
  platform: ContentPlatform;
  format: 'reel' | 'story' | 'carousel' | 'photo';
  hook: string | null;
  caption: string;
  cta: string | null;
  hashtags: string[];
  scheduled_for: string | null;
  status: 'draft' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived';
  live_url?: string | null;
}

export interface ContentPost {
  id: string;
  title: string;
  objective: ContentObjective;
  primary_format: 'reel' | 'story' | 'carousel' | 'photo';
  status: string;
  strategy_reason: string | null;
  source_goal: string | null;
  editing_instructions: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  media?: Array<{ id: string; position: number; role: string; asset: { id: string; original_filename: string; media_type: string; content_status: string; marketing_permission: string } }>;
  variants?: ContentVariant[];
}

export interface ContentReview {
  reviewMode?: 'ai_vision' | 'metadata_fallback';
  recommendation: null | { mediaAssetIds: string[]; format: string; reason: string };
  reason?: string;
  candidates: Array<{ id: string; filename: string; mediaType: string; score: number; role: string; clientName: string | null }>;
}

export function listContent(workspaceId: string) {
  return apiFetch<ContentPost[]>(`/workspaces/${workspaceId}/content`);
}

export function getContentPost(workspaceId: string, postId: string) {
  return apiFetch<ContentPost>(`/workspaces/${workspaceId}/content/${postId}`);
}

export function reviewContentMedia(workspaceId: string, objective: ContentObjective) {
  return apiFetch<ContentReview>(`/workspaces/${workspaceId}/content/review-media`, { method: 'POST', body: JSON.stringify({ objective }) });
}

export function createContentDraft(workspaceId: string, input: { title: string; objective: ContentObjective; goal?: string; mediaAssetIds: string[]; platforms: ContentPlatform[] }) {
  return apiFetch<ContentPost>(`/workspaces/${workspaceId}/content`, { method: 'POST', body: JSON.stringify(input) });
}

export function approveContentPost(workspaceId: string, postId: string) {
  return apiFetch<ContentPost>(`/workspaces/${workspaceId}/content/${postId}/approve`, { method: 'POST' });
}

export function updateContentVariant(workspaceId: string, variantId: string, input: Record<string, unknown>) {
  return apiFetch<ContentVariant>(`/workspaces/${workspaceId}/content/variants/${variantId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function scheduleContentVariant(workspaceId: string, variantId: string, scheduledFor: string) {
  return apiFetch<ContentVariant>(`/workspaces/${workspaceId}/content/variants/${variantId}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledFor }) });
}

export function publishContentVariant(workspaceId: string, variantId: string) {
  return apiFetch<{ variant: ContentVariant; published: boolean; duplicatePrevented: boolean }>(`/workspaces/${workspaceId}/content/variants/${variantId}/publish`, { method: 'POST' });
}

export interface ComposerDraftInput {
  title?: string;
  objective: ContentObjective;
  goal?: string;
  language: 'en' | 'ja' | 'both';
  caption: string;
  hashtags: string[];
  format: ContentFormat;
  platforms: ContentPlatform[];
  plannedFor?: string;
  mediaAssetIds?: string[];
}

/** Saves a post written in the composer (POST /content/drafts). */
export function createComposerDraft(workspaceId: string, input: ComposerDraftInput) {
  return apiFetch<ContentPost>(`/workspaces/${workspaceId}/content/drafts`, { method: 'POST', body: JSON.stringify(input) });
}

/** Calendar day for a post: its earliest planned/scheduled time, else when it was created. */
export function contentPostDate(post: ContentPost): Date | null {
  const planned = (post.variants ?? []).map((variant) => variant.scheduled_for).filter((value): value is string => Boolean(value)).sort()[0];
  const value = planned ?? post.created_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---- B0 social extras ----
export interface ContentIdea { key: string; title: string; angle: string; source: string; date?: string; objective: ContentObjective }
export interface Campaign { id: string; name: string; goal: string; starts_on: string; ends_on: string; offer: string | null; status: string; post_count: number }
export interface SocialInsights {
  days: number; connections: Record<string, boolean>; platformMetrics: null; platformMetricsNote: string;
  byPlatform: Record<string, { drafts: number; scheduled: number; posted: number }>;
  postingTimes: Array<{ slot: string; count: number }>; bestTimeDefault: string | null;
  fromSocial: { newClients: number; bySource: Record<string, number>; bookings: number };
}
export interface LineEstimate { connected: boolean; recipients: number | null; quota: number | null; used: number | null; text: string }
const ws = (id: string) => `/workspaces/${id}/content`;
export const listIdeas = (id: string) => apiFetch<{ ideas: ContentIdea[] }>(`${ws(id)}/ideas`);
export const planDays = (id: string, input: { startsOn?: string; days?: number; posts?: number } = {}) =>
  apiFetch<{ startsOn: string; endsOn: string; created: Array<{ id: string; date: string; title: string }>; note: string }>(`${ws(id)}/plan`, { method: 'POST', body: JSON.stringify(input) });
export const listCampaigns = (id: string) => apiFetch<{ campaigns: Campaign[]; needsMigration: string | null }>(`${ws(id)}/campaigns`);
export const createCampaign = (id: string, input: { name: string; goal: string; startsOn: string; endsOn: string; offer?: string }) =>
  apiFetch<Campaign>(`${ws(id)}/campaigns`, { method: 'POST', body: JSON.stringify(input) });
export const planCampaign = (id: string, campaignId: string) =>
  apiFetch<{ created: Array<{ id: string; date: string; title: string }>; lineBroadcast: { postId: string } | null; lineNote: string | null }>(`${ws(id)}/campaigns/${campaignId}/plan`, { method: 'POST' });
export const getSocialInsights = (id: string, days = 30) => apiFetch<SocialInsights>(`${ws(id)}/insights?days=${days}`);
export const getLineEstimate = (id: string) => apiFetch<LineEstimate>(`${ws(id)}/line/estimate`);
export const createLineDraft = (id: string, input: { topic?: string; sendAt?: string }) =>
  apiFetch<{ postId: string; variantId: string | null; ja: string; en: string }>(`${ws(id)}/line/drafts`, { method: 'POST', body: JSON.stringify(input) });
export const sendLineBroadcast = (id: string, variantId: string) =>
  apiFetch<{ sent: boolean; duplicatePrevented: boolean }>(`${ws(id)}/variants/${variantId}/line-broadcast`, { method: 'POST', body: JSON.stringify({ confirm: true }) });
export const markVariantPosted = (id: string, variantId: string, permalink?: string) =>
  apiFetch(`${ws(id)}/variants/${variantId}/mark-posted`, { method: 'POST', body: JSON.stringify(permalink ? { permalink } : {}) });
export interface HashtagSet { id: string; name: string; language: 'en' | 'ja' | 'both'; tags: string[] }
export const listHashtagSets = (id: string) => apiFetch<{ sets: HashtagSet[]; needsMigration: string | null }>(`${ws(id)}/hashtag-sets`);
export const saveHashtagSet = (id: string, input: { name: string; language: string; tags: string[] }) => apiFetch<HashtagSet>(`${ws(id)}/hashtag-sets`, { method: 'POST', body: JSON.stringify(input) });
export const deleteHashtagSet = (id: string, setId: string) => apiFetch(`${ws(id)}/hashtag-sets/${setId}`, { method: 'DELETE' });


const POST_URL: Record<string, { label: string; web: string; app: string }> = {
  instagram: { label: 'Instagram', web: 'https://www.instagram.com/', app: 'instagram://app' },
  facebook: { label: 'Facebook', web: 'https://www.facebook.com/', app: 'fb://' },
  tiktok: { label: 'TikTok', web: 'https://www.tiktok.com/upload', app: 'snssdk1233://' },
  line: { label: 'LINE', web: 'https://manager.line.biz/', app: 'line://' }
};
export function platformLabel(platform: string) { return POST_URL[platform.split('_')[0]]?.label ?? 'your app'; }

/** Honest manual posting: copy the caption, open the app/site. Nothing is posted by AngelOS. */
export async function copyCaptionAndOpen(text: string, platform: string): Promise<'copied' | 'shared' | 'failed'> {
  const target = POST_URL[platform.split('_')[0]];
  if (Platform.OS === 'web') {
    try {
      await (globalThis as any).navigator?.clipboard?.writeText(text);
      if (target) (globalThis as any).open?.(target.web, '_blank', 'noopener');
      return 'copied';
    } catch { return 'failed'; }
  }
  try { await Share.share({ message: text }); }
  catch { /* user closed the share sheet */ }
  if (target) await Linking.openURL(target.app).catch(() => Linking.openURL(target.web).catch(() => undefined));
  return 'shared';
}
