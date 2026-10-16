import { useEffect, useRef, type PropsWithChildren } from 'react';
import { STUDENT_ALLOWED, useRole } from '../lib/me';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors, spacing, tokens } from '../design/theme';
import { TopBar } from './TopBar';
import { showsAppTabBar } from './AppTabBar';

// A1 silk backdrop: gives the glass cards something to blur (mockup .A .screen).
const TAB_PATHS = new Set(['/', '/messages', '/calendar', '/analytics', '/profile', '/clients', '/social', '/academy']);
const OWN_HEADER = new Set(['/messages', '/calendar']);
const NO_ASK = /^\/(ai|login|onboarding|forgot-password|reset-password)(\/|$)/;

/** onRefresh: pull-to-refresh on native; a Refresh button on web. */
export function Screen({ children, hideAsk, onRefresh, onSwipeUpAtEnd }: PropsWithChildren<{ hideAsk?: boolean; onRefresh?: () => Promise<unknown> | void; /** Deliberate upward swipe once the list is already at the bottom. */ onSwipeUpAtEnd?: () => void }>) {
  const atEnd = useRef(false); const touchY = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  async function refresh() { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } }
  const pathname = usePathname() ?? '/';
  const role = useRole();
  // B9 route guard: students only reach the Academy and their own settings.
  useEffect(() => { if (role === 'student' && !STUDENT_ALLOWED.test(pathname)) router.replace('/academy' as any); }, [role, pathname]);
  const showAsk = !TAB_PATHS.has(pathname) && !hideAsk && role !== 'student' && !NO_ASK.test(pathname);
  return <View style={styles.bg}><SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} scrollEventThrottle={32} onScroll={onSwipeUpAtEnd ? (e) => { const n = e.nativeEvent; atEnd.current = n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 24; } : undefined} onTouchStart={onSwipeUpAtEnd ? (e) => { touchY.current = atEnd.current ? e.nativeEvent.pageY : null; } : undefined} onTouchEnd={onSwipeUpAtEnd ? (e) => { const s = touchY.current; touchY.current = null; if (s != null && atEnd.current && s - e.nativeEvent.pageY > 90) onSwipeUpAtEnd(); } : undefined} refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.light.gold} /> : undefined}><View style={[styles.stack, Platform.OS === 'web' && styles.webStack]}>{false ? <Pressable accessibilityRole="button" accessibilityLabel={t('common2.refresh')} onPress={() => void refresh()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? t('ui.refreshing') : t('ui.refresh')}</Text></Pressable> : null}{TAB_PATHS.has(pathname) && role !== 'student' && !OWN_HEADER.has(pathname) ? <TopBar /> : null}{children}</View></ScrollView>
    {showAsk ? <AskButton pathname={pathname} /> : null}
  </SafeAreaView></View>;
}

/** C3: "Ask AngelOS" on every screen. Opens the assistant with this screen as context. */
function AskButton({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const parts = pathname.split('/').filter(Boolean);
  const entityType = parts[0] === 'clients' && parts[1] && parts[1] !== 'new' ? 'client' : undefined;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('ui.askLabel')} onPress={() => router.push({ pathname: '/ai', params: { screen: parts[0] ?? 'home', ...(entityType ? { entityType, entityId: parts[1] } : {}) } })} style={[styles.ask, (TAB_PATHS.has(pathname) || showsAppTabBar(pathname)) && { bottom: 96 }]}>
    <Text style={styles.askText}>{t('ui.ask')}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F7F5F1' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: tokens.space.screen, paddingBottom: 120, ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {}) },
  stack: { gap: spacing.md },
  webStack: { maxWidth: 480, width: '100%', paddingBottom: 120 },
  refresh: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.light.border },
  refreshText: { color: colors.light.secondaryText, fontSize: 13, fontWeight: '600' },
  ask: { position: 'absolute', right: 16, bottom: Platform.OS === 'web' ? 24 : 16, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.light.primaryText, shadowColor: '#151515', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  askText: { color: colors.light.background, fontWeight: '700', fontSize: 15 }
});
