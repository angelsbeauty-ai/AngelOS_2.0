/** Pure geometry for the smoke-ring voice orb (shared by the app and the preview harness). */
export type Wisp = { d: string; w: number; o: number };
export type Particle = { x: number; y: number; r: number; o: number };

const TAU = Math.PI * 2;
/** Cheap smooth pseudo-noise around the ring: a few sines with drifting phases. */
function n(theta: number, t: number, seed: number) {
  return Math.sin(theta * 3 + t * 0.9 + seed) * 0.5 + Math.sin(theta * 5 - t * 1.3 + seed * 2.1) * 0.3 + Math.sin(theta * 9 + t * 2.1 + seed * 3.7) * 0.2;
}
/** Lopsided band weight: thickest at the lower left, thinnest at the upper right (like the reference). */
const weight = (th: number) => 0.32 + 0.68 * Math.pow((1 + Math.cos(th - Math.PI * 0.72)) / 2, 1.3);
/** Flame tongues licking outward, drifting around the ring. */
const flame = (th: number, t: number, seed: number) => Math.pow(Math.max(0, Math.sin(th * 7 + t * 1.7 + seed)), 6) * 0.7 + Math.pow(Math.max(0, Math.sin(th * 4 - t * 1.1 + seed * 1.9)), 8) * 0.5;

const pt = (c: number, th: number, r: number) => `${(c + Math.cos(th) * r).toFixed(1)} ${(c + Math.sin(th) * r).toFixed(1)}`;

/** phase: accumulated flow time (advances faster when loud). level: smoothed 0..1 voice level. */
export function smokeRing(size: number, phase: number, level: number, count = 14) {
  const c = size / 2; const base = size * 0.33 * (1 + level * 0.14);
  const amp = size * (0.014 + level * 0.05); const band = size * (0.075 + level * 0.05);
  const pts = 120;
  const ring = (k: number, off: number, ampK: number, flameK: number) => {
    let d = '';
    for (let i = 0; i <= pts; i++) {
      const th = (i / pts) * TAU; const w = weight(th);
      const ripple = level * Math.sin(th * 6 - phase * 4 + k) * size * 0.018;
      const r = base + off * w + n(th, phase + k * 0.7, k * 1.3) * amp * ampK * (0.5 + w) + flame(th, phase, k * 0.9) * size * 0.06 * flameK * w * (1 + level) + ripple;
      d += `${i ? 'L' : 'M'}${pt(c, th, r)}`;
    }
    return d + 'Z';
  };
  const wisps: Wisp[] = [];
  for (let k = 0; k < count; k++) {
    const f = k / (count - 1) - 0.5; const outer = f > 0.15;
    wisps.push({ d: ring(k, f * band, 0.5 + (k % 3) * 0.45, outer ? 0.6 + f : 0.1), w: 0.7 + (k % 4) * 0.6, o: 0.22 + (1 - Math.abs(f) * 1.6) * 0.38 + level * 0.15 });
  }
  /** Soft white cores: filled lopsided bands (thick lower left, thin upper right), drawn blurred. k = band width factor. */
  const fillBand = (k: number, seed: number) => {
    let o = ''; let inn = '';
    for (let i = 0; i <= pts; i++) {
      const th = (i / pts) * TAU; const w = weight(th); const wob = n(th, phase + seed, seed) * amp * 0.7;
      o += `${i ? 'L' : 'M'}${pt(c, th, base + wob + band * k * w * 0.62 + flame(th, phase, seed) * size * 0.03 * w)}`;
      inn += `${i ? 'L' : 'M'}${pt(c, -th, base + n(-th, phase + seed, seed) * amp * 0.7 - band * k * w * 0.42)}`;
    }
    return `${o}Z${inn}Z`;
  };
  const cores = [fillBand(1, 0.3), fillBand(0.45, 1.1)];
  /** Curls: a few short spiralling strands that peel off outward and fade, cycling around the ring. */
  const curls: Wisp[] = [];
  const curlN = 3 + Math.round(level * 4);
  for (let i = 0; i < curlN; i++) {
    const life = (phase * 0.22 + i * 0.41) % 1; const th0 = (i * 2.2 + Math.floor(phase * 0.22 + i * 0.41) * 1.7) % TAU;
    const w = weight(th0); let d = ''; const len = 14;
    for (let j = 0; j <= len; j++) { const u = j / len; const th = th0 + u * 0.55 * (1 + life); const r = base + band * 0.3 * w + u * u * size * (0.05 + life * 0.08) * (0.6 + w) + Math.sin(u * 5 + phase) * size * 0.008;
      d += `${j ? 'L' : 'M'}${pt(c, th, r)}`; }
    curls.push({ d, w: 1 + w, o: Math.sin(life * Math.PI) * (0.35 + level * 0.3) });
  }
  const particles: Particle[] = [];
  const pc = Math.round(level * 18);
  for (let i = 0; i < pc; i++) {
    const th = (i * 2.399 + phase * 0.35) % TAU; const life = (phase * 0.8 + i * 0.37) % 1;
    const r = base + band * 0.4 + life * size * 0.14 * (0.5 + level);
    particles.push({ x: c + Math.cos(th) * r, y: c + Math.sin(th) * r, r: size * (0.004 + (i % 3) * 0.003), o: (1 - life) * 0.7 * Math.min(1, level * 1.6) });
  }
  return { wisps, glow: cores[0], cores, curls, particles };
}

/** Open arc along the ring (angles in radians), following the same wobble; used for the specular highlight and reflection. */
export function ringArc(size: number, phase: number, level: number, from: number, to: number, rOff: number) {
  const c = size / 2; const base = size * 0.33 * (1 + level * 0.14) + rOff; const amp = size * (0.014 + level * 0.05) * 0.4;
  let d = ''; const steps = 40;
  for (let i = 0; i <= steps; i++) { const th = from + ((to - from) * i) / steps; const r = base + n(th, phase, 0.4) * amp;
    d += `${i ? 'L' : 'M'}${pt(c, th, r)}`; }
  return d;
}
