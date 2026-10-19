import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getHomeSummary } from '../src/lib/home';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';

export default function TasksScreen() {
  const { palette } = useAppearance();
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await getActiveWorkspace();
      const sum = await getHomeSummary(ws.id, 'day');
      const list: string[] = [];
      if (sum.messages?.needsReply) list.push(`${sum.messages.needsReply} message${sum.messages.needsReply === 1 ? '' : 's'} need a reply`);
      if (sum.important?.tasks) list.push(`${sum.important.tasks} task${sum.important.tasks === 1 ? '' : 's'}`);
      if (sum.schedule?.touchUpsDue) list.push(`${sum.schedule.touchUpsDue} touch-up${sum.schedule.touchUpsDue === 1 ? '' : 's'} due`);
      setItems(list);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen onRefresh={load}>
    <ScreenTitle>Tasks</ScreenTitle>
    <SupportText>Things that need your attention in this business.</SupportText>
    {loading ? <SupportText>Loading…</SupportText> : items.length === 0 ? <SupportText>Nothing waiting right now.</SupportText> : items.map((item, i) => (
      <View key={i} style={[styles.row, { borderColor: palette.border }]}>
        <Text style={[styles.item, { color: palette.text }]}>{item}</Text>
      </View>
    ))}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { fontFamily: tokens.font.ui, fontSize: 16 }
});
