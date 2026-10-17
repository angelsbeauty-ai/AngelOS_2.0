import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';
export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const text = night ? '#F4F4F5' : tokens.color.charcoal;
  const secondary = night ? '#C7C7CC' : tokens.color.charcoal2;
  return <View style={[styles.card, { backgroundColor: night ? '#161618' : '#FFFFFF', borderWidth: 1, borderColor: night ? 'rgba(255,255,255,0.14)' : '#EDEDED' }, night ? palette.gloss : null]}>
    <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
    <Text style={[styles.title, { color: text }]}>{title}</Text>
    <Text style={[styles.message, { color: secondary }]}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.button, { backgroundColor: night ? '#F4F4F5' : tokens.color.charcoal }]}><Text style={[styles.buttonText, { color: night ? '#151515' : '#FFFFFF' }]}>{t('ui.tryAgain')}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ card: { borderRadius: 20, padding: 20, gap: 10 }, icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(179,38,30,0.12)', alignItems: 'center', justifyContent: 'center' }, iconText: { color: tokens.color.error, fontFamily: tokens.font.uiBold, fontSize: 20 }, title: { color: tokens.color.charcoal, fontFamily: tokens.font.uiBold, fontSize: 17 }, message: { color: tokens.color.charcoal2, fontFamily: tokens.font.ui, fontSize: 15 }, button: { minHeight: 44, borderRadius: 999, backgroundColor: tokens.color.charcoal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, buttonText: { color: tokens.color.onCharcoal, fontFamily: tokens.font.uiBold, fontSize: 15 } });
