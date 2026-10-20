import { useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion, tokens } from '../design/theme';

export type SwipeAction = { key: string; label: string; icon: ReactNode; onPress: () => void; danger?: boolean };

const ACTION_W = 76;
const SCREEN_W = Dimensions.get('window').width;

/**
 * Inbox row with Meta-style swipe-left actions (4 x 76pt, neutral grey gradient).
 * A full swipe triggers `onFullSwipe` (Done) with a medium haptic at the threshold; the row slides off.
 * No right swipe. Actions are also exposed as accessibilityActions.
 */
export function SwipeRow({ children, actions, onFullSwipe, night, height }: { children: ReactNode; actions: SwipeAction[]; onFullSwipe: () => void; night: boolean; /** Omit for auto height. */ height?: number }) {
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

  // Row slides fully left (304pt open); its content fades so nothing spills beside the tray.
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: interpolate(x.value, [-120, -24, 0], [0, 1, 1], 'clamp') }));
  const trayStyle = useAnimatedStyle(() => ({ width: Math.max(0, -x.value) }));
  // Stepped neutral greys, one solid tile per action (F02): Night #3A3A3D→#202023, Day #CCCCCE→#EFEFF1.
  const tiles = night ? ['#3A3A3D', '#323235', '#29292C', '#202023'] : ['#CCCCCE', '#D7D7D9', '#E3E3E5', '#EFEFF1'];
  const fg = night ? '#F4F4F5' : '#151515';

  return <View style={[height != null ? { height } : null, { overflow: 'hidden' }]}
    accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
    onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}>
    <Animated.View style={[styles.tray, trayStyle]}>
      {actions.map((a, i) => <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.label} onPress={() => fire(a)} style={[styles.action, { backgroundColor: tiles[i % 4] }]}>
        {a.icon}
        <Text numberOfLines={1} style={[styles.label, { color: a.danger ? '#E5484D' : fg }]}>{a.label}</Text>
      </Pressable>)}
    </Animated.View>
    <Animated.View {...responder.panHandlers} style={[height != null ? { height } : null, rowStyle]}>{children}</Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  tray: { position: 'absolute', right: 0, top: 0, bottom: 0, height: '100%', flexDirection: 'row', justifyContent: 'flex-start', overflow: 'hidden' },
  action: { width: ACTION_W, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontFamily: tokens.font.uiMedium, fontSize: 13 }
});
