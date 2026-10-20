import { useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { motion, tokens } from '../design/theme';

export type SwipeAction = { key: string; label: string; icon: ReactNode; onPress: () => void };

const ACTION_W = 76;
const SCREEN_W = Dimensions.get('window').width;

/**
 * Inbox row with Meta-style swipe-left actions (4 x 76pt, neutral grey gradient).
 * A full swipe triggers `onFullSwipe` (Done) with a medium haptic at the threshold; the row slides off.
 * No right swipe. Actions are also exposed as accessibilityActions.
 */
export function SwipeRow({ children, actions, onFullSwipe, night, height = 80 }: { children: ReactNode; actions: SwipeAction[]; onFullSwipe: () => void; night: boolean; height?: number }) {
  const x = useSharedValue(0);
  const openW = actions.length * ACTION_W;
  const fullAt = Math.min(SCREEN_W * 0.7, openW + 64);
  const start = useRef(0);
  const armed = useRef(false);

  const close = () => { x.value = withSpring(0, motion.snap); };
  const fire = (a: SwipeAction) => { close(); a.onPress(); };

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = x.value; armed.current = false; },
    onPanResponderMove: (_e, g) => {
      const next = Math.min(0, start.current + g.dx);
      x.value = next;
      const past = -next >= fullAt;
      if (past !== armed.current) { armed.current = past; if (past) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); }
    },
    onPanResponderRelease: (_e, g) => {
      const pos = Math.min(0, start.current + g.dx);
      if (-pos >= fullAt) { x.value = withTiming(-SCREEN_W, { duration: motion.quick }, (done) => { if (done) runOnJS(onFullSwipe)(); }); return; }
      const open = -pos > openW / 3 || g.vx < -0.5;
      x.value = withSpring(open && g.vx < 0.5 ? -openW : 0, motion.snap);
    },
    onPanResponderTerminate: () => { x.value = withSpring(0, motion.snap); }
  }), [openW, fullAt, onFullSwipe]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const trayStyle = useAnimatedStyle(() => ({ width: Math.max(0, -x.value) }));
  const grad = night ? ['#3A3A3D', '#202023'] as const : ['#CCCCCE', '#EFEFF1'] as const;
  const fg = night ? '#F4F4F5' : '#151515';

  return <View style={{ height, overflow: 'hidden' }}
    accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
    onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}>
    <Animated.View style={[styles.tray, trayStyle]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%"><Defs><LinearGradient id="swg" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={grad[0]} /><Stop offset="1" stopColor={grad[1]} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#swg)" /></Svg>
      {actions.map((a) => <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.label} onPress={() => fire(a)} style={styles.action}>
        {a.icon}
        <Text numberOfLines={1} style={[styles.label, { color: fg }]}>{a.label}</Text>
      </Pressable>)}
    </Animated.View>
    <Animated.View {...responder.panHandlers} style={[{ height }, rowStyle]}>{children}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  tray: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontFamily: tokens.font.uiMedium, fontSize: 13 }
});
