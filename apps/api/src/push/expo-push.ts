import { Logger } from '@nestjs/common';
import { createServiceSupabaseClient } from '../config/supabase';

/**
 * M48 server push: a new client message → Expo push API (https://exp.host/--/api/v2/push/send)
 * to every phone in push_tokens for that studio. Respects the thread mute (muted_until) and the
 * studio's "New messages" switch (notification_prefs.messages). Never throws into the webhook.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const log = new Logger('ExpoPush');

export interface PushMessage { to: string; title: string; body: string; sound: 'default'; data: Record<string, string>; channelId?: string; badge?: number }

export function buildMessagePush(tokens: { token: string; platform: string }[], input: { threadId: string; title: string; body: string; badge?: number }): PushMessage[] {
  const body = input.body.length > 120 ? `${input.body.slice(0, 117)}…` : input.body;
  return tokens.filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t.token)).map((t) => ({
    to: t.token, title: input.title, body, sound: 'default', data: { threadId: input.threadId },
    ...(t.platform === 'android' ? { channelId: 'messages' } : {}), ...(input.badge != null ? { badge: input.badge } : {})
  }));
}

export function isMuted(mutedUntil: string | null | undefined, now = Date.now()) { return Boolean(mutedUntil && Date.parse(mutedUntil) > now); }

export async function sendExpoPush(messages: PushMessage[], fetchImpl: typeof fetch = fetch): Promise<{ sent: number; invalid: string[] }> {
  if (!messages.length) return { sent: 0, invalid: [] };
  const invalid: string[] = []; let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(chunk) });
    if (!res.ok) { log.warn(`Expo push answered ${res.status}`); continue; }
    const json: any = await res.json().catch(() => ({}));
    (json?.data ?? []).forEach((ticket: any, k: number) => {
      if (ticket?.status === 'ok') sent += 1;
      else if (ticket?.details?.error === 'DeviceNotRegistered') invalid.push(chunk[k].to);
    });
  }
  return { sent, invalid };
}

/** Fire-and-forget from the webhook path. */
export async function notifyNewClientMessage(workspaceId: string, threadId: string, sender: string, text: string): Promise<void> {
  try {
    const db = createServiceSupabaseClient();
    const [{ data: thread }, { data: prefs }, { data: tokens }, unread] = await Promise.all([
      db.from('message_threads').select('muted_until').eq('workspace_id', workspaceId).eq('id', threadId).maybeSingle(),
      db.from('notification_prefs').select('messages').eq('workspace_id', workspaceId).maybeSingle(),
      db.from('push_tokens').select('token,platform').eq('workspace_id', workspaceId),
      db.from('message_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('owner_unread', true).is('archived_at', null)
    ]);
    if (isMuted((thread as any)?.muted_until)) return;
    if (prefs && (prefs as any).messages === false) return;
    const msgs = buildMessagePush((tokens ?? []) as any, { threadId, title: sender, body: text || '📷', badge: unread.count ?? undefined });
    const { invalid } = await sendExpoPush(msgs);
    if (invalid.length) await db.from('push_tokens').delete().in('token', invalid);
  } catch (e) { log.warn(`Push not sent: ${e instanceof Error ? e.message : 'unknown'}`); }
}
