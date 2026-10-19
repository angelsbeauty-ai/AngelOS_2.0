import { Text, View, StyleSheet } from 'react-native';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

export function CalendarSyncNote() {
  const { palette } = useAppearance();
  return <View style={[styles.box, { backgroundColor: palette.glass, borderColor: palette.border }]}>
    <Text style={[styles.text, { color: palette.muted }]}>External calendar sync is not connected. Bookings and tasks in AngelOS are shown. Google or Apple Calendar sync requires a connected account and is not active yet.</Text>
  </View>;
}

const styles = StyleSheet.create({
  box: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  text: { fontFamily: tokens.font.ui, fontSize: 13, lineHeight: 18 }
});
