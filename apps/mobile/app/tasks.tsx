import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText, Button } from '../src/components/ui';
import { getActiveWorkspace } from '../src/lib/workspace';
import { addTask, deleteTask, listTasks, updateTask, type Task } from '../src/lib/tasks';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';

export default function TasksScreen() {
  const { palette } = useAppearance();
  const [ws, setWs] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const w = await getActiveWorkspace();
      setWs(w.id);
      setTasks(await listTasks(w.id));
    } catch { setTasks([]); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function add() {
    if (!ws || !title.trim()) return;
    await addTask(ws, title);
    setTitle('');
    setTasks(await listTasks(ws));
  }

  async function toggle(id: string, done: boolean) {
    if (!ws) return;
    await updateTask(ws, id, { done });
    setTasks(await listTasks(ws));
  }

  async function remove(id: string) {
    if (!ws) return;
    await deleteTask(ws, id);
    setTasks(await listTasks(ws));
  }

  return <Screen onRefresh={load}>
    <ScreenTitle>Tasks</ScreenTitle>
    <SupportText>Follow-ups and things to do for this business.</SupportText>

    <View style={styles.addRow}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Add a task" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.border }]} onSubmitEditing={() => void add()} />
      <Button label="Add" onPress={() => void add()} disabled={!title.trim()} />
    </View>

    {loading ? <SupportText>Loading…</SupportText> : tasks.length === 0 ? <SupportText>No tasks yet. Add one above.</SupportText> : tasks.map((t) => (
      <View key={t.id} style={[styles.row, { borderColor: palette.border }]}>
        <Pressable onPress={() => void toggle(t.id, !t.done)} style={[styles.check, t.done && styles.checkOn]}>
          {t.done ? <Text style={styles.checkMark}>✓</Text> : null}
        </Pressable>
        <Text style={[styles.item, { color: palette.text }, t.done && styles.done]}>{t.title}</Text>
        <Pressable onPress={() => void remove(t.id)} hitSlop={8}><Text style={[styles.del, { color: palette.muted }]}>Delete</Text></Pressable>
      </View>
    ))}
  </Screen>;
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontFamily: tokens.font.ui, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#151515', borderColor: '#151515' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  item: { flex: 1, fontFamily: tokens.font.ui, fontSize: 16 },
  done: { textDecorationLine: 'line-through', opacity: 0.5 },
  del: { fontFamily: tokens.font.ui, fontSize: 14 }
});
