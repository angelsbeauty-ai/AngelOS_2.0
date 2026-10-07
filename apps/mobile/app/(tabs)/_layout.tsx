import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GlassSurface } from '../../src/components/Glass';
import { colors } from '../../src/design/theme';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.light.gold, tabBarInactiveTintColor: colors.light.secondaryText, tabBarStyle: styles.tabBar, tabBarBackground: () => <GlassSurface kind="toast" style={StyleSheet.absoluteFill} /> }}>
    <Tabs.Screen name="index" options={{ title: 'Today' }} />
    <Tabs.Screen name="clients" options={{ title: 'Clients' }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    <Tabs.Screen name="academy" options={{ title: 'Academy' }} />
  </Tabs>;
}
const styles = StyleSheet.create({ tabBar: { position: 'absolute', borderTopWidth: 0, backgroundColor: 'transparent' } });
