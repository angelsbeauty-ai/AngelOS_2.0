import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GlassSurface } from './Glass';
import { colors, D } from '../design/theme';
import { TabIcon } from './TabIcon';
import { TabGlyph, type TabGlyphName } from './TabGlyph';
import { useUnreadCount } from '../lib/unread';
import { useAppearance } from '../design/appearance';

/** Paths that render the real Tabs bar themselves. */
export const TAB_ROOTS = new Set(['/', '/messages', '/calendar', '/analytics', '/profile', '/clients', '/social', '/academy']);
const NO_BAR = /^\/(login|signup|sign-up|sign_up|register|onboarding|forgot-password|reset-password|voice)(\/|$)/;
/** Chat thread is one full screen. No tab bar. */
const NO_BAR_THREAD = /^\/messages\/[^/]+$/;

/** Inner (pushed) screens get the same 5-tab bar so Angel is never stuck. */
export function showsAppTabBar(pathname: string) { return !TAB_ROOTS.has(pathname) && !NO_BAR.test(pathname) && !NO_BAR_THREAD.test(pathname); }

function activeTab(p: string) {
  if (/^\/messages\//.test(p) || p === '/notifications') return p === '/notifications' ? '/' : '/messages';
  if (/^\/(bookings|content|media|business-hours|time-off)/.test(p)) return '/calendar';
  if (/^\/analytics/.test(p)) return '/analytics';
  if (/^\/(ai|suggestions)$/.test(p)) return '/';
  return '/profile';
}

export function AppTabBar() {
  const { t } = useTranslation();
  const pathname = usePathname() ?? '/';
  const unread = useUnreadCount();
  const { palette } = useAppearance();
  const insets = useSafeAreaInsets();
  if (!showsAppTabBar(pathname)) return null;
  const on = activeTab(pathname);
  const items = [
    { href: '/', label: t('tabs.home'), glyph: 'home' as TabGlyphName },
    { href: '/messages', label: t('tabs.messages'), glyph: 'messages' as TabGlyphName },
    { href: '/calendar', label: t('tabs.calendar'), glyph: 'calendar' as TabGlyphName },
    { href: '/analytics', label: t('tabs.analytics'), glyph: 'analytics' as TabGlyphName },
    { href: '/profile', label: t('tabs.profile'), glyph: 'profile' as TabGlyphName },
  ];
  // 49pt bar sits above the phone's bottom safe area. Read it from the device.
  const bottom = Math.max(insets.bottom, 34); // web reports 0: keep the 34pt home-indicator inset
  const barHeight = 49 + bottom;
  return <View style={[styles.bar, { height: barHeight, paddingBottom: bottom, borderTopColor: palette.border, backgroundColor: palette.bg }]} accessibilityRole="tablist">
    {items.map(({ href, label, glyph }) => {
      const active = on === href; const color = active ? palette.text : '#9A9A9F';
      return <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => router.navigate(href as any)} style={[styles.item, active && styles.itemOn]}>
        <TabIcon active={active} badge={href === '/messages' ? unread : 0}><TabGlyph name={glyph} active={active} color={color} /></TabIcon><Text style={[styles.label, { color }]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemOn: {},
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14 },
});
