import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getNotificationPrefs, updateNotificationPrefs } from '../src/lib/system-health';
import { toFriendly } from '../src/lib/friendly-error';
import { dialog } from '../src/lib/dialog';

type Prefs = { messages: boolean; bookings: boolean; ai: boolean };
const DEFAULT: Prefs = { messages: true, bookings: true, ai: true };

export default function NotificationsScreen() {
  const { palette } = useAppearance();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id;
      setWorkspaceId(ws);
      const next = await getNotificationPrefs(ws);
      setPrefs({ messages: next.messages, bookings: next.bookings, ai: next.ai });
    } catch { /* keep defaults */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggle(key: keyof Prefs) {
    if (!workspaceId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await updateNotificationPrefs(workspaceId, { [key]: next[key] });
    } catch (error) {
      setPrefs(prefs);
      const friendly = toFriendly(error, { action: 'save' });
      void dialog.notify(friendly.title, friendly.message);
    }
  }

  return <Screen>
    <ScreenTitle>Notifications</ScreenTitle>
    <SupportText>Choose which alerts you want. These are saved to your studio.</SupportText>
    {(['messages', 'bookings', 'ai'] as const).map((key) => (
      <View key={key} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text }]}>{key === 'messages' ? 'New messages' : key === 'bookings' ? 'Bookings' : 'AI suggestions'}</Text>
          <SupportText>{key === 'messages' ? 'When a client messages you' : key === 'bookings' ? 'When a booking is created or changed' : 'When the assistant has something for you'}</SupportText>
        </View>
        <Switch value={prefs[key]} onValueChange={() => void toggle(key)} />
      </View>
    ))}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
