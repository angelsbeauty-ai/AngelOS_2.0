import { Image, StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { useNightFix } from '../design/night-web';

const rose = require('../../assets/brand/mark-rosegold.png');
const charcoal = require('../../assets/brand/mark-charcoal.png');

/** The AngelOS ribbon mark. variant 'rose' = 3D rose gold (splash), 'charcoal' = login. */
export function BrandMark({ size = 96, variant = 'charcoal' }: { size?: number; variant?: 'rose' | 'charcoal' }) {
  const { mode } = useAppearance();
  return <Image accessibilityIgnoresInvertColors accessibilityLabel="AngelOS" source={variant === 'rose' ? rose : charcoal} style={[{ width: size, height: size }, mode === 'night' && variant === 'charcoal' ? { tintColor: '#F4F4F5' } : null]} resizeMode="contain" />;
}

/** Soft silky backdrop used behind the auth screens. Night follows the app background. */
export function SilkBackground({ children }: { children: React.ReactNode }) {
  const { mode, palette } = useAppearance();
  useNightFix(mode === 'night');
  if (mode === 'night') return <View style={[styles.bg, { backgroundColor: palette.bg }]}>{children}</View>;
  return <View style={styles.bg}><View style={styles.blushA} /><View style={styles.blushB} />{children}</View>;
}
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F2F2F2', overflow: 'hidden' },
  blushA: { position: 'absolute', right: -120, bottom: -80, width: 380, height: 380, borderRadius: 190, backgroundColor: '#F2F2F2', opacity: 0.8 },
  blushB: { position: 'absolute', left: -140, top: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: '#FFFFFF', opacity: 0.85 }
});
