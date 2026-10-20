import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { D, tokens } from '../design/theme';

/** final-D2 tab icon: accent bar above the active tab and a static count badge. */
export function TabIcon({ active, badge, children }: { active: boolean; badge?: number; children: ReactNode }) {
  return <View style={styles.wrap}>
    {children}
    {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', top: -11, width: 24, height: 1.5, backgroundColor: D.accent },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: D.text, borderWidth: 1.5, borderColor: D.bgTab, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: tokens.font.uiBold, fontSize: 10, lineHeight: 12 },
});
