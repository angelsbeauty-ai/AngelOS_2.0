import { apiFetch } from './api';

export interface Suggestion {
  key: string;
  kind: 'create_post_draft' | 'draft_reply' | 'client_message' | 'post_now';
  title: string;
  detail: string;
  preview?: string | null;
  input: Record<string, string>;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/ai/suggestions`;
export const listSuggestions = (workspaceId: string) => apiFetch<{ suggestions: Suggestion[]; dismissRemembered: boolean }>(base(workspaceId));
export const approveSuggestion = (workspaceId: string, key: string) =>
  apiFetch<{ kind: string; threadId?: string; messageId?: string; contentPostId?: string; duplicatePrevented: boolean }>(`${base(workspaceId)}/${encodeURIComponent(key)}/approve`, { method: 'POST' });
export const dismissSuggestion = (workspaceId: string, key: string) =>
  apiFetch<{ dismissed: boolean; remembered: boolean }>(`${base(workspaceId)}/${encodeURIComponent(key)}/dismiss`, { method: 'POST' });
