import { Tabs } from 'expo-router';
import { colors } from '../../src/design/theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.light.gold,
      tabBarInactiveTintColor: colors.light.secondaryText,
      tabBarStyle: {
        backgroundColor: colors.light.elevated,
        borderTopColor: colors.light.border,
        paddingBottom: 8,
        height: 64
      },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' }
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarLabel: 'Calendar' }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarLabel: 'Clients' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarLabel: 'Messages' }} />
      <Tabs.Screen name="content" options={{ title: 'Content', tabBarLabel: 'Content' }} />
    </Tabs>
  );
}
