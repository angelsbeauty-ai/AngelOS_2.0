import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppearance } from '../design/appearance';

/**
 * Living voice orb. A soft light that drifts and swells, like ChatGPT voice mode.
 * It stays quiet while waiting and moves more when the assistant is listening.
 */
export function VoiceOrb({ size = 240, state = 'idle', dimmed }: { size?: number; state?: 'idle' | 'connecting' | 'live' | 'error'; dimmed?: boolean }) {
  const { mode } = useAppearance();
  const night = mode === 'night';
  const live = state === 'live';
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pace = live ? 900 : state === 'connecting' ? 1400 : 2600;
    const loop = (v: Animated.Value, duration: number) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    const one = loop(a, pace);
    const two = loop(b, pace * 1.35);
    const three = loop(c, pace * 0.8);
    one.start(); two.start(); three.start();
    return () => { one.stop(); two.stop(); three.stop(); };
  }, [a, b, c, live, state]);

  const travel = live ? size * 0.16 : size * 0.07;
  const swell = live ? [0.86, 1.16] : [0.94, 1.06];
  const move = (v: Animated.Value, dx: number, dy: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, -dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-dy, dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: swell }) }
    ]
  });
  const colors = night
    ? ['rgba(120,170,255,0.85)', 'rgba(210,225,255,0.55)', 'rgba(170,140,255,0.55)', 'rgba(80,210,255,0.40)']
    : ['rgba(120,176,255,0.90)', 'rgba(255,255,255,0.80)', 'rgba(186,170,255,0.62)', 'rgba(150,220,255,0.50)'];

  return <View accessibilityElementsHidden style={[styles.hold, { width: size, height: size, opacity: dimmed ? 0.4 : 1 }]}>
    <View pointerEvents="none" style={[styles.glow, { width: size * 0.92, height: size * 0.92, borderRadius: size, backgroundColor: night ? 'rgba(90,140,255,0.22)' : 'rgba(150,190,255,0.28)' }]} />
    <View style={[styles.clip, { width: size * 0.72, height: size * 0.72, borderRadius: size }]}>
      <Animated.View style={[styles.blob, { width: size * 0.62, height: size * 0.62, backgroundColor: colors[0], left: size * 0.04, top: size * 0.06 }, move(a, travel, travel * 0.7)]} />
      <Animated.View style={[styles.blob, { width: size * 0.5, height: size * 0.5, backgroundColor: colors[1], right: size * 0.02, top: size * 0.08 }, move(b, travel * 0.8, travel)]} />
      <Animated.View style={[styles.blob, { width: size * 0.46, height: size * 0.46, backgroundColor: colors[2], left: size * 0.12, bottom: size * 0.02 }, move(c, travel * 0.6, travel * 0.9)]} />
      <Animated.View style={[styles.blob, { width: size * 0.28, height: size * 0.28, backgroundColor: colors[3], right: size * 0.12, bottom: size * 0.1 }, move(a, travel * 0.4, travel * 0.5)]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hold: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 }
});
