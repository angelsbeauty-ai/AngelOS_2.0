import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { House } from 'phosphor-react-native/src/icons/House';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChartBar } from 'phosphor-react-native/src/icons/ChartBar';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { GlassSurface } from './Glass';
import { colors, D } from '../design/theme';
import { TabIcon } from './TabIcon';
import { useUnreadCount } from '../lib/unread';

/** Paths that render the real Tabs bar themselves. */
export const TAB_ROOTS = new Set(['/', '/messages', '/calendar', '/analytics', '/profile', '/clients', '/social', '/academy']);
const NO_BAR = /^\/(login|signup|sign-up|sign_up|register|onboarding|forgot-password|reset-password|voice)(\/|$)/;

/** Inner (pushed) screens get the same 5-tab bar so Angel is never stuck. */
export function showsAppTabBar(pathname: string) { return !TAB_ROOTS.has(pathname) && !NO_BAR.test(pathname); }

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
  if (!showsAppTabBar(pathname)) return null;
  const on = activeTab(pathname);
  const items = [
    { href: '/', label: t('tabs.home'), Icon: House },
    { href: '/messages', label: t('tabs.messages'), Icon: ChatCircleDots },
    { href: '/calendar', label: t('tabs.calendar'), Icon: CalendarBlank },
    { href: '/analytics', label: t('tabs.analytics'), Icon: ChartBar },
    { href: '/profile', label: t('tabs.profile'), Icon: UserCircle },
  ];
  return <View style={styles.bar} accessibilityRole="tablist">
    <GlassSurface kind="toast" style={[StyleSheet.absoluteFill, { backgroundColor: D.bgTab }]} />
    {items.map(({ href, label, Icon }) => {
      const active = on === href; const color = (active ? colors.light.gold : colors.light.secondaryText) as string;
      return <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => router.navigate(href as any)} style={[styles.item, active && styles.itemOn]}>
        <TabIcon active={active} badge={href === '/messages' ? unread : 0}><Icon size={24} color={color} weight="duotone" /></TabIcon><Text style={[styles.label, { color }]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute', left: 0, right: 0, bottom: 0, height: 64, flexDirection: 'row', backgroundColor: D.bgTab, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDED' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemOn: {},
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14 },
});
