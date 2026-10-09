import { useTranslation } from 'react-i18next';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Calendar, GearSix, GraduationCap, House, Users, Sparkle } from 'phosphor-react-native';
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
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ ...studio, title: t('tabs.today'), tabBarIcon: ({ color }) => <House size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="clients" options={{ ...studio, title: t('tabs.clients'), tabBarIcon: ({ color }) => <Users size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: t('tabs.calendar'), tabBarIcon: ({ color }) => <Calendar size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="social" options={{ ...studio, title: t('tabs.social'), tabBarIcon: ({ color }) => <Sparkle size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="account" options={{ href: student ? undefined : null, title: t('tabs.settings'), tabBarIcon: ({ color }) => <GearSix size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="academy" options={{ title: t('tabs.academy'), tabBarIcon: ({ color }) => <GraduationCap size={24} color={color as string} weight="duotone" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
});
