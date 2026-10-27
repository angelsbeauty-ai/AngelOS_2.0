import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, ActivityIndicator, Platform, StyleSheet, Text, TextInput, View, Pressable, type TextInputProps, type StyleProp, type ViewStyle, Switch, type SwitchProps } from 'react-native';
import { D, N, accent, colors, radius, shadow, spacing, tokens, typography, webGlass } from '../design/theme';
import { useAppearance } from '../design/appearance';

const palette = colors.light;
type TextTone = 'primary' | 'secondary' | 'gold' | 'success' | 'warning' | 'critical';

function useInk() {
  const { mode, palette: p } = useAppearance();
  const night = mode === 'night';
  return {
    night,
    text: night ? '#F4F4F5' : '#151515',
    secondary: night ? '#C7C7CC' : '#3A3A3C',
    muted: night ? '#9A9A9F' : '#6C6C70',
    card: night ? '#161618' : '#FFFFFF',
    border: night ? 'rgba(255,255,255,0.14)' : '#EDEDED',
    primaryBg: night ? '#F4F4F5' : '#151515',
    primaryFg: night ? '#151515' : '#FFFFFF',
    gloss: night ? p.gloss : {}
  };
}

function toneColor(tone: TextTone, ink: ReturnType<typeof useInk>) {
  switch (tone) {
    case 'gold': return ink.text;
    case 'success': return ink.text;
    case 'warning': return ink.text;
    case 'critical': return palette.critical;
    case 'secondary': return ink.secondary;
    default: return ink.text;
  }
}

// O04: no Dynamic Type cap; layouts use minHeight and wrap instead.
const textProps = {} as const;

