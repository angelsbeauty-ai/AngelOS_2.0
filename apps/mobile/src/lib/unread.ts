import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { listMessageThreads } from './messaging';
import { getActiveWorkspace } from './workspace';

/** Real unread conversation count for the Messages tab badge (refreshes on navigation). */
export function useUnreadCount() {
  const [n, setN] = useState(0);
  const path = usePathname();
  useEffect(() => {
    let live = true;
    getActiveWorkspace().then((w) => listMessageThreads(w.id, 'active'))
      .then((rows) => { if (live) setN(rows.filter((r) => r.unread && !(r.channel?.provider === 'manual' || (r.channel?.capabilities as any)?.demo === true)).length); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [path]);
  return n;
}
