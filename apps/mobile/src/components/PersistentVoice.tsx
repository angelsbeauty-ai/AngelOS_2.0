import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { MicrophoneSlash } from 'phosphor-react-native/src/icons/MicrophoneSlash';
import { PhoneDisconnect } from 'phosphor-react-native/src/icons/PhoneDisconnect';
import { useLiveVoice, type VoiceDraft } from './LiveVoice';
import { VoiceOrb } from './VoiceOrb';
import { VoiceOverlay, resolveVoiceVisual } from '../../app/voice';
import { getActiveWorkspace } from '../lib/workspace';
import { getBriefing } from '../lib/home';
import { useAppearance } from '../design/appearance';
import { useInsets } from '../lib/insets';
import { tokens } from '../design/theme';

export const VOICE_MINI_BAR = 56;

type Presentation = 'hidden' | 'overlay' | 'minimized';

type PersistentVoiceValue = {
  voice: ReturnType<typeof useLiveVoice>;
  presentation: Presentation;
  startOrExpand: (opts?: { screen?: string; context?: string; threadId?: string }) => Promise<void>;
  minimize: () => void;
  expand: () => void;
  end: () => void;
  barHeight: number;
  showResume: boolean;
};

const Ctx = createContext<PersistentVoiceValue | null>(null);

export function usePersistentVoice() {
  const value = useContext(Ctx);
  if (!value) throw new Error('PersistentVoiceProvider is required');
  return value;
}

export function usePersistentVoiceOptional() {
  return useContext(Ctx);
}

export function PersistentVoiceProvider({ children }: { children: ReactNode }) {
  const insets = useInsets();
  const { palette } = useAppearance();
  const [ws, setWs] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<Presentation>('hidden');
  const [showResume, setShowResume] = useState(false);
  const expectingSettings = useRef(false);
  const voice = useLiveVoice(ws, 'home', undefined, undefined);
  useEffect(() => { void getActiveWorkspace().then((w) => setWs(w.id)).catch(() => setWs(null)); }, []);

  const sessionOn = voice.state === 'connecting' || voice.state === 'live' || voice.state === 'error';

  const startOrExpand = useCallback(async (opts?: { screen?: string; context?: string; threadId?: string }) => {
    if (sessionOn) { setPresentation('overlay'); return; }
    setPresentation('overlay');
    let ctx = opts?.context;
    if (!opts?.threadId && ctx === undefined && ws) {
      const briefing = await getBriefing(ws).catch(() => null);
      ctx = briefing?.facts?.join('\n');
    }
    await voice.start({ screen: opts?.screen ?? (opts?.threadId ? 'chat' : 'home'), context: ctx, threadId: opts?.threadId });
  }, [sessionOn, voice, ws]);

  const minimize = useCallback(() => { if (presentation !== 'hidden') setPresentation('minimized'); }, [presentation]);
  const expand = useCallback(() => { if (presentation !== 'hidden') setPresentation('overlay'); }, [presentation]);
  const end = useCallback(() => { voice.stop(); setPresentation('hidden'); setShowResume(false); }, [voice]);

  const micDenied = voice.state === 'error' && /microphone is off|permission denied|notallowederror|microphone access/i.test(voice.error ?? '');
  useEffect(() => {
    if (!micDenied) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setShowResume(true);
      expectingSettings.current = false;
    });
    return () => sub.remove();
  }, [micDenied]);

  const bar = presentation === 'minimized' ? VOICE_MINI_BAR : 0;

  return (
    <Ctx.Provider value={{ voice, presentation, startOrExpand, minimize, expand, end, barHeight: bar, showResume }}>
      <View style={{ flex: 1, paddingTop: bar }}>
        {children}
        {presentation === 'minimized' ? (
          <View style={[styles.barWrap, { top: 0, height: insets.top + VOICE_MINI_BAR, paddingTop: insets.top, backgroundColor: palette.bg, borderBottomColor: palette.border }]} pointerEvents="box-none">
            <VoiceMiniBar voice={voice} onExpand={expand} onEnd={end} />
          </View>
        ) : null}
        <Modal visible={presentation === 'overlay'} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={minimize}>
          <SafeAreaProvider>
            <VoiceOverlay
              voice={voice as any}
              onMinimize={minimize}
              onEnd={end}
              showResume={showResume}
              onResume={() => { setShowResume(false); void voice.start(); }}
            />
          </SafeAreaProvider>
        </Modal>
      </View>
    </Ctx.Provider>
  );
}

