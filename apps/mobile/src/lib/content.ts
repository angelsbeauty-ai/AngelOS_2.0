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
