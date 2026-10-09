import { useEffect, type PropsWithChildren } from 'react';
import { STUDENT_ALLOWED, useRole } from '../lib/me';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors, spacing, tokens } from '../design/theme';

const NO_ASK = /^\/(ai|login|onboarding|forgot-password|reset-password)(\/|$)/;

/** onRefresh: pull-to-refresh on native; a Refresh button on web. */
export function Screen({ children, hideAsk, onRefresh }: PropsWithChildren<{ hideAsk?: boolean; onRefresh?: () => Promise<unknown> | void }>) {
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  async function refresh() { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } }
  const pathname = usePathname() ?? '/';
  const role = useRole();
  // B9 route guard: students only reach the Academy and their own settings.
  useEffect(() => { if (role === 'student' && !STUDENT_ALLOWED.test(pathname)) router.replace('/academy' as any); }, [role, pathname]);
  const showAsk = !hideAsk && role !== 'student' && !NO_ASK.test(pathname);
  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.light.gold} /> : undefined}><View style={[styles.stack, Platform.OS === 'web' && styles.webStack]}>{onRefresh && Platform.OS === 'web' ? <Pressable accessibilityRole="button" accessibilityLabel={t('common2.refresh')} onPress={() => void refresh()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? t('ui.refreshing') : t('ui.refresh')}</Text></Pressable> : null}{children}</View></ScrollView>
    {showAsk ? <AskButton pathname={pathname} /> : null}
  </SafeAreaView>;
}

/** C3: "Ask AngelOS" on every screen. Opens the assistant with this screen as context. */
function AskButton({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const parts = pathname.split('/').filter(Boolean);
  const entityType = parts[0] === 'clients' && parts[1] && parts[1] !== 'new' ? 'client' : undefined;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('ui.askLabel')} onPress={() => router.push({ pathname: '/ai', params: { screen: parts[0] ?? 'home', ...(entityType ? { entityType, entityId: parts[1] } : {}) } })} style={styles.ask}>
    <Text style={styles.askText}>{t('ui.ask')}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.color.pearl },
  content: { padding: tokens.space.screen, ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {}) },
  stack: { gap: spacing.md },
  webStack: { maxWidth: 480, width: '100%', paddingBottom: 120 },
  refresh: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.light.border },
  refreshText: { color: colors.light.secondaryText, fontSize: 13, fontWeight: '600' },
  ask: { position: 'absolute', right: 16, bottom: Platform.OS === 'web' ? 24 : 16, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.light.primaryText, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  askText: { color: colors.light.background, fontWeight: '700', fontSize: 15 }
});