export function VoiceMiniBar({ voice, onExpand, onEnd }: { voice: ReturnType<typeof useLiveVoice>; onExpand: () => void; onEnd: () => void }) {
  const { palette } = useAppearance();
  const visual = resolveVoiceVisual(voice);
  const status = visual === 'connecting' ? 'Connecting' : visual === 'speaking' ? 'Speaking' : visual === 'muted' ? 'Muted' : visual === 'error' ? 'Connection interrupted' : visual === 'mic-denied' ? 'Microphone off' : 'Listening';
  const muteLabel = visual === 'mic-denied' ? 'Microphone access is off. Open Settings to enable' : voice.muted ? 'Unmute' : 'Mute';
  return (
    <View style={[styles.bar, { backgroundColor: palette.bg }]} accessibilityRole="toolbar" accessibilityLabel="AngelOS voice session">
      <Pressable accessibilityRole="button" accessibilityLabel={`Expand AngelOS voice, ${status}`} onPress={onExpand} style={styles.expand}>
        <View style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden' }}><VoiceOrb state={voice.state} dimmed={false} level={voice.getLevel} size={38} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.status, { color: palette.text }]}>{status}</Text>
          <Text style={[styles.sub, { color: palette.muted }]}>AngelOS · tap to expand</Text>
        </View>
        <CaretUp size={16} color={palette.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={muteLabel} onPress={() => voice.setMuted(!voice.muted)} style={[styles.barBtn, { borderWidth: 1, borderColor: palette.border, borderRadius: 15 }]}>
        {voice.muted || visual === 'mic-denied' ? <MicrophoneSlash size={18} color={palette.text} /> : <Microphone size={18} color={palette.text} />}
        <Text style={[styles.barBtnLabel, { color: palette.text }]}>{visual === 'mic-denied' ? 'Mic off' : voice.muted ? 'Unmute' : 'Mute'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="End voice" onPress={onEnd} style={[styles.barBtn, { backgroundColor: palette.text, borderRadius: 15 }]}>
        <PhoneDisconnect size={18} color={palette.bg} />
        <Text style={[styles.barBtnLabel, { color: palette.bg }]}>End</Text>
      </Pressable>
    </View>
  );
}

export function VoiceApproveCard({ draft, recipient, onApprove, onNotNow, onEdit }: {
  draft: VoiceDraft;
  recipient: string;
  onApprove: () => void;
  onNotNow: () => void;
  onEdit: () => void;
}) {
  const { palette } = useAppearance();
  return (
    <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border }]} accessibilityRole="summary" accessibilityLabel="Review before sending">
      <Text style={[styles.eyebrow, { color: palette.muted }]}>REVIEW BEFORE SENDING</Text>
      <Text style={[styles.to, { color: palette.text }]}>{`Reply to ${recipient}`}</Text>
      {draft.meaning ? <Text style={[styles.meaning, { color: palette.text }]}>{draft.meaning}</Text> : null}
      <Text style={[styles.body, { color: palette.text }]}>{draft.body}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={onEdit} style={[styles.cardBtn, { borderColor: palette.border }]}><Text style={[styles.cardBtnText, { color: palette.text }]}>Edit</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onNotNow} style={[styles.cardBtn, { borderColor: palette.border }]}><Text style={[styles.cardBtnText, { color: palette.text }]}>Not now</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Approve" onPress={onApprove} style={[styles.cardBtn, { backgroundColor: palette.text, borderColor: palette.text }]}><Text style={[styles.cardBtnText, { color: palette.bg }]}>{draft.state === 'sending' ? 'Sending…' : draft.state === 'error' ? 'Try again' : 'Approve'}</Text></Pressable>
      </View>
      <Text style={[styles.note, { color: palette.muted }]}>Nothing is sent without on-screen Approve. Saying yes out loud is not enough.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: { position: 'absolute', left: 0, right: 0, zIndex: 40, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { minHeight: VOICE_MINI_BAR, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, gap: 7 },
  expand: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  status: { fontFamily: tokens.font.uiSemibold, fontSize: 15, lineHeight: 20 },
  sub: { ...tokens.type.footnote, fontFamily: tokens.font.ui },
  barBtn: { width: 44, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  barBtnLabel: { fontSize: 9, lineHeight: 12, fontFamily: tokens.font.ui },
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 8, marginHorizontal: 16, marginBottom: 8 },
  eyebrow: { ...tokens.type.overline, fontFamily: tokens.font.uiSemibold, letterSpacing: 1.2 },
  to: { fontFamily: tokens.font.uiSemibold, fontSize: 16, lineHeight: 22 },
  meaning: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 6, marginTop: 6 },
  cardBtn: { flex: 1, minHeight: 44, minWidth: 44, paddingHorizontal: 8, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardBtnText: { fontSize: 13, lineHeight: 18, fontFamily: tokens.font.uiSemibold },
  note: { ...tokens.type.footnote, fontFamily: tokens.font.ui },
});
