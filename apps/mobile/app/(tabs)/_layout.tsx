import { useTranslation } from 'react-i18next';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { House } from 'phosphor-react-native/src/icons/House';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { ChartBar } from 'phosphor-react-native/src/icons/ChartBar';
import { useRole } from '../../src/lib/me';
import { GlassSurface } from '../../src/components/Glass';
import { colors, D } from '../../src/design/theme';
import { TabIcon } from '../../src/components/TabIcon';
import { useUnreadCount } from '../../src/lib/unread';
import { useAppearance } from '../../src/design/appearance';

export default function TabsLayout() {
  // B9: students only get Academy + Settings. Studio tabs are hidden (and Screen redirects studio routes).
  const student = useRole() === 'student';
  const { t } = useTranslation();
  const unread = useUnreadCount();
  const { palette } = useAppearance();
  const studio = student ? { href: null } : {};
  const tabBarOptions = {
    headerShown: false,
    tabBarActiveTintColor: palette.text,
    tabBarInactiveTintColor: palette.muted,
    tabBarStyle: [styles.tabBar, { borderTopColor: palette.border, backgroundColor: 'transparent' }],
    tabBarBackground: () => <GlassSurface kind="toast" style={StyleSheet.absoluteFill} />,
    tabBarShowLabel: true,
    tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14, paddingBottom: 0 },
    tabBarItemStyle: { paddingTop: 3, paddingBottom: 3 },
    // A1 .tab.on: raised white pill behind the active tab.
    tabBarActiveBackgroundColor: 'transparent',
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ ...studio, title: t('tabs.home'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><House size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      <Tabs.Screen name="messages" options={{ ...studio, title: t('tabs.messages'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused} badge={unread}><ChatCircleDots size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: t('tabs.calendar'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><CalendarBlank size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      <Tabs.Screen name="analytics" options={{ ...studio, title: t('tabs.analytics'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><ChartBar size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      <Tabs.Screen name="academy" options={{ href: null, title: t('tabs.academy'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><GraduationCap size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color, focused }) => <TabIcon active={focused}><UserCircle size={24} color={color as string} weight="duotone" /></TabIcon> }} />
      {/* Moved out of the tab bar (NAV V1): Clients lives under Profile, Social posts under Calendar. Routes stay reachable. */}
      <Tabs.Screen name="clients" options={{ href: null, title: t('tabs.clients') }} />
      <Tabs.Screen name="social" options={{ href: null, title: t('tabs.social') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, paddingTop: 0, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0 },
});
