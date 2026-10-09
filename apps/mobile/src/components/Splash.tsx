import { StyleSheet, Text, View } from 'react-native';
import { BrandMark, SilkBackground } from './BrandMark';
import i18n from '../i18n';

/** Opening screen (final-A1 00-splash): rose-gold mark in a glass disc, name, tagline. */
export function Splash() {
  return <SilkBackground><View style={styles.center}>
    <View style={styles.disc}><BrandMark size={150} variant="rose" /></View>
    <Text style={styles.name}>AngelOS</Text>
    <Text style={styles.tag}>{i18n.t('auth.tagline')}</Text>
  </View></SilkBackground>;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  disc: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', marginBottom: 28 },
  name: { fontFamily: 'serif', fontSize: 40, color: '#2A2725' },
  tag: { fontSize: 14, color: '#6B645E' }
});
