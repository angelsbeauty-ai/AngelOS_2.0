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
import { colors } from '../../src/design/theme';

export default function TabsLayout() {
  // B9: students only get Academy + Settings. Studio tabs are hidden (and Screen redirects studio routes).
  const student = useRole() === 'student';
  const { t } = useTranslation();
  const studio = student ? { href: null } : {};
  const tabBarOptions = {
    headerShown: false,
    tabBarActiveTintColor: colors.light.gold as string,
    tabBarInactiveTintColor: colors.light.secondaryText as string,
    tabBarStyle: styles.tabBar,
    tabBarBackground: () => <GlassSurface kind="toast" style={StyleSheet.absoluteFill} />,
    tabBarShowLabel: true,
    tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14, paddingBottom: 0 },
    tabBarItemStyle: { marginVertical: 5, marginHorizontal: 2, paddingTop: 3, paddingBottom: 3, borderRadius: 31, overflow: 'hidden' as const },
    // A1 .tab.on: raised white pill behind the active tab.
    tabBarActiveBackgroundColor: 'rgba(255,255,255,0.66)',
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ ...studio, title: t('tabs.home'), tabBarIcon: ({ color }) => <House size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="messages" options={{ ...studio, title: t('tabs.messages'), tabBarIcon: ({ color }) => <ChatCircleDots size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: t('tabs.calendar'), tabBarIcon: ({ color }) => <CalendarBlank size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="analytics" options={{ ...studio, title: t('tabs.analytics'), tabBarIcon: ({ color }) => <ChartBar size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="academy" options={{ href: student ? undefined : null, title: t('tabs.academy'), tabBarIcon: ({ color }) => <GraduationCap size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <UserCircle size={24} color={color as string} weight="duotone" /> }} />
      {/* Moved out of the tab bar (NAV V1): Clients lives under Profile, Social posts under Calendar. Routes stay reachable. */}
      <Tabs.Screen name="clients" options={{ href: null, title: t('tabs.clients') }} />
      <Tabs.Screen name="social" options={{ href: null, title: t('tabs.social') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    height: 72,
    borderRadius: 36,
    borderTopWidth: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#2A2725',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
