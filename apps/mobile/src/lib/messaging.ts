import { Linking, Platform, Share } from 'react-native';
import { apiFetch } from './api';

export type MessagingPlatform = 'line' | 'instagram' | 'facebook' | 'tiktok' | 'other' | 'manual';

export interface MessagingChannel {
  id: string;
  provider: 'instagram' | 'facebook' | 'line' | 'tiktok' | 'manual';
  display_name: string;
  status: string;
  capabilities: Record<string, unknown>;
}

export interface MessageThreadSummary {
  id: string;
  contact_display_name: string | null;
  status: string;
  intent: string;
  priority: 'urgent' | 'today' | 'later';
  needs_owner: boolean;
  last_message_at: string | null;
  channel: MessagingChannel | null;
  client: { id: string; display_name: string; language: string; do_not_auto_message: boolean } | null;
  platform: MessagingPlatform;
  platform_label: string;
  delivery: 'live' | 'manual';
  last_preview: string | null;
  last_direction: 'inbound' | 'outbound' | null;
  unread: boolean;
  archived: boolean;
  needs_reply: boolean;
}

export interface ClientMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'client' | 'owner' | 'ai' | 'system';
  body: string;
  translated_body: string | null;
  original_language: string | null;
  status: string;
  sensitive: boolean;
  metadata: Record<string, any>;
  created_at: string;
  sent_at: string | null;
}

export interface MessageThreadDetail {
  thread: MessageThreadSummary & { external_thread_id: string; reply_language: 'en' | 'ja' };
  messages: ClientMessage[];
  internalNotes: Array<{ id: string; content: string; created_at: string }>;
}

export interface SavedReply {
  id: string;
  title: string;
  category: string;
  body_en: string | null;
  body_ja: string | null;
  status?: 'approved' | 'suggested' | 'rejected';
  source?: string;
  occurrences?: number;
}

