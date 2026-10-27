import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, useColorScheme } from 'react-native';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useNightCss } from './night-web';

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

/** GLASS_HD_TOKENS §1: 1 pt hairline, 1 pt inner top specular rim, soft sheen gradient, mode shadow. */
function gloss(rim: string, sheen: string, shadow: string): Record<string, unknown> {
  return { borderWidth: 1, boxShadow: `inset 0 1px 0 ${rim}, ${shadow}`, ...(Platform.OS === 'web' ? { backgroundImage: sheen } : { experimental_backgroundImage: sheen }) };
}

const day: Palette = {
  bg: '#F5F3EF', // AngelOS Day: warm ivory (final-D2 mockups)
  text: '#151515',
  muted: '#6C6C70',
  glass: 'rgba(255,255,255,0.80)',
  border: 'rgba(0,0,0,0.06)',
  fill: 'rgba(255,255,255,0.38)',
  icon: '#151515',
  blur: 24,
  tint: 'light',
  orb: '#FFFFFF',
  orb2: '#E6E6E6',
  orbEdge: '#CFCFCF',
  sphereOpacity: 0.9,
  veil: 'rgba(245,243,239,0.18)',
  gloss: gloss('rgba(255,255,255,0.90)', 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 40%)', '0 6px 22px rgba(0,0,0,0.055)')
};

const night: Palette = {
  bg: '#050505',
  text: '#F4F4F5',
  muted: '#9A9A9F',
  glass: 'rgba(18,18,20,0.66)',
  border: 'rgba(255,255,255,0.11)',
  fill: 'rgba(255,255,255,0.05)',
  icon: '#F4F4F5',
  blur: 24,
  tint: 'dark',
  orb: '#3C3C3C',
  orb2: '#222222',
  orbEdge: '#111111',
  sphereOpacity: 0.9,
  veil: 'rgba(5,5,5,0.2)',
  gloss: gloss('rgba(255,255,255,0.16)', 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 35%)', '0 1px 0 rgba(0,0,0,0.40)')
};

const KEY = 'angelos.appearance';
const Ctx = createContext<{ mode: AppearanceMode; palette: Palette; setMode: (mode: AppearanceMode) => void }>({ mode: 'day', palette: day, setMode: () => undefined });

export function AppearanceProvider({ children }: PropsWithChildren) {
  useNightCss();
  // O03: Day/Night follows the system (Settings › Display). There is no in-app switch.
  // The web proof harness alone may pin a mode via localStorage so both modes can be shot.
  const system = useColorScheme();
  const [pinned, setPinned] = useState<AppearanceMode | null>(null);
  useEffect(() => { if (Platform.OS === 'web') void AsyncStorage.getItem(KEY).then((v) => { if (v === 'night' || v === 'day') setPinned(v); }); else void AsyncStorage.removeItem(KEY); }, []);
  const mode: AppearanceMode = pinned ?? (system === 'dark' ? 'night' : 'day');
  function setMode(_next: AppearanceMode) { /* system-driven */ }
  return <Ctx.Provider value={{ mode, palette: mode === 'night' ? night : day, setMode }}>{children}</Ctx.Provider>;
}

export function useAppearance() { return useContext(Ctx); }
