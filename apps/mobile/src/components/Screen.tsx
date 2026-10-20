import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { STUDENT_ALLOWED, useRole } from '../lib/me';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { showsAppTabBar } from './AppTabBar';
import { colors, spacing, tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';
import { useNightFix } from '../design/night-web';
import { GlassBackdrop } from './GlassBackdrop';

const TAB_PATHS = new Set(['/', '/messages', '/calendar', '/analytics', '/profile', '/clients', '/social', '/academy']);
const LOCKED = new Set(['/', '/messages', '/calendar', '/analytics', '/profile', '/ai', '/voice']);
const logo = require('../../assets/brand/mark-charcoal.png');

/** onRefresh: pull-to-refresh on native; a Refresh button on web. */
export function Screen({ children, header, hideAsk, askBottom, askRight, onRefresh, onSwipeUpAtEnd }: PropsWithChildren<{ /** Pinned above the scroll view (sticky header). */ header?: ReactNode; hideAsk?: boolean; /** Lift the assistant button above a screen's own floating button. */ askBottom?: number; askRight?: number; onRefresh?: () => Promise<unknown> | void; /** Deliberate upward swipe once the list is already at the bottom. */ onSwipeUpAtEnd?: () => void }>) {
  const atEnd = useRef(false); const touchY = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  async function refresh() { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } }
  const pathname = usePathname() ?? '/';
  const role = useRole();
  // B9 route guard: students only reach the Academy and their own settings.
  useEffect(() => { if (role === 'student' && !STUDENT_ALLOWED.test(pathname)) router.replace('/profile' as any); }, [role, pathname]);
  const showAsk = !hideAsk && role !== 'student' && TAB_PATHS.has(pathname);
  const { palette, mode } = useAppearance();
  const nightFix = mode === 'night' && !LOCKED.has(pathname);
  useNightFix(nightFix);
  return <View style={[styles.bg, { backgroundColor: palette.bg }]}>
    <GlassBackdrop />
    <SafeAreaView style={styles.safe}>
    {header ? <View style={[styles.pinned, { backgroundColor: palette.bg }]}>{header}</View> : null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, Platform.OS === 'web' && !LOCKED.has(pathname) && styles.webTop]} scrollEventThrottle={32} onScroll={onSwipeUpAtEnd ? (e) => { const n = e.nativeEvent; atEnd.current = n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 24; } : undefined} onTouchStart={onSwipeUpAtEnd ? (e) => { touchY.current = atEnd.current ? e.nativeEvent.pageY : null; } : undefined} onTouchEnd={onSwipeUpAtEnd ? (e) => { const s = touchY.current; touchY.current = null; if (s != null && atEnd.current && s - e.nativeEvent.pageY > 90) onSwipeUpAtEnd(); } : undefined} refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.light.gold} /> : undefined}><View style={[styles.stack, Platform.OS === 'web' && styles.webStack]}>{false ? <Pressable accessibilityRole="button" accessibilityLabel={t('common2.refresh')} onPress={() => void refresh()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? t('ui.refreshing') : t('ui.refresh')}</Text></Pressable> : null}{children}</View></ScrollView>
    {showAsk ? <AskButton pathname={pathname} bottom={askBottom} right={askRight} /> : null}
  </SafeAreaView></View>;
}

/** AngelOS logo button on every main screen: a neutral frosted glass circle. Opens the assistant with this screen as context. */
function AskButton({ pathname, bottom, right }: { pathname: string; bottom?: number; right?: number }) {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const parts = pathname.split('/').filter(Boolean);
  const entityType = parts[0] === 'clients' && parts[1] && parts[1] !== 'new' ? 'client' : undefined;
  const lift = bottom ?? (TAB_PATHS.has(pathname) ? 151 : showsAppTabBar(pathname) ? 96 : undefined); // F01: logo button y617–661 on 812
  return <Pressable accessibilityRole="button" accessibilityLabel={t('ui.askLabel')} onPress={() => router.push({ pathname: '/ai', params: { screen: parts[0] ?? 'home', ...(entityType ? { entityType, entityId: parts[1] } : {}) } })} style={[styles.ask, { borderColor: palette.border }, lift != null && { bottom: lift }, right != null && { right }]}>
    <BlurView intensity={palette.blur} tint={palette.tint} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: mode === 'night' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)' }]} />
    <Image accessibilityIgnoresInvertColors source={logo} style={[styles.askLogo, mode === 'night' && { tintColor: '#F4F4F5' }]} resizeMode="contain" />
  </Pressable>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F3F4F6' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  pinned: { zIndex: 2 },
  content: { padding: tokens.space.screen, paddingTop: 4, paddingBottom: 140, ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {}) },
  webTop: { justifyContent: 'flex-start' },
  stack: { gap: spacing.md },
  webStack: { maxWidth: 480, width: '100%', paddingBottom: 120 },
  refresh: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.light.border },
  refreshText: { color: colors.light.secondaryText, fontSize: 13, fontWeight: '600' },
  ask: { position: 'absolute', right: 16, bottom: Platform.OS === 'web' ? 24 : 16, width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  askLogo: { width: 24, height: 24 }
});