export function AppTitle({ children }: PropsWithChildren) { return <Text {...textProps} style={styles.appTitle}>{children}</Text>; }
export function ScreenTitle({ children, color }: PropsWithChildren<{ color?: string }>) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.screenTitle, { color: color ?? ink.text, fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30 }]}>{children}</Text>;
}
export function SectionTitle({ children }: PropsWithChildren) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.sectionTitle, { color: ink.text }]}>{children}</Text>;
}
export function BodyText({ children, tone = 'primary' }: PropsWithChildren<{ tone?: TextTone }>) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.body, { color: toneColor(tone, ink) }]}>{children}</Text>;
}
export function SupportText({ children, tone = 'secondary' }: PropsWithChildren<{ tone?: TextTone }>) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.support, { color: toneColor(tone, ink) }]}>{children}</Text>;
}
export function Card({ children, premium = false }: PropsWithChildren<{ premium?: boolean }>) {
  const ink = useInk();
  return <View style={[styles.card, { backgroundColor: ink.card, borderColor: ink.night ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)', borderWidth: ink.night ? 1 : StyleSheet.hairlineWidth, borderRadius: ink.night ? 20 : radius.card }, ink.night ? ink.gloss : null, premium && !ink.night && styles.premiumCard]}>{children}</View>;
}
export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <View style={[styles.card, styles.statCard]}><SupportText>{label}</SupportText><Text {...textProps} style={styles.statValue}>{value}</Text><SupportText>{detail}</SupportText></View>; }
export function Pill({ children, tone = 'secondary' }: PropsWithChildren<{ tone?: TextTone }>) {
  const ink = useInk();
  const on = tone === 'gold' || tone === 'success';
  return <View style={[styles.pill, { backgroundColor: on ? ink.primaryBg : ink.card, borderColor: ink.border }, on && { borderColor: ink.primaryBg }]}><Text {...textProps} style={[styles.pillText, { color: on ? ink.primaryFg : (ink.night ? '#E5E5E7' : ink.text) }]}>{children}</Text></View>;
}
export function Row({ children, accessory }: PropsWithChildren<{ accessory?: ReactNode }>) { return <View style={styles.row}><View style={styles.rowContent}>{children}</View>{accessory}</View>; }
export function PrimaryActionLabel({ children }: PropsWithChildren) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.primaryAction, { backgroundColor: ink.primaryBg, color: ink.primaryFg }]}>{children}</Text>;
}
export function SecondaryActionLabel({ children }: PropsWithChildren) {
  const ink = useInk();
  return <Text {...textProps} style={[styles.secondaryAction, { backgroundColor: 'transparent', borderColor: ink.border, color: ink.text }]}>{children}</Text>;
}
export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: { label: string; onPress: () => void }; icon?: ReactNode }) {
  const ink = useInk();
  return (
    <View style={styles.emptyState} accessibilityRole="summary">
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text {...textProps} style={[styles.emptyTitle, { color: ink.text }]}>{title}</Text>
      {message ? <SupportText>{message}</SupportText> : null}
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** A1 button: charcoal pill (primary), outline (secondary), text (ghost), red outline (danger). Min 44pt. */
export function Button({ label, onPress, variant = 'primary', loading, disabled, small, style, accessibilityLabel }: { label: string; onPress: () => void; variant?: ButtonVariant; loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const ink = useInk();
  const off = disabled || loading;
  // Night danger is a filled red pill with white text (6.54:1): red text on black is only 3.12:1.
  const fg = variant === 'primary' ? ink.primaryFg : variant === 'danger' ? (ink.night ? tokens.color.onCharcoal : palette.critical) : ink.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, variant === 'primary' && { backgroundColor: ink.primaryBg }, variant === 'secondary' && { borderWidth: 1, borderColor: ink.border, backgroundColor: 'transparent' }, variant === 'danger' && styles.btnDanger, variant === 'danger' && ink.night && { backgroundColor: palette.critical }, variant === 'ghost' && styles.btnGhost, pressed && !off && { transform: [{ scale: 0.97 }] }, style]}>
      {loading ? <ActivityIndicator color={fg} size="small" /> : <Text {...textProps} numberOfLines={1} style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

/** Labelled input with error text and an eye toggle for passwords. */
export function TextField({ label, error, hint, secure, style, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string; secure?: boolean }) {
  const [shown, setShown] = useState(false);
  const { t } = useTranslation();
  const ink = useInk();
  return (
    <View style={{ gap: 4 }}>
      <Text {...textProps} style={[styles.fieldLabel, { color: ink.secondary }]}>{label}</Text>
      <View style={[styles.fieldBox, { backgroundColor: ink.card, borderColor: error ? palette.critical : ink.border, minHeight: 48, borderRadius: 16 }]}>
        <TextInput {...props} secureTextEntry={secure && !shown} accessibilityLabel={label} placeholderTextColor={ink.muted} style={[styles.fieldInput, { color: ink.text }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]} />
        {secure ? <Pressable accessibilityRole="button" accessibilityLabel={shown ? t('ui.hidePassword') : t('ui.showPassword')} onPress={() => setShown((v) => !v)} hitSlop={8}><Text {...textProps} style={[styles.eye, { color: ink.text }]}>{shown ? t('ui.hide') : t('ui.show')}</Text></Pressable> : null}
      </View>
      {error ? <Text {...textProps} style={[styles.fieldHint, { color: palette.critical }]}>{error}</Text> : hint ? <Text {...textProps} style={[styles.fieldHint, { color: ink.muted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Round initial avatar. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text {...textProps} style={[styles.avatarText, { fontSize: size * 0.4 }]}>{(name || '?').slice(0, 1).toUpperCase()}</Text></View>;
}

const BADGE: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: 'rgba(0,0,0,0.14)', fg: palette.success }, request: { bg: 'rgba(138,90,0,0.14)', fg: palette.warning }, requested: { bg: 'rgba(138,90,0,0.14)', fg: palette.warning },
  cancelled: { bg: '#EDEDED', fg: tokens.color.charcoal3 }, no_show: { bg: 'rgba(179,38,30,0.12)', fg: palette.critical }, completed: { bg: 'rgba(0,0,0,0.14)', fg: tokens.color.tide }, done: { bg: 'rgba(0,0,0,0.14)', fg: tokens.color.tide },
};
/** Status badge: confirmed=success, request=warning, cancelled=muted, no_show=error, done=tide. */
export function Badge({ status, label }: { status: string; label?: string }) {
  const c = BADGE[status] ?? { bg: palette.softGold, fg: palette.primaryText };
  return <View style={[styles.badge, { backgroundColor: c.bg }]}><Text {...textProps} style={[styles.badgeText, { color: c.fg }]}>{label ?? status.replaceAll('_', ' ')}</Text></View>;
}

/** Tappable list row: avatar/leading, title, subtitle, trailing, chevron. */
export function ListRow({ title, subtitle, leading, trailing, onPress, chevron = true, accessibilityHint }: { title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; accessibilityHint?: string }) {
  const ink = useInk();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} accessibilityHint={accessibilityHint} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.listRow, { backgroundColor: ink.card, borderRadius: ink.night ? 20 : radius.card, borderWidth: ink.night ? 1 : 0, borderColor: ink.border }, pressed && { transform: [{ scale: 0.97 }] }]}>
      {leading ?? <Avatar name={title} />}
      <View style={{ flex: 1, gap: 2 }}><Text {...textProps} numberOfLines={1} style={[styles.listTitle, { color: ink.text }]}>{title}</Text>{subtitle ? <Text {...textProps} numberOfLines={2} style={[styles.support, { color: ink.secondary }]}>{subtitle}</Text> : null}</View>
      {trailing}
      {onPress && chevron ? <Text style={[styles.chevron, { color: ink.muted }]}>›</Text> : null}
    </Pressable>
  );
}

/** On/off switch in AngelOS tokens: rose-gold accent track when on (Day/Night variant), white thumb, grey track when off (3:1+ against the card so the off state is visible). */
export function AccentSwitch(props: Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>) {
  const { night } = useInk();
  const off = night ? N.muted : D.faint;
  return <Switch {...props} trackColor={{ false: off, true: accent(night) }} ios_backgroundColor={off} thumbColor={tokens.color.onCharcoal} />;
}

/** Big-number tile (Cormorant tabular numerals). */
export function StatTile({ label, value, detail, onPress }: { label: string; value: string | number; detail?: string; onPress?: () => void }) {
  const ink = useInk();
  const body = <><Text {...textProps} style={[styles.tileLabel, { color: ink.secondary }]}>{label}</Text><Text {...textProps} style={[styles.tileValue, { color: ink.text }]}>{value}</Text>{detail ? <Text {...textProps} style={[styles.fieldHint, { color: ink.muted }]}>{detail}</Text> : null}</>;
  const box = [styles.card, styles.tile, { backgroundColor: ink.card, borderColor: ink.border, borderRadius: ink.night ? 20 : radius.card }, ink.night ? ink.gloss : null];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={box}>{body}</Pressable> : <View style={box}>{body}</View>;
}

/** Page header: large Cormorant title, optional subtitle, optional action on the right. */
export function Header({ title, subtitle, eyebrow, action }: { title: string; subtitle?: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text {...textProps} style={styles.overline}>{eyebrow}</Text> : null}
        <ScreenTitle>{title}</ScreenTitle>
        {subtitle ? <SupportText>{subtitle}</SupportText> : null}
      </View>
      {action}
    </View>
  );
}

export function Overline({ children, color }: PropsWithChildren<{ color?: string }>) { return <Text {...textProps} style={[styles.overline, color ? { color } : null]}>{children}</Text>; }

/** Pulsing placeholder rows. Static when reduced motion is on. */
export function Skeleton({ rows = 3, height = 64 }: { rows?: number; height?: number }) {
  const { t } = useTranslation();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }), Animated.timing(v, { toValue: 0.5, duration: 800, useNativeDriver: Platform.OS !== 'web' })]));
      loop.start();
    }).catch(() => undefined);
    return () => { live = false; loop?.stop(); };
  }, [v]);
  return <View accessibilityRole="progressbar" accessibilityLabel={t('ui.loading')} style={{ gap: spacing.xs }}>{Array.from({ length: rows }, (_, i) => <Animated.View key={i} style={{ height, borderRadius: radius.card, backgroundColor: '#F2F2F2', opacity: v }} />)}</View>;
}

