import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';

/**
 * Acrylic voice orb. Layered glass slices turn like the 3D sphere in the reference,
 * slow when idle and quicker while the assistant is listening.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed }: { size?: number; state?: 'idle' | 'connecting' | 'live' | 'error'; dimmed?: boolean }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const turn = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: state === 'live' ? 6400 : state === 'connecting' ? 2800 : 15000,
      easing: Easing.linear,
      useNativeDriver: true
    }));
    turn.start();
    return () => turn.stop();
  }, [state, spin]);

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: state === 'live' ? 650 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: state === 'live' ? 650 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [state, breathe]);

  const turn = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const back = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: state === 'live' ? [0.94, 1.06] : [0.98, 1.02] });
  const edge = night ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)';
  const wash = night ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.42)';
  const cool = night ? 'rgba(170,190,220,0.16)' : 'rgba(186,206,224,0.40)';
  const body = night ? 'rgba(28,28,32,0.72)' : 'rgba(255,255,255,0.62)';
  const angles = [8, 36, 72, 108, 144, 176];

  return <Animated.View accessibilityElementsHidden style={[{ width: size, height: size, opacity: dimmed ? 0.45 : 1, transform: [{ scale }] }]}>
    <View style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: body, borderColor: edge }]} />
    <View pointerEvents="none" style={[styles.shade, { width: size * 0.72, height: size * 0.72, borderRadius: size, backgroundColor: cool, top: size * 0.16, left: size * 0.08 }]} />
    <Animated.View pointerEvents="none" style={[styles.layer, { transform: [{ rotate: turn }] }]}>
      {angles.map((deg, i) => <View key={deg} style={[styles.slice, { width: size * (0.9 - (i % 3) * 0.06), height: size * 0.28, borderColor: i % 2 ? cool : edge, backgroundColor: wash, transform: [{ rotate: `${deg}deg` }] }]} />)}
    </Animated.View>
    <Animated.View pointerEvents="none" style={[styles.layer, { transform: [{ rotate: back }] }]}>
      {angles.slice(0, 3).map((deg) => <View key={deg} style={[styles.slice, { width: size * 0.55, height: size * 0.16, borderColor: edge, backgroundColor: 'transparent', transform: [{ rotate: `${deg + 18}deg` }] }]} />)}
    </Animated.View>
    <View pointerEvents="none" style={[styles.glint, { width: size * 0.34, height: size * 0.18, borderRadius: size, top: size * 0.14, left: size * 0.22, backgroundColor: night ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)' }]} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  core: { borderWidth: 1 },
  shade: { position: 'absolute' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  slice: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  glint: { position: 'absolute' }
});
