import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ui } from './ui';

/** Labelled text input used by the B1–B7 forms. */
export function Field({ label, hint, multiline, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} multiline={multiline} accessibilityLabel={label} placeholderTextColor={ui.colors.secondaryText} style={[styles.input, multiline && styles.multi, style]} />
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (id: T) => void }) {
  return <View style={styles.tabs} accessibilityRole="tablist">{options.map((o) => <Text key={o.id} accessibilityRole="tab" accessibilityState={{ selected: o.id === value }} onPress={() => onChange(o.id)} style={[styles.tab, o.id === value && styles.tabOn]}>{o.label}</Text>)}</View>;
}

/** Simple progress bar (Academy). */
export function ProgressBar({ value }: { value: number }) {
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} style={{ height: 8, borderRadius: 4, backgroundColor: ui.colors.border, overflow: 'hidden' }}><View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: 8, backgroundColor: ui.colors.gold }} /></View>;
}


export const fieldStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs, alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ui.spacing.sm, paddingVertical: ui.spacing.xs, borderBottomWidth: 1, borderBottomColor: ui.colors.border },
  grow: { flex: 1, gap: 2 },
  strong: { color: ui.colors.primaryText, fontSize: 16, fontWeight: '700' },
  big: { color: ui.colors.primaryText, fontSize: 28, fontWeight: '700' }
});

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { color: ui.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  hint: { color: ui.colors.secondaryText, fontSize: 12 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: ui.spacing.sm, fontSize: 15 },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: ui.colors.border, color: ui.colors.secondaryText, fontSize: 14, fontWeight: '600', overflow: 'hidden' },
  tabOn: { backgroundColor: ui.colors.primaryText, color: ui.colors.background, borderColor: ui.colors.primaryText }
});
