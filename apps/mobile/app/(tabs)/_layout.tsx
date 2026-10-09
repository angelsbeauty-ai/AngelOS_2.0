import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Calendar, GearSix, GraduationCap, House, Users, Sparkle } from 'phosphor-react-native';
import { useRole } from '../../src/lib/me';
import { GlassSurface } from '../../src/components/Glass';
import { colors } from '../../src/design/theme';

export default function TabsLayout() {
  // B9: students only get Academy + Settings. Studio tabs are hidden (and Screen redirects studio routes).
  const student = useRole() === 'student';
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
      <Tabs.Screen name="index" options={{ ...studio, title: 'Today', tabBarIcon: ({ color }) => <House size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="clients" options={{ ...studio, title: 'Clients', tabBarIcon: ({ color }) => <Users size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="calendar" options={{ ...studio, title: 'Calendar', tabBarIcon: ({ color }) => <Calendar size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="social" options={{ ...studio, title: 'Social', tabBarIcon: ({ color }) => <Sparkle size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="account" options={{ href: student ? undefined : null, title: 'Settings', tabBarIcon: ({ color }) => <GearSix size={24} color={color as string} weight="duotone" /> }} />
      <Tabs.Screen name="academy" options={{ title: 'Academy', tabBarIcon: ({ color }) => <GraduationCap size={24} color={color as string} weight="duotone" /> }} />
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
