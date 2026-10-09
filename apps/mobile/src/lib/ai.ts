import { apiFetch } from './api';

export type AssistantRoleKey =
  | 'personal_assistant'
  | 'social_media_marketer'
  | 'content_creator'
  | 'business_manager'
  | 'business_advisor'
  | 'consultant';

export interface AssistantProfile {
  workspace_id: string;
  display_name: string;
  avatar_key: string | null;
  personality_prompt: string;
  primary_language: string;
  tone: 'warm_professional' | 'direct' | 'calm' | 'friendly' | 'custom';
  response_length: 'concise' | 'balanced' | 'detailed';
  proactivity: 'low' | 'balanced' | 'high';
  floating_button_mode: 'on' | 'compact' | 'off';
  guidance_questions_enabled: boolean;
  explain_recommendations: boolean;
}

export interface AssistantRole {
  role_key: AssistantRoleKey;
  enabled: boolean;
}

export interface AiMessage {
  id: string;
  author_type: 'user' | 'assistant' | 'system_action';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiActionProposal {
  id: string;
  action_key: string;
  risk_level: 'low' | 'medium' | 'high';
  status: string;
  summary?: string;
  kind?: 'draft' | 'change';
  requiresApproval?: boolean;
  input: Record<string, unknown>;
}

export async function getAssistantProfile(workspaceId: string) {
  return apiFetch<{ profile: AssistantProfile; roles: AssistantRole[] }>(
    `/workspaces/${workspaceId}/ai/profile`
  );
}

export async function updateAssistantProfile(workspaceId: string, updates: Record<string, unknown>) {
  return apiFetch<AssistantProfile>(`/workspaces/${workspaceId}/ai/profile`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function updateAssistantRoles(
  workspaceId: string,
  roles: Partial<Record<AssistantRoleKey, boolean>>
) {
  return apiFetch<{ profile: AssistantProfile; roles: AssistantRole[] }>(
    `/workspaces/${workspaceId}/ai/roles`,
    { method: 'PUT', body: JSON.stringify({ roles }) }
  );
}

export interface AiScreenContext {
  screen?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
}

export async function createConversation(workspaceId: string, context?: AiScreenContext) {
  return apiFetch<{ id: string }>(`/workspaces/${workspaceId}/ai/conversations`, {
    method: 'POST',
    body: JSON.stringify({
      title: context?.entityLabel ? `Assistant · ${context.entityLabel}` : 'Assistant',
      currentScreen: context?.screen ?? 'ai',
      currentEntityType: context?.entityType,
      currentEntityId: context?.entityId
    })
  });
}

export async function sendAiMessage(workspaceId: string, conversationId: string, message: string, context?: AiScreenContext) {
  return apiFetch<{ message: AiMessage; action: AiActionProposal | null }>(
    `/workspaces/${workspaceId}/ai/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ message, context: context ?? { screen: 'ai' } })
    }
  );
}

export async function approveAiAction(workspaceId: string, actionId: string) {
  return apiFetch<{ result?: Record<string, any> }>(`/workspaces/${workspaceId}/ai/actions/${actionId}/approve`, { method: 'POST' });
}

export async function cancelAiAction(workspaceId: string, actionId: string) {
  return apiFetch(`/workspaces/${workspaceId}/ai/actions/${actionId}/cancel`, { method: 'POST' });
}

export interface LearnedStyle {
  sampleCount: number;
  languageMix: { en: number; ja: number };
  avgLength: { en: number | null; ja: number | null };
  lengthBand: 'short' | 'medium' | 'long';
  emojiPerReply: number;
  topEmojis: string[];
  greetings: string[];
  closings: string[];
  formality: 'casual' | 'polite' | 'formal';
  usesClientName: boolean;
}

export interface ReplyStyle {
  learn_from_replies: boolean;
  reply_tone: 'casual_friendly' | 'warm_polite' | 'professional' | 'playful';
  emoji_level: 'none' | 'light' | 'lots';
  reply_length: 'short' | 'medium' | 'detailed';
  style_notes: string;
  learned: Partial<LearnedStyle>;
  sample_count: number;
  learned_at: string | null;
}

export const getReplyStyle = (workspaceId: string) =>
  apiFetch<{ style: ReplyStyle; needsMigration: string | null }>(`/workspaces/${workspaceId}/ai/style`);
export const updateReplyStyle = (workspaceId: string, patch: Record<string, unknown>) =>
  apiFetch<ReplyStyle>(`/workspaces/${workspaceId}/ai/style`, { method: 'PATCH', body: JSON.stringify(patch) });
export const learnReplyStyleNow = (workspaceId: string) =>
  apiFetch<{ learned: LearnedStyle; newSuggestions: number }>(`/workspaces/${workspaceId}/ai/style/learn`, { method: 'POST' });
export const listSuggestedReplies = (workspaceId: string) =>
  apiFetch<{ replies: import('./messaging').SavedReply[]; needsMigration: string | null }>(`/workspaces/${workspaceId}/ai/style/suggested-replies`);
export const approveSuggestedReply = (workspaceId: string, id: string, edits?: { title?: string; bodyEn?: string; bodyJa?: string }) =>
  apiFetch(`/workspaces/${workspaceId}/ai/style/suggested-replies/${id}/approve`, { method: 'POST', body: JSON.stringify(edits ?? {}) });
export const rejectSuggestedReply = (workspaceId: string, id: string) =>
  apiFetch(`/workspaces/${workspaceId}/ai/style/suggested-replies/${id}/reject`, { method: 'POST' });

/** AngelOS brain: short summaries, tags and counts only (never message text or voice). */
export interface BrainSummary { kind: 'owner_request' | 'owner_preference' | 'client_request'; topic: string; summary: string; tags: string[]; request_count: number; first_seen_at: string; last_seen_at: string }
export const getBrainSummaries = (workspaceId: string) =>
  apiFetch<{ summaries: BrainSummary[]; needsMigration: string | null }>(`/workspaces/${workspaceId}/ai/brain`);

// C1 tools registry + live voice (ephemeral session minted by the server; nothing recorded or stored).
export interface AiTool { key: string; kind: 'read' | 'draft' | 'change'; risk: 'low' | 'medium' | 'high'; label: string; example: string; touchesClients: boolean }
export const listAiTools = (workspaceId: string) => apiFetch<{ tools: AiTool[] }>(`/workspaces/${workspaceId}/ai/tools`);
export interface VoiceSession { available: boolean; mode: 'live' | 'mock'; reason: string | null; clientSecret: string | null; expiresAt: number | null; model: string | null; stored: false }
export const getVoiceStatus = (workspaceId: string) => apiFetch<Omit<VoiceSession, 'clientSecret' | 'expiresAt' | 'model'>>(`/workspaces/${workspaceId}/ai/voice/status`);
export const createVoiceSession = (workspaceId: string, screen?: string) => apiFetch<VoiceSession>(`/workspaces/${workspaceId}/ai/voice/session`, { method: 'POST', body: JSON.stringify({ screen }) });
