import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/** Normal chat composer: text field + send. Matches IG / Messenger. */
export function ChatBar({
  value, onChangeText, placeholder, onSend, disabled, onTools
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSend: () => void;
  disabled?: boolean;
  onTools?: () => void;
}) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <View style={[styles.bar, night && { backgroundColor: '#0C0C0E', borderTopColor: palette.border }]}>
      {onTools ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tools" onPress={onTools} style={styles.tools}>
          <View style={[styles.dot, night && { backgroundColor: palette.muted }]} />
          <View style={[styles.dot, night && { backgroundColor: palette.muted }]} />
          <View style={[styles.dot, night && { backgroundColor: palette.muted }]} />
        </Pressable>
      ) : null}
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        multiline
        style={[styles.input, night && { backgroundColor: palette.fill, color: palette.text, borderColor: palette.border }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!canSend} onPress={onSend} style={[styles.send, canSend && styles.sendOn, night && canSend && { backgroundColor: '#F4F4F5' }]}>
        <View style={[styles.arrow, canSend && (night ? styles.arrowDark : styles.arrowLight)]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDED', backgroundColor: '#FFFFFF' },
  tools: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 3, marginBottom: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#8E8E93' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: tokens.font.ui, fontSize: 16, backgroundColor: '#F2F2F7' },
  send: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E5EA', marginBottom: 2 },
  sendOn: { backgroundColor: '#151515' },
  arrow: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#8E8E93', marginLeft: 2 },
  arrowLight: { borderLeftColor: '#FFFFFF' },
  arrowDark: { borderLeftColor: '#151515' }
});
