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
  return <View style={[styles.base, styles.solid, style as never]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  glass: { backgroundColor: tokens.color.glassTint },
  solid: { backgroundColor: tokens.color.ivorySolid }
});
