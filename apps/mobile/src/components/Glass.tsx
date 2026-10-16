import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = PropsWithChildren<{ kind?: 'roundButton' | 'toast' | 'menu' | 'sheet'; style?: unknown }>;

/** Flat white surface (Instagram light theme). Glass/blur removed app-wide. */
export function GlassSurface({ children, style }: Props) {
  return <View style={[styles.base, style as never]}>{children}</View>;
}

const styles = StyleSheet.create({ base: { overflow: 'hidden', backgroundColor: '#FFFFFF' } });
