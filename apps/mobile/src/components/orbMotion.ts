import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export type OrbState = 'idle' | 'connecting' | 'live' | 'error';
export type OrbFrame = { t: number; phase: number; L: number; scale: number };

/**
 * ORB_HD_SPEC §3.3 motion: gated level follower (attack/release), integrated flow phase, breathing scale.
 * level() is the real 0..1 voice level (her mic or the assistant's output) from useLiveVoice.
 */
export function useOrbMotion(state: OrbState, level?: () => number, onFrame?: (f: OrbFrame) => void) {
  const [frame, setFrame] = useState<OrbFrame>({ t: 0, phase: 0, L: 0, scale: 1 });
  const s = useRef({ t: 0, phase: 0, L: 0, last: 0 });
  const [reduce, setReduce] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce); return () => sub.remove(); }, []);
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      const st = s.current; const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60; st.last = now;
      let raw = state === 'live' && level ? Math.max(0, Math.min(1, level())) : 0;
      if (raw < 0.04) raw = 0;
      const k = raw > st.L ? 0.05 : 0.2; // attack 50 ms / release 200 ms (between the mic and AI-output values in the spec)
      st.L += (raw - st.L) * (1 - Math.exp(-dt / k));
      st.t += dt;
      if (!reduce) st.phase += dt * (1 + 1.2 * st.L + (state === 'connecting' ? 0.4 : 0));
      const scale = reduce ? 1 + 0.02 * st.L : 1 + 0.015 * Math.sin((2 * Math.PI * st.t) / 3.2) + 0.04 * st.L;
      const f = { t: reduce ? 0 : st.t, phase: st.phase, L: st.L, scale };
      if (onFrame) onFrame(f); else setFrame(f);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [state, level, reduce, onFrame]);
  return frame;
}
