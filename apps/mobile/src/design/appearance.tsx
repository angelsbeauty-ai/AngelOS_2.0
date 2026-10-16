import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

export type AppearanceMode = 'day' | 'night';

export type Palette = {
  bg: string;
  text: string;
  muted: string;
  glass: string;
  border: string;
  fill: string;
  icon: string;
  blur: number;
  tint: 'light' | 'dark';
  orb: string;
  orb2: string;
  orbEdge: string;
  sphereOpacity: number;
  veil: string;
  /** Subtle liquid-glass gloss: crisp hairline, bright top rim, soft inner sheen. Spread onto glass cards. */
  gloss: Record<string, unknown>;
};

function gloss(rim: string, edge: string, sheen: string): Record<string, unknown> {
  const img = `linear-gradient(180deg, ${sheen} 0%, rgba(255,255,255,0) 42%)`;
  return { boxShadow: `inset 0 1px 0 ${rim}, inset 0 0 0 0.5px ${edge}`, ...(Platform.OS === 'web' ? { backgroundImage: img } : { experimental_backgroundImage: img }) };
}

const day: Palette = {
  bg: '#F3F3F3',
  text: '#151515',
  muted: '#6B645B',
  glass: 'rgba(255,255,255,0.46)',
  border: 'rgba(255,255,255,0.82)',
  fill: 'rgba(255,255,255,0.38)',
  icon: '#151515',
  blur: 18,
  tint: 'light',
  orb: '#FFFFFF',
  orb2: '#E6E6E6',
  orbEdge: '#CFCFCF',
  sphereOpacity: 0.9,
  veil: 'rgba(243,243,243,0.18)',
  gloss: gloss('rgba(255,255,255,0.95)', 'rgba(0,0,0,0.06)', 'rgba(255,255,255,0.55)')
};

const night: Palette = {
  bg: '#050506',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  glass: 'rgba(20,20,20,0.40)',
  border: 'rgba(255,255,255,0.16)',
  fill: 'rgba(255,255,255,0.05)',
  icon: '#F4F4F5',
  blur: 24,
  tint: 'dark',
  orb: '#3C3C3C',
  orb2: '#222222',
  orbEdge: '#111111',
  sphereOpacity: 0.9,
  veil: 'rgba(5,5,5,0.2)',
  gloss: gloss('rgba(255,255,255,0.22)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.07)')
};

const KEY = 'angelos.appearance';
const Ctx = createContext<{ mode: AppearanceMode; palette: Palette; setMode: (mode: AppearanceMode) => void }>({ mode: 'day', palette: day, setMode: () => undefined });

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<AppearanceMode>('day');
  useEffect(() => { void AsyncStorage.getItem(KEY).then((v) => { if (v === 'night' || v === 'day') setModeState(v); }); }, []);
  function setMode(next: AppearanceMode) { setModeState(next); void AsyncStorage.setItem(KEY, next); }
  return <Ctx.Provider value={{ mode, palette: mode === 'night' ? night : day, setMode }}>{children}</Ctx.Provider>;
}

export function useAppearance() { return useContext(Ctx); }
