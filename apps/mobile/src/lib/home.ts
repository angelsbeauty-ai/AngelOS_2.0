import { apiFetch } from './api';

export type Period = 'day' | 'week' | 'month';
export interface HomeSummary {
  period: Period; range: { start: string; end: string }; generatedAt: string; unavailable: string[];
  schedule: { total: number; pending: number; cancelled: number; completed: number; newClients: number; returningClients: number; touchUpsDue: number;
    next: { id: string; start_at: string; end_at: string; service: string | null; client: string | null; status: string } | null;
    items: Array<{ id: string; start_at: string; end_at: string; service: string | null; client: string | null; status: string; returning: boolean | null }> };
  messages: { total: number; unread: number; needsReply: number; important: number; booking: { inProgress: number; reschedule: number; inquiries: number };
    alerts: Array<{ id: string; name: string; platform: string; at: string | null; unread: boolean; needsReply: boolean; important: boolean; preview: string | null }> };
  social: { connected: string[]; followers: number | null; engagement: number | null; reach: number | null; followersChange7d: number | null; postsInPeriod: number;
    recentPosts: Array<{ title: string; platform: string; published_at: string | null }>; platforms: Array<{ platform: string; followers: number | null; engagement: number | null; reach: number | null }> };
  important?: { scheduledPosts: number | null; tasks: number; approvals: number };
  assistant: { suggestions: Array<{ key: string; title: string; reason?: string | null }>; pendingApprovals: number };
}
export interface Briefing { text: string; source: 'ai' | 'facts'; at: string; facts: string[]; cached: boolean }
export interface AiUsage { today: number; month: number; dailyLimit: number; monthlyLimit: number; limited: boolean; reason: 'daily' | 'monthly' | null; message: string | null; unavailable?: boolean }

export const getHomeSummary = (ws: string, period: Period = 'day') => apiFetch<HomeSummary>(`/workspaces/${ws}/home/summary?period=${period}`);
export const getBriefing = (ws: string) => apiFetch<Briefing>(`/workspaces/${ws}/home/briefing`);
export const getAiUsage = (ws: string) => apiFetch<AiUsage>(`/workspaces/${ws}/ai/usage`);
