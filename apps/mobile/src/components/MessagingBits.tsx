import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ui } from './ui';
import { tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';

const PLATFORM_COLORS: Record<string, string> = { line: '#151515', instagram: '#151515', facebook: '#151515', other: '#6B645B', manual: '#6B645B', tiktok: '#151515' };

export function PlatformBadge({ platform, label }: { platform: string; label: string }) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return <View style={[styles.badge, { borderColor: night ? palette.border : (PLATFORM_COLORS[platform] ?? ui.colors.border) }]}><Text style={[styles.badgeText, { color: night ? palette.muted : (PLATFORM_COLORS[platform] ?? ui.colors.secondaryText) }]}>{label}</Text></View>;
}

export function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return <View style={styles.avatar} accessibilityElementsHidden><Text style={styles.avatarText}>{initial}</Text></View>;
}

export function UnreadDot({ visible }: { visible: boolean }) {
  return visible ? <View accessibilityLabel="Unread" style={styles.dot} /> : <View style={styles.dotSpace} />;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }} accessibilityLabel={label} onPress={onPress} style={[styles.chip, night && { backgroundColor: '#161618', borderColor: 'rgba(255,255,255,0.14)' }, selected && (night ? { backgroundColor: '#F4F4F5', borderColor: '#F4F4F5' } : styles.chipSelected)]}><Text style={[styles.chipText, night && { color: '#E5E5E7' }, selected && (night ? { color: '#151515' } : styles.chipTextSelected)]}>{label}</Text></Pressable>;
}

export function ActionButton({ label, onPress, kind = 'secondary', disabled, accessibilityHint }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet'; disabled?: boolean; accessibilityHint?: string }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  const primary = kind === 'primary';
  const bg = primary ? (night ? '#F4F4F5' : tokens.color.charcoal) : 'transparent';
  const fg = primary ? (night ? '#151515' : '#FFFFFF') : (night ? '#F4F4F5' : ui.colors.primaryText);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: bg, borderWidth: primary ? 0 : 1, borderColor: night ? 'rgba(255,255,255,0.14)' : ui.colors.border }, kind === 'quiet' && styles.quiet, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
  </Pressable>;
}

/** Japanese text Angel must approve, with the English meaning right next to it. */
export function BilingualBlock({ ja, en, labelJa = '日本語 (sent to client)', labelEn = 'English meaning (for you)' }: { ja: string; en: string | null; labelJa?: string; labelEn?: string }) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return <View style={styles.bilingual}>
    <View style={[styles.bilingualCol, night && { backgroundColor: palette.glass, borderColor: palette.border }]}><Text style={[styles.bilingualLabel, night && { color: palette.muted }]}>{labelJa}</Text><Text style={[styles.bilingualBody, night && { color: palette.text }]}>{ja}</Text></View>
    <View style={[styles.bilingualCol, styles.bilingualEn, night && { backgroundColor: palette.glass, borderColor: palette.border }]}><Text style={[styles.bilingualLabel, night && { color: palette.muted }]}>{labelEn}</Text><Text style={[styles.bilingualBody, night && { color: palette.text }]}>{en ?? 'Translation not ready yet. Tap "Translate" before approving.'}</Text></View>
  </View>;
}

export function Banner({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'warning' }>) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return <View style={[styles.banner, night && { backgroundColor: palette.glass, borderColor: palette.border }, tone === 'warning' && styles.bannerWarning]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontFamily: tokens.font.uiBold, fontSize: 11, letterSpacing: 0.4 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.softGold },
  avatarText: { fontFamily: tokens.font.uiSemibold, fontSize: 22, color: ui.colors.primaryText },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.color.tide },
  dotSpace: { width: 10, height: 10 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: ui.colors.border, backgroundColor: ui.colors.elevated, justifyContent: 'center' },
  chipSelected: { backgroundColor: tokens.color.charcoal, borderColor: tokens.color.charcoal },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: ui.colors.primaryText },
  chipTextSelected: { color: tokens.color.onCharcoal },
  button: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: tokens.color.charcoal },
  secondary: { backgroundColor: ui.colors.elevated, borderWidth: 1, borderColor: ui.colors.border },
  quiet: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.97 }] },
  buttonText: { fontFamily: tokens.font.uiBold, fontSize: 15, color: ui.colors.primaryText },
  primaryText: { color: tokens.color.onCharcoal },
  bilingual: { gap: 8 },
  bilingualCol: { gap: 2, padding: 12, borderRadius: 16, backgroundColor: ui.colors.elevated, borderWidth: 1, borderColor: ui.colors.border },
  bilingualEn: { backgroundColor: tokens.color.glassTint },
  bilingualLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: ui.colors.secondaryText, letterSpacing: 0.4 },
  bilingualBody: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22, color: ui.colors.primaryText },
  banner: { padding: 14, borderRadius: 20, backgroundColor: tokens.color.glassTint, borderWidth: 1, borderColor: ui.colors.border, gap: 6 },
  bannerWarning: { borderColor: tokens.color.warning }
});
