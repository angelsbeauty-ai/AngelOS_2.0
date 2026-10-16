import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Storefront } from 'phosphor-react-native/src/icons/Storefront';
import { Button } from './ui';
import { tokens } from '../design/theme';

/** Friendly state for users with no studio yet (instead of an error). */
export function NoStudio() {
  const { t } = useTranslation();
  return <View style={styles.box}>
    <View style={styles.icon}><Storefront size={30} color="#000000" weight="duotone" /></View>
    <Text style={styles.title}>{t('nostudio.title')}</Text>
    <Text style={styles.body}>{t('nostudio.body')}</Text>
    <Button label={t('nostudio.cta')} onPress={() => router.push('/onboarding')} />
  </View>;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2' },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.10)' },
  title: { fontFamily: tokens.font.display, fontSize: 26, color: '#151515', textAlign: 'center' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#6B645B', textAlign: 'center' }
});
