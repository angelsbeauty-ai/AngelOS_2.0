import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useAppearance } from '../design/appearance';
import { useOrbMotion, type OrbState } from './orbMotion';
import { crumb } from '../lib/crash-guard';
void crumb('orb code loaded');

const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d);

/**
 * Pearl orb (final-D2 mockup 07): a soft halo, a thin outer ring, a shaded rim band and a pearl sphere lit from the top left.
 * Drawn with plain Skia circles and radial gradients (no runtime shader), so it cannot fail to compile.
 * It breathes slowly and swells with the voice level. The layout box stays `size` so the screen does not move.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed, level }: { size?: number; state?: OrbState; dimmed?: boolean; level?: () => number }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  useEffect(() => { void crumb('orb drawn (pearl)'); }, []);
  const f = useOrbMotion(state, level);
  const C = 360; const c = C / 2; const s = fin(f.scale, 1);
  const halo = night ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.75)', 'rgba(236,231,222,0.55)', 'rgba(236,231,222,0)'];
  const ring = night ? 'rgba(255,255,255,0.18)' : 'rgba(120,108,92,0.22)';
  return <View accessibilityElementsHidden style={[styles.hold, { width: size, height: size, opacity: dimmed ? 0.4 : 1 }]}>
    <Canvas style={{ width: C, height: C, margin: (size - C) / 2 }}>
      <Group origin={vec(c, c)} transform={[{ scale: s }]}>
        <Circle cx={c} cy={c} r={178}><RadialGradient c={vec(c, c)} r={178} colors={halo} positions={[0, 0.7, 1]} /></Circle>
        <Circle cx={c} cy={c} r={136} style="stroke" strokeWidth={1} color={ring} />
        <Circle cx={c} cy={c} r={122}><RadialGradient c={vec(c - 30, c - 36)} r={170} colors={night ? ['#5A5550', '#3A3733', '#24221F'] : ['#FBF9F5', '#E9E3D9', '#CFC5B5']} positions={[0, 0.6, 1]} /></Circle>
        <Circle cx={c} cy={c} r={122} style="stroke" strokeWidth={1} color={ring} />
        <Circle cx={c} cy={c} r={106}><RadialGradient c={vec(c - 34, c - 42)} r={160} colors={['#FFFFFF', '#F7F3EC', '#E6DDD0', '#CBBFAD']} positions={[0, 0.35, 0.72, 1]} /></Circle>
        <Circle cx={c} cy={c} r={106} style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.85)" />
      </Group>
    </Canvas>
  </View>;
}

const styles = StyleSheet.create({ hold: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' } });
