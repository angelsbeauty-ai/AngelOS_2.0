import AsyncStorage from '@react-native-async-storage/async-storage';
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
};

const day: Palette = {
  bg: '#F3F4F6',
  text: '#151515',
  muted: '#6B645B',
  glass: 'rgba(255,255,255,0.52)',
  border: 'rgba(255,255,255,0.82)',
  fill: 'rgba(255,255,255,0.38)',
  icon: '#151515',
  blur: 32,
  tint: 'light',
  orb: 'rgba(255,255,255,0.95)',
  orb2: 'rgba(186,204,220,0.62)'
};

const night: Palette = {
  bg: '#050506',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  glass: 'rgba(18,18,20,0.46)',
  border: 'rgba(255,255,255,0.16)',
  fill: 'rgba(255,255,255,0.05)',
  icon: '#F4F4F5',
  blur: 42,
  tint: 'dark',
  orb: 'rgba(255,255,255,0.07)',
  orb2: 'rgba(70,70,78,0.45)'
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
