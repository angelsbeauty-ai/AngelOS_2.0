import { StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';

/** Plain background behind every screen. The blurred grey spheres were removed (Designer, 20 Oct). */
export function GlassBackdrop() {
  const { palette } = useAppearance();
  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: palette.bg }]} />;
}

const styles = StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });
