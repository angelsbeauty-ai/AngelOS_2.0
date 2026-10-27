import { useTranslation } from 'react-i18next';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useRole } from '../../src/lib/me';
import { GlassSurface } from '../../src/components/Glass';
import { colors, D } from '../../src/design/theme';
import { TabIcon } from '../../src/components/TabIcon';
import { TabGlyph } from '../../src/components/TabGlyph';
import { useInsets as useSafeAreaInsets } from '../../src/lib/insets';
import { useUnreadCount } from '../../src/lib/unread';
import { useAppearance } from '../../src/design/appearance';

/** AngelOS V1: the app opens on Messages (Home and Analytics are hidden). */
export const unstable_settings = { initialRouteName: 'messages' };

export default function TabsLayout() {
  // B9: students only get Profile + Settings (Academy removed in V1). Studio tabs are hidden (and Screen redirects studio routes).
  const student = useRole() === 'student';
  const { t } = useTranslation();
  const unread = useUnreadCount();
  const { palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const studio = student ? { href: null } : {};
  const tabBarOptions = {
    headerShown: false,
    tabBarActiveTintColor: palette.text,
    tabBarInactiveTintColor: palette.muted,
    tabBarStyle: [styles.tabBar, { height: 49 + Math.max(insets.bottom, 34), paddingBottom: Math.max(insets.bottom, 34), borderTopColor: palette.border, backgroundColor: palette.bg }],
    tabBarShowLabel: true,
    tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14, height: 14, paddingBottom: 0, flexShrink: 0 },
    // The tab button already pads 5pt top/bottom inside the 49pt bar: 49 - 10 = 39 >= 24 icon + 14 label.
    // Extra item padding (or a taller icon box) squeezed the label row to 6pt and clipped it on web and iOS.
    tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
    tabBarIconStyle: { minHeight: 24 },
    // A1 .tab.on: raised white pill behind the active tab.
    tabBarActiveBackgroundColor: 'transparent',
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ href: null, title: t('tabs.home'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><TabGlyph name="home" active={focused} color={focused ? palette.text : palette.muted} /></TabIcon> }} />
      <Tabs.Screen name="messages" options={{ ...studio, title: t('tabs.messages'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused} badge={unread}><TabGlyph name="messages" active={focused} color={focused ? palette.text : palette.muted} /></TabIcon> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: t('tabs.calendar'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><TabGlyph name="calendar" active={focused} color={focused ? palette.text : palette.muted} /></TabIcon> }} />
      <Tabs.Screen name="analytics" options={{ href: null, title: t('tabs.analytics'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><TabGlyph name="analytics" active={focused} color={focused ? palette.text : palette.muted} /></TabIcon> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><TabGlyph name="profile" active={focused} color={focused ? palette.text : palette.muted} /></TabIcon> }} />
      {/* V1 tab bar: Messages, Calendar, Profile (+ the AngelOS assistant button). Home and Analytics stay in code, hidden. */}
      {/* Moved out of the tab bar (NAV V1): Clients lives under Profile, Social posts under Calendar. Routes stay reachable. */}
      <Tabs.Screen name="clients" options={{ href: null, title: t('tabs.clients') }} />
      <Tabs.Screen name="social" options={{ href: null, title: t('tabs.social') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 0, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0 },
});
