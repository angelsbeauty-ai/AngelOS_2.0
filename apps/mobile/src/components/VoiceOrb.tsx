import { useMemo } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useAppearance } from '../design/appearance';
import { ORB_SKSL } from './orbShader';
import { useOrbMotion, type OrbState } from './orbMotion';

// RuntimeEffect.Make returns null when the shader does not compile; never let that (or a throw) take down the screen.
const effect = (() => { try { return Skia.RuntimeEffect.Make(ORB_SKSL); } catch { return null; } })();
const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d);

/**
 * HD smoke-ring orb (ORB_HD_SPEC): one SkSL runtime shader ported 1:1 from the Designer's orbhd.py,
 * drawn by Skia at the full device pixel ratio. Softness comes from the shader field, never from a blur.
 * Canvas 320 pt, ring radius 100 pt; the layout box stays `size` so the screen does not move.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed, level }: { size?: number; state?: OrbState; dimmed?: boolean; level?: () => number }) {
  const { mode } = useAppearance();
  const f = useOrbMotion(state, level);
  const C = 320; const R = 100; const dpr = PixelRatio.get();
  // Skia canvases are in points with the DPR transform applied, so the shader works in points and AA widths scale by 1/dpr.
  const uniforms = useMemo(() => ({ uT: fin(f.t, 0), uPhase: fin(f.phase, 0), uL: Math.max(0, Math.min(1, fin(f.L, 0))), uScale: fin(f.scale, 1), uR: R, uRes: [C, C], uNight: mode === 'night' ? 1 : 0, uDpr: dpr }), [f, mode, dpr]);
  if (!effect) return <View style={{ width: size, height: size }} />;
  return <View accessibilityElementsHidden style={[styles.hold, { width: size, height: size, opacity: dimmed ? 0.4 : 1 }]}>
    <Canvas style={{ width: C, height: C, margin: (size - C) / 2 }}>
      <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
    </Canvas>
  </View>;
}

const styles = StyleSheet.create({ hold: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' } });
