import { ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ui } from './ui';
import { useAppearance } from '../design/appearance';

function useFieldInk() {
  const { mode } = useAppearance();
  const night = mode === 'night';
  return {
    night,
    text: night ? '#F4F4F5' : '#151515',
    secondary: night ? '#C7C7CC' : '#6B645B',
    muted: night ? '#9A9A9F' : '#6B645B',
    card: night ? '#161618' : '#FFFFFF',
    border: night ? 'rgba(255,255,255,0.14)' : ui.colors.border,
    on: night ? '#F4F4F5' : '#151515',
    onText: night ? '#151515' : '#FFFFFF',
    chipText: night ? '#E5E5E7' : '#4F4A44'
  };
}

/** Labelled text input used by the B1–B7 forms. */
export function Field({ label, hint, multiline, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  const ink = useFieldInk();
  return <View style={styles.wrap}>
    <Text style={[styles.label, { color: ink.secondary }]}>{label}</Text>
    <TextInput {...props} multiline={multiline} accessibilityLabel={label} placeholderTextColor={ink.muted} style={[styles.input, { color: ink.text, backgroundColor: ink.card, borderColor: ink.border, minHeight: multiline ? 80 : 48 }, multiline && styles.multi, style]} />
    {hint ? <Text style={[styles.hint, { color: ink.muted }]}>{hint}</Text> : null}
  </View>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (id: T) => void }) {
  const ink = useFieldInk();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs} accessibilityRole="tablist">{options.map((o) => {
    const on = o.id === value;
    return <Text key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)} style={[styles.tab, { color: ink.chipText, backgroundColor: ink.card, borderColor: ink.border }, on && { backgroundColor: ink.on, borderColor: ink.on, color: ink.onText }]}>{o.label}</Text>;
  })}</ScrollView>;
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
  tabsWrap: { flexGrow: 0, marginHorizontal: -4 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: ui.colors.border, color: ui.colors.secondaryText, fontSize: 14, fontWeight: '600', overflow: 'hidden' },
  tabOn: { backgroundColor: ui.colors.primaryText, color: ui.colors.background, borderColor: ui.colors.primaryText }
});
