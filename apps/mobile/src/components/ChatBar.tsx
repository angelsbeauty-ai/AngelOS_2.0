import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Waveform } from 'phosphor-react-native/src/icons/Waveform';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/**
 * The single approved chat bar (Messages + Assistant): round + (44), 44pt pill with the field,
 * and a 36pt circle in a 44pt tap area — white in Night, dark in Day — showing a waveform
 * that turns into the send arrow once text is typed.
 */
export function ChatBar({
  value, onChangeText, placeholder, onSend, disabled, onPlus, onVoice, onHoldStart, onHoldEnd, recording
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSend: () => void;
  disabled?: boolean;
  onPlus?: () => void;
  /** Waveform action when the field is empty (voice). Without it the waveform is shown inactive. */
  onVoice?: () => void;
  /** Hold-to-dictate: press and hold the waveform to talk, release to stop. Only fills the field; never sends. */
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  recording?: boolean;
}) {
  const { t } = useTranslation();
  const { mode, palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const night = mode === 'night';
  const hasText = value.trim().length > 0;
  const canSend = hasText && !disabled;
  const circle = night ? '#FFFFFF' : '#151515';
  const glyph = night ? '#151515' : '#FFFFFF';
  const fieldBg = night ? '#1C1C1E' : '#FFFFFF';
  const fieldBorder = night ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const holding = useRef(false);
  const voiceOnly = !hasText || Boolean(recording);
  const active = voiceOnly ? (Boolean(onVoice) || Boolean(onHoldStart)) && !disabled : canSend;
  return (
    <View style={[styles.wrap, { backgroundColor: night ? '#000000' : '#F3F3F3', paddingBottom: Math.max(insets.bottom, 8) }]}>
      {onPlus ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('messages.add', { defaultValue: 'Add' })} onPress={onPlus} style={[styles.plus, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
          <Plus size={22} color={palette.text} />
        </Pressable>
      ) : null}
      <View style={[styles.pill, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
        <TextInput
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={night ? '#9A9A9F' : '#6C6C70'}
          multiline
          style={[styles.input, { color: palette.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceOnly ? (onHoldStart ? t('messages.holdToDictate', { defaultValue: 'Hold to dictate' }) : t('messages.voiceSoon', { defaultValue: 'Voice messages' })) : t('messages.send', { defaultValue: 'Send' })}
          accessibilityState={{ disabled: !active }}
          disabled={!active}
          onPressIn={voiceOnly && onHoldStart ? () => { holding.current = true; onHoldStart(); } : undefined}
          onPressOut={() => { if (holding.current) { onHoldEnd?.(); } }}
          onPress={() => {
            // A release after holding to dictate must never send.
            if (holding.current) { holding.current = false; return; }
            if (voiceOnly) onVoice?.(); else onSend();
          }}
          style={styles.hit}
        >
          <View style={[styles.circle, { backgroundColor: recording ? '#B3261E' : circle, opacity: voiceOnly || canSend ? 1 : 0.5 }, recording && styles.recording]}>
            {voiceOnly ? <Waveform size={20} color={recording ? '#FFFFFF' : glyph} weight="bold" /> : <ArrowUp size={20} color={glyph} weight="bold" />}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 60, paddingHorizontal: 16, paddingTop: 8 },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 16 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingTop: 11, paddingBottom: 11, fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  hit: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  recording: { transform: [{ scale: 1.12 }] },
  circle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }
});
