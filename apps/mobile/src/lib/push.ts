import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { savePushToken } from './messaging';

/**
 * M48 push, client side: permission, Expo push token to the server, foreground display,
 * app-icon badge = unread chats, and a tap opens that chat (data.threadId).
 * No APNs credentials are touched here; delivery needs them configured in EAS by Angel.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true })
});

export async function registerForPush(workspaceId: string): Promise<'saved' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('messages', { name: 'Messages', importance: Notifications.AndroidImportance.HIGH });
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await savePushToken(workspaceId, token, Platform.OS === 'ios' ? 'ios' : 'android');
    return 'saved';
  } catch { return 'unavailable'; }
}

export async function setUnreadBadge(count: number) {
  if (Platform.OS === 'web') return;
  try { await Notifications.setBadgeCountAsync(Math.max(0, count)); } catch { /* badge is best effort */ }
}

function openFrom(response: Notifications.NotificationResponse | null) {
  const id = response?.notification.request.content.data?.threadId;
  if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) router.push(`/messages/${id}` as any);
}

/** Call once at app start: handles a tap that launched the app and taps while it runs. */
export function listenForNotificationTaps(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  void Notifications.getLastNotificationResponseAsync().then(openFrom).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener(openFrom);
  return () => sub.remove();
}
