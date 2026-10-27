import { View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { useOrbMotion, type OrbState } from './orbMotion';

const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d);

/** Web twin of the native pearl orb (final-D2 mockup 07), drawn with CSS radial gradients. Same sizes as VoiceOrb.tsx. */
export function VoiceOrb({ size = 240, state = 'idle', dimmed, level }: { size?: number; state?: OrbState; dimmed?: boolean; level?: () => number }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  const f = useOrbMotion(state, level);
  const C = 360; const s = fin(f.scale, 1);
  const ring = night ? 'rgba(255,255,255,0.18)' : 'rgba(120,108,92,0.22)';
  const disc = (r: number, extra: Record<string, unknown>) => ({ position: 'absolute' as const, left: C / 2 - r, top: C / 2 - r, width: r * 2, height: r * 2, borderRadius: r, ...extra });
  return <View accessibilityElementsHidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'visible', opacity: dimmed ? 0.4 : 1 }}>
    <View style={{ width: C, height: C, margin: (size - C) / 2, transform: [{ scale: s }] } as any}>
      <View style={disc(178, { backgroundImage: night ? 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0) 100%)' : 'radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(236,231,222,0.55) 70%, rgba(236,231,222,0) 100%)' }) as any} />
      <View style={disc(136, { borderWidth: 1, borderColor: ring })} />
      <View style={disc(122, { borderWidth: 1, borderColor: ring, backgroundImage: night ? 'radial-gradient(circle at 38% 35%, #5A5550 0%, #3A3733 60%, #24221F 100%)' : 'radial-gradient(circle at 38% 35%, #FBF9F5 0%, #E9E3D9 60%, #CFC5B5 100%)' }) as any} />
      <View style={disc(106, { borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.85)', backgroundImage: 'radial-gradient(circle at 34% 30%, #FFFFFF 0%, #F7F3EC 30%, #E6DDD0 65%, #CBBFAD 100%)', boxShadow: '0 18px 40px rgba(90,78,60,0.18)' }) as any} />
    </View>
  </View>;
}
