import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';

export const ROSE = '#151515';

/** Grouped settings list (final-A1 P1): small caps group title, solid rounded surface, 56pt rows. */
export function SettingsGroup({ title, badge, icon, children, highlight }: { title: string; badge?: string; icon?: ReactNode; children: ReactNode; highlight?: boolean }) {
  const { palette } = useAppearance();
  return <View style={{ gap: 8 }}>
    <View style={styles.groupHead}>{icon}<Text style={[styles.groupTitle, { color: palette.muted }, highlight && { color: palette.text }]}>{title.toUpperCase()}</Text>{badge ? <Text style={[styles.onlyYou, { color: palette.text, backgroundColor: palette.fill }]}>{badge.toUpperCase()}</Text> : null}</View>
    <View style={[styles.group, { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss }]}>{children}</View>
  </View>;
}

export function SettingsRow({ icon, title, sub, value, trailing, onPress, danger, last }: { icon?: ReactNode; title: string; sub?: string; value?: string | number | null; trailing?: ReactNode; onPress?: () => void; danger?: boolean; last?: boolean }) {
  const { palette } = useAppearance();
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && { backgroundColor: palette.fill }]}>
    {icon ? <View style={[styles.icon, { backgroundColor: palette.fill }]}>{icon}</View> : null}
    <View style={{ flex: 1, gap: 2 }}>
      <Text numberOfLines={1} style={[styles.title, { color: danger ? '#B3261E' : palette.text }]}>{title}</Text>
      {sub ? <Text numberOfLines={1} style={[styles.sub, { color: palette.muted }]}>{sub}</Text> : null}
    </View>
    {trailing}
    {value != null && value !== '' ? <Text numberOfLines={1} style={[styles.value, { color: palette.muted }]}>{value}</Text> : null}
    {onPress && !danger ? <CaretRight size={16} color={palette.muted} /> : null}
  </Pressable>;
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'rose' | 'success' | 'danger' }) {
  const c = { neutral: ['#F2F2F2', '#4F4A44'], rose: ['#151515', '#FFFFFF'], success: ['#F2F2F2', '#4F4A44'], danger: ['#F2F2F2', '#151515'] }[tone];
  return <View style={[styles.chip, { backgroundColor: c[0] }]}><Text style={[styles.chipText, { color: c[1] }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  groupTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, color: '#6B645B' },
  onlyYou: { fontFamily: tokens.font.uiBold, fontSize: 11, color: '#4F4A44', backgroundColor: '#F2F2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, overflow: 'hidden' },
  group: { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEDED' },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.10)' },
  title: { fontFamily: tokens.font.uiMedium, fontSize: 16, color: '#151515' },
  sub: { fontFamily: tokens.font.ui, fontSize: 12, color: '#6B645B' },
  value: { fontFamily: tokens.font.ui, fontSize: 14, color: '#6B645B', maxWidth: 170 },
  chip: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 12 }
});
