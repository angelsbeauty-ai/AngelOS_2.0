import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/** Shared pushed header: back chevron + one Messages-style title. Visible in Day and Night.
 * Screens that use it set headerShown: false in app/_layout.tsx so there is only one back button. */
export function PushedHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { palette, mode } = useAppearance();
  const { t } = useTranslation();
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/profile' as any); }} hitSlop={8} style={[styles.back, { backgroundColor: palette.glass, borderColor: palette.border }]}>
      <CaretLeft size={20} color={palette.icon} weight="bold" />
    </Pressable>
    <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
    {right ? <View style={styles.right}>{right}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 28, lineHeight: 36 },
  right: { marginLeft: 'auto' }
});
