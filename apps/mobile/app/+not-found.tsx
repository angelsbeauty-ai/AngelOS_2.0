import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Button, ScreenTitle, SupportText, ui } from '../src/components/ui';
import { router } from 'expo-router';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen hideAsk>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <View style={styles.center}>
        <Text style={styles.notFound}>404</Text>
        <ScreenTitle>{t('nav3.notFound')}</ScreenTitle>
        <SupportText>{t('nav3.notFoundMsg')}</SupportText>
        <Button label={t('nav3.home')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
void Link;
const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: ui.spacing.md, paddingVertical: ui.spacing.md },
  notFound: { color: ui.colors.gold, fontSize: 48, fontWeight: '700' }
});
