import { Platform, StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';

/** Soft frosted glassmorphism behind every screen: neutral matte spheres, blurred, kept to the edges. */
const SPHERES = [
  { id: 'a', size: 230, pos: { top: -70, right: -80 } },
  { id: 'b', size: 170, pos: { top: 330, left: -95 } },
  { id: 'c', size: 250, pos: { bottom: -90, right: -70 } }
] as const;

export function GlassBackdrop() {
  const { palette } = useAppearance();
  const web = Platform.OS === 'web';
  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: palette.bg }]}>
    {SPHERES.map((s) => <View key={s.id} style={[styles.sphere, s.pos, { width: s.size, height: s.size, borderRadius: s.size / 2, opacity: palette.sphereOpacity, backgroundColor: palette.orb2 },
      web ? ({ backgroundImage: `radial-gradient(circle at 34% 28%, ${palette.orb} 0%, ${palette.orb2} 58%, ${palette.orbEdge} 100%)`, filter: 'blur(5px)' } as object) : null]} />)}
    <View style={[styles.fill, { backgroundColor: palette.veil }, web ? ({ backdropFilter: 'blur(3px)' } as object) : null]} />
  </View>;
}

const styles = StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }, sphere: { position: 'absolute' } });
