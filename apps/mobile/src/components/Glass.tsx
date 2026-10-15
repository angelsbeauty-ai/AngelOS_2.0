import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { glass, tokens } from '../design/theme';

type Props = PropsWithChildren<{ kind?: 'roundButton' | 'toast' | 'menu' | 'sheet'; style?: unknown }>;

export function GlassSurface({ children, kind = 'toast', style }: Props) {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  if (useGlass) return <GlassView style={[styles.base, styles.glass, style as never]}>{children}</GlassView>;
  if (Platform.OS === 'ios') return <BlurView intensity={glass[kind].fallbackBlur} tint="light" style={[styles.base, style as never]}>{children}</BlurView>;
  if (Platform.OS === 'web') return <View style={[styles.base, styles.web as never, style as never]}>{children}</View>;
  return <View style={[styles.base, styles.solid, style as never]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  glass: { backgroundColor: tokens.color.glassTint },
  solid: { backgroundColor: tokens.color.ivorySolid },
  web: { backgroundImage: 'linear-gradient(180deg, rgba(243,237,231,0.72), rgba(243,237,231,0.5))', backdropFilter: 'blur(32px) saturate(1.7)', WebkitBackdropFilter: 'blur(32px) saturate(1.7)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 0 0 0.5px rgba(255,255,255,0.45), 0 14px 30px -16px rgba(42,39,37,0.34)' } as any
});
