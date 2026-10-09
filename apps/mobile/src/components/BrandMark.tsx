import { Image, StyleSheet, View } from 'react-native';

const rose = require('../../assets/brand/mark-rosegold.png');
const charcoal = require('../../assets/brand/mark-charcoal.png');

/** The AngelOS ribbon mark. variant 'rose' = 3D rose gold (splash), 'charcoal' = login. */
export function BrandMark({ size = 96, variant = 'charcoal' }: { size?: number; variant?: 'rose' | 'charcoal' }) {
  return <Image accessibilityIgnoresInvertColors accessibilityLabel="AngelOS" source={variant === 'rose' ? rose : charcoal} style={{ width: size, height: size }} resizeMode="contain" />;
}

/** Soft silky backdrop (pearl to blush) used behind the auth screens and splash. */
export function SilkBackground({ children }: { children: React.ReactNode }) {
  return <View style={styles.bg}><View style={styles.blushA} /><View style={styles.blushB} />{children}</View>;
}
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#E6DFD8', overflow: 'hidden' },
  blushA: { position: 'absolute', right: -120, bottom: -80, width: 380, height: 380, borderRadius: 190, backgroundColor: '#F3DDD2', opacity: 0.8 },
  blushB: { position: 'absolute', left: -140, top: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: '#F5F2EE', opacity: 0.85 }
});
