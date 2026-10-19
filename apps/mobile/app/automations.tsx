import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';

const KEY = 'angelos.automationStopped';

export default function AutomationsScreen() {
  const { palette } = useAppearance();
  const [stopped, setStopped] = useState(false);

  const load = useCallback(async () => {
    const v = await AsyncStorage.getItem(KEY);
    setStopped(v === '1');
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggle() {
    const next = !stopped;
    setStopped(next);
    await AsyncStorage.setItem(KEY, next ? '1' : '0');
  }

  return <Screen>
    <ScreenTitle>Automations</ScreenTitle>
    <SupportText>When stopped, AngelOS will not start new automated actions. Existing work is not cancelled.</SupportText>
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: palette.text }]}>Emergency stop</Text>
        <SupportText>{stopped ? 'Stopped. No new automation will run.' : 'Running. Automation can start new work.'}</SupportText>
      </View>
      <Switch value={stopped} onValueChange={() => void toggle()} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
