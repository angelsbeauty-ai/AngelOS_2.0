import { StyleSheet, View } from 'react-native';
import { D } from '../design/theme';

/**
 * Placeholder for the voice orb. A new animated orb design is coming; this stays a plain circle until then.
 * Props are the states the final orb will need.
 */
export function VoiceOrb({ size = 240, dimmed }: { size?: number; state?: 'idle' | 'connecting' | 'live' | 'error'; dimmed?: boolean }) {
  return <View accessibilityElementsHidden style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }, dimmed && { opacity: 0.5 }]} />;
}

const styles = StyleSheet.create({ orb: { backgroundColor: D.fill, borderWidth: 1, borderColor: D.hairline } });
