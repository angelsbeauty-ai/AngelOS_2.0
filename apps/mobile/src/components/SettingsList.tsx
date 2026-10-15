import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { tokens, webGlass } from '../design/theme';

export const ROSE = '#8C5547';

/** Grouped settings list (final-A1 P1): small caps group title, solid rounded surface, 56pt rows. */
export function SettingsGroup({ title, badge, icon, children, highlight }: { title: string; badge?: string; icon?: ReactNode; children: ReactNode; highlight?: boolean }) {
  return <View style={{ gap: 8 }}>
    <View style={styles.groupHead}>{icon}<Text style={[styles.groupTitle, highlight && { color: ROSE }]}>{title.toUpperCase()}</Text>{badge ? <Text style={styles.onlyYou}>{badge.toUpperCase()}</Text> : null}</View>
    <View style={[styles.group, highlight && { borderColor: 'rgba(140,85,71,0.35)' }]}>{children}</View>
  </View>;
}

export function SettingsRow({ icon, title, sub, value, trailing, onPress, danger, last }: { icon?: ReactNode; title: string; sub?: string; value?: string | number | null; trailing?: ReactNode; onPress?: () => void; danger?: boolean; last?: boolean }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.sep, pressed && { backgroundColor: 'rgba(42,39,37,0.04)' }]}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    <View style={{ flex: 1, gap: 2 }}>
      <Text numberOfLines={1} style={[styles.title, danger && { color: '#A8432C' }]}>{title}</Text>
      {sub ? <Text numberOfLines={1} style={styles.sub}>{sub}</Text> : null}
    </View>
    {trailing}
    {value != null && value !== '' ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : null}
    {onPress && !danger ? <CaretRight size={16} color="#A69C94" /> : null}
  </Pressable>;
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'rose' | 'success' | 'danger' }) {
  const c = { neutral: ['rgba(42,39,37,0.07)', '#625B56'], rose: ['#C98B78', '#FFFFFF'], success: ['rgba(54,106,73,0.12)', '#366A49'], danger: ['rgba(168,67,44,0.12)', '#A8432C'] }[tone];
  return <View style={[styles.chip, { backgroundColor: c[0] }]}><Text style={[styles.chipText, { color: c[1] }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  groupTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, color: '#625B56' },
  onlyYou: { fontFamily: tokens.font.uiBold, fontSize: 11, color: '#FFFFFF', backgroundColor: '#C98B78', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, overflow: 'hidden' },
  group: { borderRadius: 24, backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', overflow: 'hidden', ...(webGlass as object) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(42,39,37,0.10)' },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,85,71,0.10)' },
  title: { fontFamily: tokens.font.uiMedium, fontSize: 16, color: '#2A2725' },
  sub: { fontFamily: tokens.font.ui, fontSize: 12, color: '#625B56' },
  value: { fontFamily: tokens.font.ui, fontSize: 14, color: '#625B56', maxWidth: 170 },
  chip: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 12 }
});
