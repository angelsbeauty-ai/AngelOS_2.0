import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMessageReply } from './messaging';

/**
 * M44 offline: replies Angel already approved (Send tap + confirm) wait here while the phone is
 * offline and go out once it reconnects. Nothing is invented or auto-written; only her own text.
 */
export interface QueuedReply { key: string; workspaceId: string; threadId: string; body: string; replyToMessageId?: string; queuedAt: string }
const KEY = 'angelos.outbox.v1';
const listeners = new Set<(q: QueuedReply[]) => void>();

export async function readOutbox(): Promise<QueuedReply[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { return []; }
}
async function write(q: QueuedReply[]) { await AsyncStorage.setItem(KEY, JSON.stringify(q)); listeners.forEach((l) => l(q)); }

export async function enqueueReply(item: Omit<QueuedReply, 'key' | 'queuedAt'>) {
  const q = await readOutbox();
  q.push({ ...item, key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() });
  await write(q);
}

let flushing = false;
/** Sends queued replies in order. Stops at the first failure so order is kept; returns how many went. */
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0; flushing = true;
  let sent = 0;
  try {
    let q = await readOutbox();
    while (q.length) {
      const [head] = q;
      try { await createMessageReply(head.workspaceId, head.threadId, head.body, true, head.replyToMessageId ? { replyToMessageId: head.replyToMessageId } : undefined); }
      catch { break; }
      q = q.slice(1); await write(q); sent += 1;
    }
  } finally { flushing = false; }
  return sent;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)), []);
  return online;
}

export function useOutbox(threadId?: string): QueuedReply[] {
  const [q, setQ] = useState<QueuedReply[]>([]);
  useEffect(() => { void readOutbox().then(setQ); listeners.add(setQ); return () => { listeners.delete(setQ); }; }, []);
  return threadId ? q.filter((x) => x.threadId === threadId) : q;
}

export async function isOnlineNow(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return s.isConnected !== false && s.isInternetReachable !== false;
}
