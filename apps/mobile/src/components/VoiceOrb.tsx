import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppearance } from '../design/appearance';
import { ringArc, smokeRing } from './smokeRing';

/**
 * Voice orb: a thin wispy smoke ring with a hollow centre (white on night, charcoal on daylight).
 * Reacts to the live voice level at ~60fps: louder swells the ring, speeds the flow, adds ripples and shed particles.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed, level }: { size?: number; state?: 'idle' | 'connecting' | 'live' | 'error'; dimmed?: boolean; /** Returns the current 0..1 voice level (mic while she talks, assistant output while it speaks). */ level?: () => number }) {
  const { mode } = useAppearance();
  const ink = mode === 'night' ? '#FFFFFF' : '#2B2B2B';
  const [frame, setFrame] = useState({ phase: 0, lv: 0 });
  const s = useRef({ phase: 0, lv: 0, last: 0 });
  const live = state === 'live';
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      const st = s.current; const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016; st.last = now;
      const raw = live && level ? Math.max(0, Math.min(1, level())) : 0;
      // Fast attack, slower release, so speech reads as breathing rather than flicker.
      st.lv += (raw - st.lv) * (raw > st.lv ? 0.35 : 0.08);
      st.phase += dt * (0.35 + st.lv * 3.2 + (state === 'connecting' ? 0.4 : 0));
      setFrame({ phase: st.phase, lv: st.lv });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [live, level, state]);
  const ring = smokeRing(size, frame.phase, frame.lv);
  return <View accessibilityElementsHidden style={[styles.hold, { width: size, height: size, opacity: dimmed ? 0.4 : 1 }]}>
    <Svg width={size} height={size}>
      <Defs>
        <Filter id="orbGlow" x="-20%" y="-20%" width="140%" height="140%"><FeGaussianBlur stdDeviation={size * 0.03} /></Filter>
        <LinearGradient id="orbSpec" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.95" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></LinearGradient>
        <Filter id="orbSoft" x="-10%" y="-10%" width="120%" height="120%"><FeGaussianBlur stdDeviation={size * 0.006} /></Filter>
      </Defs>
      <Path d={ring.glow} stroke={ink} strokeOpacity={0.22 + frame.lv * 0.25} strokeWidth={size * (0.05 + frame.lv * 0.04)} fill="none" filter="url(#orbGlow)" />
      <G filter="url(#orbSoft)">{ring.wisps.map((w, i) => <Path key={i} d={w.d} stroke={ink} strokeOpacity={Math.min(1, w.o)} strokeWidth={w.w} fill="none" />)}</G>
      {/* Glassy sheen: thin specular arc on the top edge, a soft wide sheen under it, and a faint reflection low inside. */}
      <Path d={ringArc(size, frame.phase, frame.lv, Math.PI * 1.15, Math.PI * 1.85, -size * 0.012)} stroke="url(#orbSpec)" strokeWidth={size * 0.03} strokeLinecap="round" fill="none" opacity={mode === 'night' ? 0.18 : 0.5} filter="url(#orbSoft)" />
      <Path d={ringArc(size, frame.phase, frame.lv, Math.PI * 1.25, Math.PI * 1.75, -size * 0.012)} stroke="url(#orbSpec)" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={mode === 'night' ? 0.85 : 0.95} />
      <Path d={ringArc(size, frame.phase, frame.lv, Math.PI * 0.3, Math.PI * 0.7, -size * 0.05)} stroke={ink} strokeOpacity={0.08} strokeWidth={size * 0.02} strokeLinecap="round" fill="none" filter="url(#orbGlow)" />
      {ring.particles.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={ink} fillOpacity={p.o} />)}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({ hold: { alignItems: 'center', justifyContent: 'center' } });