export const ui = { colors: palette, spacing, radius, typography };

const styles = StyleSheet.create({
  appTitle: { color: palette.primaryText, fontFamily: tokens.font.display, fontSize: typography.display, lineHeight: 44 },
  screenTitle: { color: palette.primaryText, fontFamily: tokens.font.display, fontSize: typography.screenTitle, lineHeight: 44 },
  sectionTitle: { color: palette.primaryText, fontFamily: tokens.font.uiSemibold, fontSize: typography.section, lineHeight: 22 },
  body: { fontFamily: tokens.font.ui, fontSize: typography.body, lineHeight: 22 },
  support: { fontFamily: tokens.font.ui, fontSize: typography.support, lineHeight: 20 },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: tokens.color.raised, ...shadow.soft, ...(webGlass as object) },
  premiumCard: { backgroundColor: palette.warmSurface, borderColor: palette.softGold },
  statCard: { flex: 1 },
  statValue: { color: palette.primaryText, fontFamily: tokens.font.uiBold, fontSize: 26 },
  pill: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated },
  goldPill: { backgroundColor: palette.softGold, borderColor: palette.softGold },
  pillText: { fontFamily: tokens.font.uiBold, fontSize: typography.metadata },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.border },
  rowContent: { flex: 1, gap: 2 },
  primaryAction: { minHeight: 44, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: palette.primaryText, color: palette.elevated, fontFamily: tokens.font.uiBold, fontSize: typography.body, textAlign: 'center', textAlignVertical: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  secondaryAction: { minHeight: 44, overflow: 'hidden', borderRadius: radius.pill, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.primaryText, fontFamily: tokens.font.uiBold, fontSize: typography.body, textAlign: 'center', textAlignVertical: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  emptyTitle: { color: palette.primaryText, fontFamily: tokens.font.uiSemibold, fontSize: typography.section, textAlign: 'center' },
  emptyIcon: { marginBottom: 4 },
  btn: { minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm + 4 },
  btnSmall: { minHeight: 36, paddingHorizontal: spacing.sm },
  btnPrimary: { backgroundColor: tokens.color.charcoal },
  btnSecondary: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated },
  btnDanger: { borderWidth: 1, borderColor: palette.critical, backgroundColor: 'transparent' },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontFamily: tokens.font.uiBold, fontSize: typography.body },
  fieldLabel: { color: palette.secondaryText, fontFamily: tokens.font.uiSemibold, fontSize: 13 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: radius.control, backgroundColor: tokens.color.raised, paddingHorizontal: spacing.sm },
  fieldInput: { flex: 1, color: palette.primaryText, fontFamily: tokens.font.ui, fontSize: 16, paddingVertical: 10 },
  fieldHint: { color: palette.secondaryText, fontFamily: tokens.font.ui, fontSize: 12 },
  eye: { color: palette.gold, fontFamily: tokens.font.uiSemibold, fontSize: 14, paddingLeft: spacing.xs },
  avatar: { borderWidth: 1, borderColor: palette.softGold, backgroundColor: palette.softGold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.gold, fontFamily: tokens.font.uiBold },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: tokens.font.uiBold, fontSize: 12, textTransform: 'capitalize' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 64, padding: spacing.sm, borderRadius: radius.card, backgroundColor: tokens.color.raised, ...shadow.soft },
  listTitle: { color: palette.primaryText, fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  chevron: { color: tokens.color.charcoal3, fontSize: 24 },
  tile: { flex: 1, minWidth: 140 },
  tileLabel: { color: palette.secondaryText, fontFamily: tokens.font.uiMedium, fontSize: 13 },
  tileValue: { color: palette.primaryText, fontFamily: tokens.font.uiBold, fontSize: 32, lineHeight: 38, fontVariant: ['lining-nums', 'tabular-nums'] },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  overline: { color: palette.gold, fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
});

/** LOCKED screen title standard (the Messages title): one row, title left, icons right. */
export const screenHeader = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, marginTop: 12 },
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30, color: '#151515' }
});
