import { useTranslation } from 'react-i18next';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { House } from 'phosphor-react-native/src/icons/House';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
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
    tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 15, paddingBottom: 2 },
    tabBarItemStyle: { paddingTop: 6, paddingBottom: 6 },
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ ...studio, title: t('tabs.today'), tabBarIcon: ({ color }) => <House size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="clients" options={{ ...studio, title: t('tabs.clients'), tabBarIcon: ({ color }) => <Users size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: t('tabs.calendar'), tabBarIcon: ({ color }) => <Calendar size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="social" options={{ ...studio, title: t('tabs.social'), tabBarIcon: ({ color }) => <ShareNetwork size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="academy" options={{ href: student ? undefined : null, title: t('tabs.academy'), tabBarIcon: ({ color }) => <GraduationCap size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <UserCircle size={24} color={color as string} weight="duotone" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    height: 66,
    borderRadius: 33,
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
