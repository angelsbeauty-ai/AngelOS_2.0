import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { ORB_GLSL } from './orbShader';
import { useOrbMotion, type OrbFrame, type OrbState } from './orbMotion';

/**
 * Web build of the HD smoke-ring orb: the same generated shader (GLSL twin of the SkSL) on a WebGL canvas
 * sized in device pixels (320 pt × devicePixelRatio). No CSS blur/filters; softness comes from the shader.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed, level }: { size?: number; state?: OrbState; dimmed?: boolean; level?: () => number }) {
  const { mode } = useAppearance();
  const C = 320; const R = 100;
  const ref = useRef<HTMLCanvasElement | null>(null);
  const gl = useRef<{ g: WebGLRenderingContext; u: Record<string, WebGLUniformLocation | null>; dpr: number } | null>(null);
  const night = useRef(mode === 'night'); night.current = mode === 'night';
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = (globalThis as any).devicePixelRatio || 1;
    cv.width = Math.round(C * dpr); cv.height = Math.round(C * dpr);
    const g = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null; if (!g) return;
    const sh = (type: number, src: string) => { const s = g.createShader(type)!; g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.warn(g.getShaderInfoLog(s)); return s; };
    const p = g.createProgram()!;
    g.attachShader(p, sh(g.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }'));
    g.attachShader(p, sh(g.FRAGMENT_SHADER, ORB_GLSL)); g.linkProgram(p); g.useProgram(p);
    const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(p, 'a'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    const u: Record<string, WebGLUniformLocation | null> = {}; ['uT', 'uPhase', 'uL', 'uScale', 'uR', 'uRes', 'uNight', 'uDpr'].forEach((k) => { u[k] = g.getUniformLocation(p, k); });
    g.viewport(0, 0, cv.width, cv.height);
    gl.current = { g, u, dpr };
    return () => { gl.current = null; };
  }, []);
  const draw = useCallback((f: OrbFrame) => {
    const c = gl.current; if (!c) return; const { g, u, dpr } = c;
    g.uniform1f(u.uT, f.t); g.uniform1f(u.uPhase, f.phase); g.uniform1f(u.uL, f.L); g.uniform1f(u.uScale, f.scale);
    g.uniform1f(u.uR, R * dpr); g.uniform2f(u.uRes, C * dpr, C * dpr); g.uniform1f(u.uNight, night.current ? 1 : 0); g.uniform1f(u.uDpr, 1);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLES, 0, 3);
  }, []);
  useOrbMotion(state, level, draw);
  return <View accessibilityElementsHidden style={[styles.hold, { width: size, height: size, opacity: dimmed ? 0.4 : 1 }]}>
    <canvas ref={ref} style={{ width: C, height: C, margin: (size - C) / 2, flexShrink: 0 }} />
  </View>;
}

const styles = StyleSheet.create({ hold: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' } });
