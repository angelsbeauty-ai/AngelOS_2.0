import { useEffect, useRef, type PropsWithChildren } from 'react';
import { STUDENT_ALLOWED, useRole } from '../lib/me';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { X } from 'phosphor-react-native/src/icons/X';
import { colors, spacing, tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';

/** onRefresh: pull-to-refresh on native; a Refresh button on web. */
export function Screen({ children, hideAsk, askBottom, onRefresh, onSwipeUpAtEnd }: PropsWithChildren<{ hideAsk?: boolean; /** Lift the assistant button above a screen's own floating button. */ askBottom?: number; onRefresh?: () => Promise<unknown> | void; /** Deliberate upward swipe once the list is already at the bottom. */ onSwipeUpAtEnd?: () => void }>) {
  const atEnd = useRef(false); const touchY = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  async function refresh() { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } }
  const pathname = usePathname() ?? '/';
  const role = useRole();
  // B9 route guard: students only reach the Academy and their own settings.
  useEffect(() => { if (role === 'student' && !STUDENT_ALLOWED.test(pathname)) router.replace('/academy' as any); }, [role, pathname]);
  const showAsk = pathname === '/calendar';
  const { palette } = useAppearance();
  return <View style={[styles.bg, { backgroundColor: palette.bg }]}>
    <View pointerEvents="none" style={styles.orbs}>
      <View style={[styles.orb, { backgroundColor: palette.orb, width: 280, height: 280, top: -40, left: -60 }]} />
      <View style={[styles.orb, { backgroundColor: palette.orb2, width: 220, height: 220, top: 180, right: -70 }]} />
      <View style={[styles.orb, { backgroundColor: palette.orb, width: 160, height: 160, bottom: 80, left: 30 }]} />
    </View>
    <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} scrollEventThrottle={32} onScroll={onSwipeUpAtEnd ? (e) => { const n = e.nativeEvent; atEnd.current = n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 24; } : undefined} onTouchStart={onSwipeUpAtEnd ? (e) => { touchY.current = atEnd.current ? e.nativeEvent.pageY : null; } : undefined} onTouchEnd={onSwipeUpAtEnd ? (e) => { const s = touchY.current; touchY.current = null; if (s != null && atEnd.current && s - e.nativeEvent.pageY > 90) onSwipeUpAtEnd(); } : undefined} refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.light.gold} /> : undefined}><View style={[styles.stack, Platform.OS === 'web' && styles.webStack]}>{false ? <Pressable accessibilityRole="button" accessibilityLabel={t('common2.refresh')} onPress={() => void refresh()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? t('ui.refreshing') : t('ui.refresh')}</Text></Pressable> : null}{children}</View></ScrollView>
    {showAsk ? <AskButton pathname={pathname} bottom={askBottom} /> : null}
  </SafeAreaView></View>;
}

/** Opens the assistant. A plain cross, no circle and no logo. */
function AskButton({ pathname, bottom }: { pathname: string; bottom?: number }) {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  const parts = pathname.split('/').filter(Boolean);
  const entityType = parts[0] === 'clients' && parts[1] && parts[1] !== 'new' ? 'client' : undefined;
  const lift = bottom ?? 168;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('ui.askLabel')} hitSlop={12} onPress={() => router.push({ pathname: '/ai', params: { screen: 'calendar', ...(entityType ? { entityType, entityId: parts[1] } : {}) } })} style={[styles.ask, { bottom: lift }]}>
    <X size={22} color={palette.icon} weight="bold" />
  </Pressable>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F3F4F6' },
  orbs: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: tokens.space.screen, paddingTop: 4, paddingBottom: 120, ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {}) },
  stack: { gap: spacing.md },
  webStack: { maxWidth: 480, width: '100%', paddingBottom: 120 },
  refresh: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.light.border },
  refreshText: { color: colors.light.secondaryText, fontSize: 13, fontWeight: '600' },
  ask: { position: 'absolute', right: 20, bottom: Platform.OS === 'web' ? 24 : 16, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }
});
