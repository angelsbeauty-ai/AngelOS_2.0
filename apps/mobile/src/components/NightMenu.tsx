import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

export type NightMenuItem = { label: string; onPress: () => void; destructive?: boolean };

/** Night-safe bottom menu. Use instead of ActionSheetIOS so Night mode stays dark. */
export function NightMenu({ visible, items, onClose }: { visible: boolean; items: NightMenuItem[]; onClose: () => void }) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <View style={[styles.sheet, night && { backgroundColor: '#161618', borderColor: palette.border }]}>
          {items.map((item, i) => (
            <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => { onClose(); item.onPress(); }} style={[styles.row, i > 0 && styles.line, i > 0 && night && { borderTopColor: palette.border }]}>
              <Text style={[styles.label, { color: item.destructive ? '#FF6B6B' : palette.text }]}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={[styles.row, styles.cancel, night && { borderTopColor: palette.border }]}>
            <Text style={[styles.label, { color: palette.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  sheet: { borderRadius: 20, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED' },
  row: { minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDED' },
  cancel: { borderTopWidth: 6, borderTopColor: '#F2F2F2' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 17 }
});
