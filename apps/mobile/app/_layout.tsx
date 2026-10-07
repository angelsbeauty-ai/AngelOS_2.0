import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { UsageTracker } from '../src/components/UsageTracker';
import { colors } from '../src/design/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  if (!loaded) return null;
  return <><StatusBar style="dark" /><UsageTracker /><Stack screenOptions={{ headerTitleAlign: 'center', headerStyle: { backgroundColor: colors.light.background }, headerTintColor: colors.light.primaryText, headerTitleStyle: { fontFamily: 'Manrope_700Bold' }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.light.background } }}><Stack.Screen name="index" options={{ title: 'Today' }} /><Stack.Screen name="login" options={{ title: 'Sign In' }} /><Stack.Screen name="founder-admin" options={{ title: 'Founder' }} /></Stack></>;
}
