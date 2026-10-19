import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';

const KEY = 'angelos.notificationPrefs';
type Prefs = { messages: boolean; bookings: boolean; ai: boolean };
const DEFAULT: Prefs = { messages: true, bookings: true, ai: true };

export default function NotificationsScreen() {
  const { palette } = useAppearance();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) try { setPrefs({ ...DEFAULT, ...JSON.parse(raw) }); } catch { /* ignore */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  return <Screen>
    <ScreenTitle>Notifications</ScreenTitle>
    <SupportText>Choose which alerts you want. These are stored on this device.</SupportText>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
