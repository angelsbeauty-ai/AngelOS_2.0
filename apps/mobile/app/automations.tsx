import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../design/theme';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getSystemHealth, updateOperationalControls } from '../src/lib/system-health';
import { toFriendly } from '../src/lib/friendly-error';
import { dialog } from '../src/lib/dialog';

export default function AutomationsScreen() {
  const { palette } = useAppearance();
  const [stopped, setStopped] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id;
      setWorkspaceId(ws);
      const health = await getSystemHealth(ws);
      setStopped(Boolean(health.controls?.pause_automations));
    } catch { /* keep current */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggle() {
    if (!workspaceId) return;
    const next = !stopped;
    setStopped(next);
    try {
      await updateOperationalControls(workspaceId, { pauseAutomations: next });
    } catch (error) {
      setStopped(!next);
      const friendly = toFriendly(error, { action: 'save' });
      void dialog.notify(friendly.title, friendly.message);
    }
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
