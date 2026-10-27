import { Image, StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { useNightFix } from '../design/night-web';

const rose = require('../../assets/brand/mark-rosegold.png');
const charcoal = require('../../assets/brand/mark-charcoal.png');

/** The AngelOS ribbon mark. variant 'rose' = 3D rose gold (splash), 'charcoal' = login. */
export function BrandMark({ size = 96, variant = 'charcoal' }: { size?: number; variant?: 'rose' | 'charcoal' }) {
  const { mode, palette } = useAppearance();
  return <Image accessibilityIgnoresInvertColors accessibilityLabel="AngelOS" source={variant === 'rose' ? rose : charcoal} style={[{ width: size, height: size }, mode === 'night' && variant === 'charcoal' ? { tintColor: palette.text } : null]} resizeMode="contain" />;
}

/** Soft silky backdrop used behind the auth screens. Night follows the app background. */
export function SilkBackground({ children }: { children: React.ReactNode }) {
  const { mode, palette } = useAppearance();
  useNightFix(mode === 'night');
  // Flat app background in both modes (A1 has no decorative circles; the silk photo is a later batch).
  return <View style={[styles.bg, { backgroundColor: palette.bg }]}>{children}</View>;
}
const styles = StyleSheet.create({
  bg: { flex: 1, overflow: 'hidden' }
});
