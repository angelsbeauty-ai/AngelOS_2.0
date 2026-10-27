import { StyleSheet, Text, View } from 'react-native';
import { BrandMark, SilkBackground } from './BrandMark';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import i18n from '../i18n';

/** Native launch colour (app.json splash.backgroundColor, taken from assets/splash.png) so the hand-off is seamless in Day. */
export const LAUNCH_IVORY = '#F6F1EC';

/** Opening screen (final-A1 00-splash): rose-gold mark in a disc, name, tagline. */
export function Splash() {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return <SilkBackground><View style={[styles.center, !night && { backgroundColor: LAUNCH_IVORY }]}>
    <View style={[styles.disc, { backgroundColor: night ? palette.glass : tokens.color.raised, borderColor: palette.border }]}><BrandMark size={150} variant="rose" /></View>
    <Text style={[styles.name, { color: palette.text }]}>AngelOS</Text>
    <Text style={[styles.tag, { color: palette.muted }]}>{i18n.t('auth.tagline')}</Text>
  </View></SilkBackground>;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  disc: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 28 },
  name: { fontFamily: tokens.font.display, fontSize: tokens.type.largeTitle.fontSize, lineHeight: tokens.type.largeTitle.lineHeight },
  tag: { ...tokens.type.subhead }
});