export interface ConnectionStatus {
  provider: 'line' | 'instagram' | 'facebook' | 'manual';
  label: string;
  state: 'connected' | 'ready_to_connect' | 'not_connected' | 'needs_meta_approval';
  connected: boolean;
  canConnect: boolean;
  accountName: string | null;
  detail: string;
  needs: string[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/messaging`;

export const listMessageThreads = (workspaceId: string, view: 'active' | 'archived' = 'active') =>
  apiFetch<MessageThreadSummary[]>(`${base(workspaceId)}/threads?view=${view}`);
export const getMessageThread = (workspaceId: string, threadId: string) =>
  apiFetch<MessageThreadDetail>(`${base(workspaceId)}/threads/${threadId}`);
export const markThreadRead = (workspaceId: string, threadId: string) =>
  apiFetch<{ read: boolean }>(`${base(workspaceId)}/threads/${threadId}/read`, { method: 'POST' });
export const startConversation = (workspaceId: string, input: { clientId: string; platform: 'line' | 'instagram' | 'facebook' | 'other'; body: string }) =>
  apiFetch<{ threadId: string }>(`${base(workspaceId)}/conversations`, { method: 'POST', body: JSON.stringify(input) });
export const addInboundMessage = (workspaceId: string, threadId: string, body: string) =>
  apiFetch<{ threadId: string }>(`${base(workspaceId)}/threads/${threadId}/inbound`, { method: 'POST', body: JSON.stringify({ body }) });
export const createAiReplyDraft = (workspaceId: string, threadId: string) =>
  apiFetch<{ message: ClientMessage; requiresApproval: boolean; reason: string; language: 'en' | 'ja' }>(`${base(workspaceId)}/threads/${threadId}/ai-draft`, { method: 'POST' });
export const createMessageReply = (workspaceId: string, threadId: string, body: string, approveNow = false) =>
  apiFetch<{ message: ClientMessage; sent: boolean; delivery?: 'manual' | 'sent' }>(`${base(workspaceId)}/threads/${threadId}/replies`, { method: 'POST', body: JSON.stringify({ body, sendNow: approveNow }) });
export const approveReply = (workspaceId: string, messageId: string, editedBody?: string) =>
  apiFetch<{ message: ClientMessage; sent: boolean; delivery: 'manual' | 'sent' }>(`${base(workspaceId)}/messages/${messageId}/approve-send`, { method: 'POST', body: JSON.stringify(editedBody !== undefined ? { body: editedBody } : {}) });
export const markReplySent = (workspaceId: string, messageId: string) =>
  apiFetch<{ message: ClientMessage }>(`${base(workspaceId)}/messages/${messageId}/mark-sent`, { method: 'POST' });
export const translateClientMessage = (workspaceId: string, messageId: string, targetLanguage: 'en' | 'ja' = 'en') =>
  apiFetch<ClientMessage>(`${base(workspaceId)}/messages/${messageId}/translate`, { method: 'POST', body: JSON.stringify({ targetLanguage }) });
export const addThreadInternalNote = (workspaceId: string, threadId: string, content: string) =>
  apiFetch(`${base(workspaceId)}/threads/${threadId}/internal-notes`, { method: 'POST', body: JSON.stringify({ content }) });
export const updateThread = (workspaceId: string, threadId: string, patch: { status?: string; archived?: boolean; unread?: boolean }) =>
  apiFetch(`${base(workspaceId)}/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const listSavedReplies = (workspaceId: string) =>
  apiFetch<{ replies: SavedReply[]; needsMigration: string | null }>(`${base(workspaceId)}/saved-replies`);
export const addStarterSavedReplies = (workspaceId: string) =>
  apiFetch<{ replies: SavedReply[] }>(`${base(workspaceId)}/saved-replies/starters`, { method: 'POST' });
export const createSavedReply = (workspaceId: string, input: { title: string; category?: string; bodyEn?: string; bodyJa?: string }) =>
  apiFetch<SavedReply>(`${base(workspaceId)}/saved-replies`, { method: 'POST', body: JSON.stringify(input) });
export const updateSavedReply = (workspaceId: string, id: string, input: { title?: string; category?: string; bodyEn?: string; bodyJa?: string }) =>
  apiFetch<SavedReply>(`${base(workspaceId)}/saved-replies/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteSavedReply = (workspaceId: string, id: string) =>
  apiFetch(`${base(workspaceId)}/saved-replies/${id}`, { method: 'DELETE' });

export const listConnections = (workspaceId: string) => apiFetch<ConnectionStatus[]>(`${base(workspaceId)}/connections`);
export const connectLine = (workspaceId: string) => apiFetch(`${base(workspaceId)}/connections/line`, { method: 'POST' });

export const PLATFORM_OPEN_URL: Record<string, string> = {
  line: 'https://line.me/R/',
  instagram: 'https://www.instagram.com/direct/inbox/',
  facebook: 'https://www.messenger.com/',
  other: ''
};

/**
 * "Copy & open LINE": web copies to the clipboard and opens the app's site;
 * phone opens the share sheet (pick LINE / Instagram / Messenger there). No native module needed.
 */
export async function copyAndOpen(text: string, platform: string): Promise<'copied' | 'shared' | 'failed'> {
  if (Platform.OS === 'web') {
    try {
      await (globalThis as any).navigator?.clipboard?.writeText(text);
      const url = PLATFORM_OPEN_URL[platform];
      if (url) (globalThis as any).open?.(url, '_blank', 'noopener');
      return 'copied';
    } catch { return 'failed'; }
  }
  try { await Share.share({ message: text }); return 'shared'; }
  catch {
    const url = PLATFORM_OPEN_URL[platform];
    if (url) await Linking.openURL(url).catch(() => undefined);
    return 'failed';
  }
}

export function fillName(template: string, name: string) {
  return template.replace(/\{name\}/g, name);
}

export function timeLabel(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffDays = (now.getTime() - date.getTime()) / 86400000;
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const translateText = (workspaceId: string, text: string, targetLanguage: 'en' | 'ja' = 'en') =>
  apiFetch<{ translation: string }>(`${base(workspaceId)}/translate`, { method: 'POST', body: JSON.stringify({ text, targetLanguage }) });

export function isJapanese(text: string) {
  return (text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length >= 2;
}
