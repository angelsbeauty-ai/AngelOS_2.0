import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/** One slim chat bar: + for saved replies, growing field, send arrow. 44-52pt + safe area. */
export function ChatBar({
  value, onChangeText, placeholder, onSend, disabled, onPlus
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSend: () => void;
  disabled?: boolean;
  onPlus?: () => void;
}) {
  const { mode, palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const night = mode === 'night';
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <View style={[styles.wrap, night && { backgroundColor: '#050505', borderTopColor: 'rgba(255,255,255,0.10)' }, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {onPlus ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Saved replies" onPress={onPlus} style={styles.plus}>
          <Text style={[styles.plusText, { color: palette.text }]}>+</Text>
        </Pressable>
      ) : null}
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={night ? '#9A9A9F' : '#8A8A8E'}
        multiline
        style={[styles.input, night && { backgroundColor: '#161618', color: '#F4F4F5', borderColor: 'rgba(255,255,255,0.10)' }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!canSend} onPress={onSend} style={[styles.send, canSend && styles.sendOn, night && canSend && { backgroundColor: '#F4F4F5' }]}>
        <View style={[styles.arrow, canSend && (night ? styles.arrowDark : styles.arrowLight)]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 52, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)', backgroundColor: '#F3F3F3' },
  plus: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  plusText: { fontSize: 26, fontWeight: '500', lineHeight: 28 },
  input: { flex: 1, minHeight: 36, maxHeight: 120, borderRadius: 18, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22, backgroundColor: '#FFFFFF' },
  send: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E5EA', marginBottom: 2 },
  sendOn: { backgroundColor: '#151515' },
  arrow: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#8E8E93', marginLeft: 2 },
  arrowLight: { borderLeftColor: '#FFFFFF' },
  arrowDark: { borderLeftColor: '#151515' }
});
