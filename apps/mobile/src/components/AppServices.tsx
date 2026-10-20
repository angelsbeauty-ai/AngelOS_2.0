import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { flushOutbox, useOnline } from '../lib/offline';
import { listenForNotificationTaps, registerForPush, setUnreadBadge } from '../lib/push';
import { listMessageThreads } from '../lib/messaging';
import { getActiveWorkspace } from '../lib/workspace';

/** App-wide: send the offline outbox on reconnect, push registration, notification taps, unread badge. */
export function AppServices() {
  const online = useOnline();
  const registered = useRef(false);
  useEffect(() => listenForNotificationTaps(), []);
  useEffect(() => { if (online) void flushOutbox(); }, [online]);
  useEffect(() => {
    const sync = async () => {
      try {
        const ws = await getActiveWorkspace();
        if (!registered.current) { registered.current = true; void registerForPush(ws.id); }
        const threads = await listMessageThreads(ws.id);
        await setUnreadBadge(threads.filter((x) => x.unread && !x.muted).length);
      } catch { /* signed out or no studio */ }
    };
    void sync();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void sync(); });
    return () => sub.remove();
  }, []);
  return null;
}
