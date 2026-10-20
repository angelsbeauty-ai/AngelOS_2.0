import { useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { motion } from '../design/theme';
// M39: springs follow the system Reduce Motion setting (instant when it is on).
const SNAP = { ...motion.snap, reduceMotion: ReduceMotion.System };

const TRIGGER = 56;
const MAX = 72;

/** Swipe a bubble to the right to reply (quote bar). Light haptic at the threshold. */
export function SwipeReply({ children, onReply, night, label }: { children: ReactNode; onReply: () => void; night: boolean; label: string }) {
  const x = useSharedValue(0);
  const armed = useRef(false);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { armed.current = false; },
    onPanResponderMove: (_e, g) => {
      const d = Math.max(0, g.dx); x.value = d > MAX ? MAX + (d - MAX) * 0.2 : d;
      const past = d >= TRIGGER;
      if (past !== armed.current) { armed.current = past; if (past) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }
    },
    onPanResponderRelease: () => { if (armed.current) onReply(); x.value = withSpring(0, SNAP); },
    onPanResponderTerminate: () => { x.value = withSpring(0, SNAP); }
  }), [onReply]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const icon = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, TRIGGER], [0, 1], 'clamp'), transform: [{ scale: interpolate(x.value, [0, TRIGGER], [0.6, 1], 'clamp') }] }));
  return <View accessibilityActions={[{ name: 'reply', label }]} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'reply') onReply(); }}>
    <Animated.View pointerEvents="none" style={[styles.icon, { backgroundColor: night ? '#26262A' : '#E4E4E6' }, icon]}>
      <ArrowBendUpLeft size={20} color={night ? '#F4F4F5' : '#151515'} />
    </Animated.View>
    <Animated.View {...responder.panHandlers} style={moving}>{children}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', left: 4, bottom: 18, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }
});
