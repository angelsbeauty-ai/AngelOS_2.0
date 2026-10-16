/** Pure geometry for the smoke-ring voice orb (shared by the app and the preview harness). */
export type Wisp = { d: string; w: number; o: number };
export type Particle = { x: number; y: number; r: number; o: number };

const TAU = Math.PI * 2;
/** Cheap smooth pseudo-noise around the ring: a few sines with drifting phases. */
function n(theta: number, t: number, seed: number) {
  return Math.sin(theta * 3 + t * 0.9 + seed) * 0.5 + Math.sin(theta * 5 - t * 1.3 + seed * 2.1) * 0.3 + Math.sin(theta * 9 + t * 2.1 + seed * 3.7) * 0.2;
}

/** phase: accumulated flow time (advances faster when loud). level: smoothed 0..1 voice level. */
export function smokeRing(size: number, phase: number, level: number, count = 9): { wisps: Wisp[]; glow: string; particles: Particle[] } {
  const c = size / 2; const base = size * 0.33 * (1 + level * 0.14);
  const amp = size * (0.012 + level * 0.06);
  const pts = 96;
  const ring = (k: number, rOff: number, ampK: number) => {
    let d = '';
    for (let i = 0; i <= pts; i++) {
      const th = (i / pts) * TAU;
      const ripple = level * Math.sin(th * 6 - phase * 4 + k) * size * 0.02;
      const r = base + rOff + n(th, phase + k * 0.7, k * 1.3) * amp * ampK + ripple;
      d += `${i ? 'L' : 'M'}${(c + Math.cos(th) * r).toFixed(1)} ${(c + Math.sin(th) * r).toFixed(1)}`;
    }
    return d + 'Z';
  };
  const wisps: Wisp[] = [];
  for (let k = 0; k < count; k++) {
    const off = (k / (count - 1) - 0.5) * size * (0.05 + level * 0.05);
    wisps.push({ d: ring(k, off, 0.6 + (k % 3) * 0.4), w: 0.8 + (k % 3) * 0.7, o: 0.18 + (k % 4) * 0.08 + level * 0.15 });
  }
  const particles: Particle[] = [];
  const pc = Math.round(level * 18);
  for (let i = 0; i < pc; i++) {
    const th = (i * 2.399 + phase * 0.35) % TAU; const life = (phase * 0.8 + i * 0.37) % 1;
    const r = base + size * 0.02 + life * size * 0.14 * (0.5 + level);
    particles.push({ x: c + Math.cos(th) * r, y: c + Math.sin(th) * r, r: size * (0.004 + (i % 3) * 0.003), o: (1 - life) * 0.7 * Math.min(1, level * 1.6) });
  }
  return { wisps, glow: ring(99, 0, 0.8), particles };
}

/** Open arc along the ring (angles in radians), following the same wobble; used for the specular highlight and reflection. */
export function ringArc(size: number, phase: number, level: number, from: number, to: number, rOff: number) {
  const c = size / 2; const base = size * 0.33 * (1 + level * 0.14) + rOff; const amp = size * (0.012 + level * 0.06) * 0.5;
  let d = ''; const steps = 40;
  for (let i = 0; i <= steps; i++) { const th = from + ((to - from) * i) / steps; const r = base + n(th, phase, 0.4) * amp;
    d += `${i ? 'L' : 'M'}${(c + Math.cos(th) * r).toFixed(1)} ${(c + Math.sin(th) * r).toFixed(1)}`; }
  return d;
}
