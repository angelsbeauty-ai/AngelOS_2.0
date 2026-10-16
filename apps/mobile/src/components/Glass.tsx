import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppearance } from '../design/appearance';

type Props = PropsWithChildren<{ kind?: 'roundButton' | 'toast' | 'menu' | 'sheet'; style?: unknown }>;

/** Frosted glass. Day is white frost. Night is dark glass. */
export function GlassSurface({ children, style }: Props) {
  const { palette } = useAppearance();
  return <View style={[styles.base, { borderColor: palette.border }, palette.gloss as never, style as never]}>
    <BlurView intensity={palette.blur} tint={palette.tint} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
    {children}
  </View>;
}

const styles = StyleSheet.create({ base: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth } });
