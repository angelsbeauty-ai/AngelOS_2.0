import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { getActiveWorkspace, listWorkspaces, setActiveWorkspace, type WorkspaceSummary } from '../lib/workspace';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

export function BusinessSwitcher({ onChanged }: { onChanged?: () => void }) {
  const { palette } = useAppearance();
  const [current, setCurrent] = useState<WorkspaceSummary | null>(null);
  const [all, setAll] = useState<WorkspaceSummary[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const list = await listWorkspaces().catch(() => []);
    setAll(list);
    const active = await getActiveWorkspace().catch(() => list[0] ?? null);
    setCurrent(active);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!current) return null;

  async function choose(id: string) {
    await setActiveWorkspace(id);
    setOpen(false);
    onChanged?.();
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Switch business" onPress={() => setOpen(true)} style={[styles.btn, { backgroundColor: palette.glass, borderColor: palette.border }]}>
      <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{current.name}</Text>
      <CaretDown size={14} color={palette.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: palette.bg }]}>
          <Text style={[styles.title, { color: palette.text }]}>Switch business</Text>
          {all.map((w) => (
            <Pressable key={w.id} accessibilityRole="button" onPress={() => void choose(w.id)} style={[styles.option, w.id === current.id && styles.optionOn]}>
              <Text style={[styles.optionText, { color: palette.text }, w.id === current.id && { color: '#FFFFFF' }]}>{w.name}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => { setOpen(false); router.push('/workspaces/new' as any); }} style={styles.option}>
            <Text style={[styles.optionText, { color: palette.text }]}>+ New business</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 15, maxWidth: 180 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { gap: 8, padding: 20, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 17, textAlign: 'center', marginBottom: 4 },
  option: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.12)' },
  optionOn: { backgroundColor: '#151515', borderColor: '#151515' },
  optionText: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
