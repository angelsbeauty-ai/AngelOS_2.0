import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing, tokens } from '../design/theme';

export function Screen({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><View style={styles.stack}>{children}</View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: tokens.color.pearl }, content: { padding: tokens.space.screen }, stack: { gap: spacing.md } });
void colors;
