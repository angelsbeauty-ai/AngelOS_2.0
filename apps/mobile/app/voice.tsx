import { Pressable as EBPressable, Text as EBText, View as EBView } from 'react-native';
import { router as ebRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../src/i18n';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { MicrophoneSlash } from 'phosphor-react-native/src/icons/MicrophoneSlash';
import { PhoneDisconnect } from 'phosphor-react-native/src/icons/PhoneDisconnect';
import { useLiveVoice } from '../src/components/LiveVoice';
import { crumb, readCrumbs } from '../src/lib/crash-guard';
void crumb('voice code loaded');
import { VoiceOrb } from '../src/components/VoiceOrb';
import { AnswerCard } from '../src/components/AnswerCard';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getBriefing } from '../src/lib/home';
import { getVoiceStatus } from '../src/lib/ai';
import { ApiError } from '../src/lib/api';
import { D, N, tokens } from '../src/design/theme';
import { useAppearance } from '../src/design/appearance';
import { useInsets } from '../src/lib/insets';

export type VoiceVisual =
  | 'connecting' | 'listening' | 'speaking' | 'muted' | 'error' | 'mic-denied'
  | 'first-start' | 'thinking' | 'barge-in' | 'didnt-catch' | 'quiet-pause'
  | 'offline' | 'permission-ready' | 'audio-interruption' | 'app-return' | 'network-ready';

export type VoiceOverlayPreview = {
  visual?: VoiceVisual;
  caption?: string;
  ownerCaption?: string;
  cardEyebrow?: string;
  cardBody?: string;
  title?: string;
  sub?: string;
  showResume?: boolean;
  muted?: boolean;
};

const COPY: Record<VoiceVisual, { title: string; sub: string }> = {
  connecting: { title: 'Connecting', sub: 'Getting ready to listen.' },
  listening: { title: 'Listening', sub: 'I\u2019m here. Talk whenever you\u2019re ready.' },
  speaking: { title: 'Speaking', sub: 'Interrupt me whenever you need.' },
  muted: { title: 'You\u2019re muted', sub: 'I\u2019m still here. Unmute when you want to talk.' },
  error: { title: 'Connection interrupted', sub: 'Listening and playback are paused.' },
  'mic-denied': { title: 'Microphone access is off', sub: 'Turn it on in Settings, then come back.' },
  'first-start': { title: 'Ready when you are', sub: 'Talk to AngelOS, not to a client.' },
  thinking: { title: 'Looking that up', sub: 'You can interrupt or keep typing.' },
  'barge-in': { title: 'I\u2019m listening', sub: 'Go ahead. I stopped talking.' },
  'didnt-catch': { title: 'I didn\u2019t catch that', sub: 'Try again, or type your message.' },
  'quiet-pause': { title: 'Still here', sub: 'Take your time. I\u2019m listening.' },
  offline: { title: 'You\u2019re offline', sub: 'Voice is paused. Your conversation is safe.' },
  'permission-ready': { title: 'Microphone is ready', sub: 'Tap Resume when you want me to listen again.' },
  'audio-interruption': { title: 'Voice was interrupted', sub: 'Your conversation is still here.' },
  'app-return': { title: 'Welcome back', sub: 'Voice stayed paused so nothing starts by itself.' },
  'network-ready': { title: 'You\u2019re back online', sub: 'Tap Resume when you want me to listen again.' },
};

export function resolveVoiceVisual(input: {
  state?: string; error?: string | null; muted?: boolean; speaking?: boolean;
  status?: { available?: boolean } | null; firstStart?: boolean; notice?: string | null;
  paused?: boolean; pauseReason?: string | null; online?: boolean; processing?: boolean;
}): VoiceVisual {
  if (input.firstStart) return 'first-start';
  if (input.online === false) return 'offline';
  if (voiceErrorKind(input.error ?? null) === 'mic' && input.state === 'error') return 'mic-denied';
  if (input.state === 'error') return 'error';
  if (input.paused && input.pauseReason === 'audio') return 'audio-interruption';
  if (input.paused && input.pauseReason === 'network') return 'network-ready';
  if (input.paused && (input.pauseReason === 'settings' || input.pauseReason === 'permission')) return 'permission-ready';
  if (input.paused) return 'app-return';
  if (input.notice === 'didnt-catch') return 'didnt-catch';
  if (input.notice === 'barge-in') return 'barge-in';
  if (input.notice === 'quiet-pause') return 'quiet-pause';
  if (input.notice === 'thinking' || input.processing) return 'thinking';
  if (input.state === 'connecting') return 'connecting';
  if (input.muted) return 'muted';
  if (input.speaking) return 'speaking';
  return 'listening';
}

type OverlayVoice = {
  state: 'idle' | 'connecting' | 'live' | 'error';
  status: { available: boolean; reason?: string } | null;
  error: string | null;
  start: (next?: { screen?: string; context?: string; threadId?: string }) => void | Promise<void>;
  stop: () => void;
  interrupt?: () => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  caption?: string | null;
  ownerCaption?: string | null;
  speaking?: boolean;
  paused?: boolean;
  notice?: string | null;
  processing?: boolean;
  getLevel?: () => number;
  drafts: Array<{ messageId: string; threadId: string; body: string; meaning?: string; state: string }>;
  approveDraft: (id: string) => void | Promise<void>;
  dismissDraft: (id: string) => void;
  cards: any[];
  actions?: Array<{ id: string; summary: string; state: string }>;
  approveAction?: (id: string) => void | Promise<void>;
  dismissAction?: (id: string) => void;
};

/** ChatGPT-style live-voice overlay: Minimize keeps the session; End voice stops audio. */
export function VoiceOverlay({ voice, onMinimize, onEnd, showResume, onResume, preview, chatId, noWs, firstStart, onStartListening, online }: {
  voice: OverlayVoice;
  onMinimize: () => void;
  onEnd: () => void;
  showResume?: boolean;
  onResume?: () => void;
  preview?: VoiceOverlayPreview;
  chatId?: string;
  noWs?: boolean;
  firstStart?: boolean;
  onStartListening?: () => void;
  online?: boolean;
}) {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  const insets = useInsets();
  const visual = preview?.visual ?? resolveVoiceVisual({ ...voice, firstStart, online });
  const live = voice.state === 'live' || ['listening', 'speaking', 'muted', 'thinking', 'barge-in', 'didnt-catch', 'quiet-pause'].includes(visual);
  const off = voice.status && !voice.status.available;
  const micDenied = visual === 'mic-denied';
  const offline = visual === 'offline' || online === false;
  const [diag, setDiag] = useState<{ step: string | null; check: string | null }>({ step: null, check: null });
  const failed = visual === 'error' || visual === 'mic-denied' || !!off;
  const [ws, setWs] = useState<string | null>(null);
  useEffect(() => { void getActiveWorkspace().then((w) => setWs(w.id)).catch(() => undefined); }, []);
  useEffect(() => {
    if (!failed || !ws) { setDiag({ step: null, check: null }); return; }
    let alive = true;
    void (async () => {
      const lines = (await readCrumbs()).split('\n').map((l) => l.trim()).filter(Boolean);
      const at = lines.map((l) => l.includes(' caught: ')).lastIndexOf(true);
      const step = at > 0 ? lines[at - 1].replace(/^\S+\s+/, '') : null;
      const check = await getVoiceStatus(ws)
        .then((s) => (s.available ? 'OK (available)' : `off: ${s.reason ?? '-'}`))
        .catch((e) => (e instanceof ApiError ? `HTTP ${e.status || 'network'}: ${e.message}` : String(e instanceof Error ? e.message : e)));
      if (alive) setDiag({ step, check });
    })();
    return () => { alive = false; };
  }, [failed, ws, voice.error]);
  const details = !preview && failed && !noWs && visual === 'error' ? [
    voice.error ? `${t('voice.errReason', 'Reason')}: ${voice.error}` : null,
    diag.step ? `${t('voice.errStep', 'Stopped at')}: ${diag.step}` : null,
    diag.check ? `${t('voice.errCheck', 'Server check')}: ${diag.check}` : null,
  ].filter(Boolean).join('\n') : '';
  const copy = COPY[visual];
  const title = preview?.title ?? copy.title;
  const sub = preview?.sub ?? copy.sub;
  const spoken = preview?.caption ?? voice.caption;
  const heard = preview?.ownerCaption ?? voice.ownerCaption;
  const muted = preview?.muted ?? voice.muted;
  const micPaused = visual === 'first-start' || offline || micDenied || !live;
  const muteLabel = micDenied ? 'Microphone access is off. Open Settings to enable' : muted ? 'Unmute microphone' : 'Mute microphone';
  const muteCaption = micPaused ? 'Mic paused' : muted ? 'Unmute' : 'Mute';
  const resume = showResume ?? preview?.showResume;
  const resumeVisual = ['permission-ready', 'audio-interruption', 'app-return', 'network-ready'].includes(visual);
  const canStopReply = ['speaking', 'thinking', 'barge-in'].includes(visual);
  const showStart = visual === 'first-start';
  const showPair = Boolean(heard || spoken || preview?.cardBody) && visual !== 'first-start';

  return <View onAccessibilityEscape={onMinimize} accessibilityLabel="AngelOS live voice" accessibilityViewIsModal accessibilityActions={[{ name: 'escape', label: 'Minimize voice; keep this session' }]} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'escape') onMinimize(); }} style={[styles.page, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Minimize voice; keep this session" onPress={onMinimize} style={styles.iconBtn}>
        <CaretDown size={20} color={palette.text} />
        <Text style={[styles.minimizeLabel, { color: palette.text }]}>Minimize</Text>
      </Pressable>
      <Text style={[styles.liveTag, { color: palette.muted }]} numberOfLines={1}>AngelOS · Voice</Text>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={live ? title : 'Start talking'} disabled={noWs || !!off || voice.state === 'connecting' || live || showStart} onPress={() => { if (!live) void voice.start(); }}>
        <VoiceOrb size={140} state={voice.state === 'idle' && visual !== 'listening' ? 'connecting' : voice.state} dimmed={!!off || noWs} level={voice.getLevel} />
      </Pressable>
      <Text style={[styles.caption, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>{sub}</Text>
      {showStart ? <View style={[styles.captions, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={[styles.eyebrow, { color: palette.muted }]}>YOUR FIRST VOICE CONVERSATION</Text>
        <Text style={[styles.captionBody, { color: palette.text }]}>{"Ask about your day, a client reply or a booking. I\u2019ll speak to you in English.\n\nYou can type, attach an image or move around AngelOS while we talk."}</Text>
      </View> : null}
      {showPair ? <>
        {heard ? <><Text style={[styles.speaker, { color: palette.muted }]}>YOU · ENGLISH</Text><Text style={[styles.ownerLine, { color: palette.text }]}>{heard}</Text></> : null}
        {spoken || preview?.cardBody ? <View style={[styles.captions, { backgroundColor: palette.glass, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>{preview?.cardEyebrow ?? (visual === 'thinking' ? 'LOOKING UP YOUR DAY' : visual === 'offline' ? 'KEEP GOING IN TEXT' : visual === 'didnt-catch' ? 'ANGELOS · ENGLISH' : 'ANGELOS · LIVE ENGLISH CAPTIONS')}</Text>
          <Text style={[styles.captionBody, { color: palette.text }]}>{preview?.cardBody ?? spoken}</Text>
        </View> : null}
      </> : null}
      {visual === 'didnt-catch' ? <View style={[styles.showChat, { borderColor: palette.border, backgroundColor: palette.glass }]}><Text style={[styles.showChatText, { color: palette.text }]}>Still listening · no need to start over</Text></View> : null}
      {visual === 'muted' ? <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>Your microphone stays off as you move around AngelOS, until you unmute.</Text> : null}
      {visual === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry voice connection" disabled={offline} onPress={() => { if (!offline) void voice.start(); }} style={[styles.settingsBtn, { backgroundColor: offline ? palette.muted : palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Retry</Text>
        </Pressable>
      ) : null}
      {offline ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry connection" accessibilityState={{ disabled: true }} disabled style={[styles.settingsBtn, { backgroundColor: palette.muted }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Retry connection</Text>
        </Pressable>
      ) : null}
      {micDenied ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open microphone settings" onPress={() => void Linking.openSettings()} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Open Settings</Text>
        </Pressable>
      ) : null}
      {micDenied ? <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>Returning rechecks access.{resume ? ' Tap Resume to start listening.' : ' You can still read and type.'}</Text> : null}
      {(resume && micDenied) || resumeVisual ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Resume" onPress={onResume} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Resume</Text>
        </Pressable>
      ) : null}
      {details ? <Text selectable style={[styles.details, { color: palette.muted, borderColor: palette.border }]}>{details}</Text> : null}
      {voice.cards.length ? <View style={{ alignSelf: 'stretch', marginHorizontal: 16 }}><AnswerCard card={voice.cards[voice.cards.length - 1]} /></View> : null}
      {voice.drafts.map((d) => <View key={d.messageId} style={[styles.draft, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={[styles.draftLabel, { color: palette.muted }]}>REVIEW BEFORE SENDING</Text>
        {d.meaning ? <Text style={[styles.draftBody, { color: palette.text }]}>{d.meaning}</Text> : null}
        <Text style={[styles.draftBody, { color: palette.text }]}>{d.body}</Text>
        {d.state === 'sent' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.draftSent', 'Sent')}</Text>
          : d.state === 'manual' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.draftManual', 'Approved. Send it from the chat, this app is not connected yet.')}</Text>
          : <View style={styles.draftRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => (voice.deferDraft ? voice.deferDraft(d.messageId) : voice.dismissDraft(d.messageId))} style={styles.draftBtn}><Text style={[styles.settingsText, { color: palette.text }]}>Not now</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Approve" disabled={d.state === 'sending'} onPress={() => void voice.approveDraft(d.messageId)} style={[styles.draftBtn, { backgroundColor: palette.text }]}><Text style={[styles.settingsText, { color: palette.bg }]}>{d.state === 'sending' ? 'Sending\u2026' : d.state === 'error' ? 'Try again' : 'Approve'}</Text></Pressable>
          </View>}
      </View>)}
      {(voice.actions ?? []).map((a) => <View key={a.id} style={[styles.draft, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.actionTitle', 'Waiting for your Approve. Nothing is saved yet.')}</Text>
        <Text style={[styles.draftBody, { color: palette.text }]}>{a.summary}</Text>
        {a.state === 'done' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.actionDone', 'Approved and saved')}</Text>
          : <View style={styles.draftRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => voice.dismissAction?.(a.id)} style={styles.draftBtn}><Text style={[styles.settingsText, { color: palette.text }]}>Not now</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Approve" disabled={a.state === 'saving'} onPress={() => void voice.approveAction?.(a.id)} style={[styles.draftBtn, { backgroundColor: palette.text }]}><Text style={[styles.settingsText, { color: palette.bg }]}>{a.state === 'saving' ? 'Saving\u2026' : a.state === 'error' ? 'Try again' : 'Approve'}</Text></Pressable>
          </View>}
      </View>)}
    </ScrollView>
      {showStart ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Start listening" onPress={() => { if (onStartListening) onStartListening(); else void voice.start(); }} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Start listening</Text>
        </Pressable>
      ) : null}
    <View style={styles.pillRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Minimize and show assistant chat to type" onPress={onMinimize} style={[styles.showChat, { borderColor: palette.border, backgroundColor: palette.glass }]}>
        <Text style={[styles.showChatText, { color: palette.text }]}>Show chat & type</Text>
      </Pressable>
      {canStopReply ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Stop reply" onPress={() => voice.interrupt?.()} style={[styles.showChat, { borderColor: palette.border, backgroundColor: palette.glass }]}>
          <Text style={[styles.showChatText, { color: palette.text }]}>Stop reply</Text>
        </Pressable>
      ) : null}
    </View>
    <View style={styles.buttons}>
      <View style={styles.control}>
        <Pressable accessibilityRole="button" accessibilityLabel={muteLabel} accessibilityState={{ selected: muted }} disabled={micPaused} onPress={() => voice.setMuted(!muted)} style={[styles.round, styles.mute, { backgroundColor: palette.glass, borderColor: palette.border }, micPaused && { opacity: 0.5 }]}>
          {muted || micPaused ? <MicrophoneSlash size={24} color={palette.text} /> : <Microphone size={24} color={palette.text} />}
        </Pressable>
        <Text style={[styles.controlLabel, { color: palette.muted }]}>{muteCaption}</Text>
      </View>
      <View style={styles.control}>
        <Pressable accessibilityRole="button" accessibilityLabel="End voice session" onPress={onEnd} style={[styles.round, { backgroundColor: palette.text }]}>
          <PhoneDisconnect size={24} color={palette.bg} />
        </Pressable>
        <Text style={[styles.controlLabel, { color: palette.muted }]}>End voice</Text>
      </View>
    </View>
    <Text style={[styles.hint, { color: palette.muted, marginTop: 12 }]}>Minimize keeps the session. End stops voice.</Text>
    <Text style={[styles.hint, { color: palette.muted }]}>Inside AngelOS only · English to you</Text>
  </View>;
}

/** Voice overlay route / standalone sheet. Minimize leaves the session running when a provider owns it; End always hangs up. */
export default function VoiceScreen({ conversationId, onDismiss, preview }: { conversationId?: string; onDismiss?: () => void; preview?: VoiceOverlayPreview } = {}) {
  const [ws, setWs] = useState<string | null>(null);
  const [facts, setFacts] = useState<string | undefined>(undefined);
  const [noWs, setNoWs] = useState(false);
  useEffect(() => { void crumb('voice screen shown'); }, []);
  useEffect(() => { void getActiveWorkspace().then(async (w) => { setWs(w.id); const b = await getBriefing(w.id).catch(() => null); setFacts(b?.facts?.join('\n')); }).catch(() => setNoWs(true)); }, []);
  const { threadId } = useLocalSearchParams<{ threadId?: string }>();
  const chatId = conversationId ?? (typeof threadId === 'string' && threadId ? threadId : undefined);
  const voice = useLiveVoice(ws, chatId ? 'chat' : 'home', chatId ? undefined : facts, chatId);
  const navigation = useNavigation();
  const minimize = useCallback(() => {
    if (onDismiss) onDismiss();
    else if (navigation.canGoBack()) navigation.goBack();
    else if (chatId) router.replace({ pathname: '/messages/[id]', params: { id: chatId } });
    else router.replace('/messages');
  }, [navigation, chatId, onDismiss]);
  const end = useCallback(() => {
    try { voice.stop(); } catch { /* Never trap navigation on native teardown. */ }
    minimize();
  }, [voice, minimize]);
  useEffect(() => {
    if (onDismiss) return;
    return navigation.addListener('beforeRemove', () => { /* Minimize: do not stop the session from the screen leaving. */ });
  }, [navigation, onDismiss]);
  useEffect(() => {
    if (onDismiss) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { minimize(); return true; });
    return () => back.remove();
  }, [minimize, onDismiss]);
  const micDenied = voice.state === 'error' && voiceErrorKind(voice.error) === 'mic';
  const [showResume, setShowResume] = useState(false);
  useEffect(() => {
    if (!micDenied) { setShowResume(false); return; }
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setShowResume(true); });
    return () => sub.remove();
  }, [micDenied]);

  return <VoiceOverlay voice={voice as any} onMinimize={minimize} onEnd={end} showResume={showResume} onResume={() => { setShowResume(false); void voice.start(); }} preview={preview} chatId={chatId} noWs={noWs} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: D.bg, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 4 },
  minimizeLabel: { ...tokens.type.footnote, fontFamily: tokens.font.uiSemibold },
  liveTag: { fontFamily: tokens.font.uiSemibold, fontSize: 13, lineHeight: 18, letterSpacing: 0, textTransform: 'none' },
  center: { flexGrow: 1, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 16 },
  caption: { fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 32, color: D.text, textAlign: 'center', maxWidth: 340, marginTop: 8 },
  captionBody: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 22, textAlign: 'left' },
  eyebrow: { ...tokens.type.overline, fontFamily: tokens.font.uiSemibold, letterSpacing: 1.2, textAlign: 'left', marginBottom: 0 },
  captions: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13, gap: 5, marginTop: 4, flexShrink: 0 },
  details: { ...tokens.type.footnote, fontFamily: tokens.font.ui, textAlign: 'left', maxWidth: 340, alignSelf: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  hint: { ...tokens.type.subhead, fontFamily: tokens.font.ui, color: D.muted, textAlign: 'center' },
  settingsBtn: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8, alignSelf: 'center' },
  draft: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  draftLabel: { ...tokens.type.footnote, fontFamily: tokens.font.uiSemibold },
  draftBody: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  draftRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  draftBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  settingsText: { ...tokens.type.body, fontFamily: tokens.font.uiSemibold },
  showChat: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 18, flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: 22 },
  showChatText: { ...tokens.type.body, fontFamily: tokens.font.uiSemibold },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  speaker: { fontFamily: tokens.font.uiSemibold, fontSize: 11, letterSpacing: 1.1, alignSelf: 'stretch', paddingHorizontal: 8 },
  ownerLine: { fontFamily: tokens.font.ui, fontSize: 17, lineHeight: 24, alignSelf: 'stretch', paddingHorizontal: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  control: { alignItems: 'center', gap: 6 },
  controlLabel: { ...tokens.type.footnote, fontFamily: tokens.font.ui },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  mute: { backgroundColor: D.surface, borderWidth: 1, borderColor: D.hairline },
});

type VoiceErrKind = 'mic' | 'limit' | 'quota' | 'network' | 'off' | 'server' | 'generic';
const ERR_HEADLINE: Record<VoiceErrKind, string> = {
  mic: 'Microphone is off for AngelOS.',
  limit: 'AI usage limit reached.',
  quota: 'The voice service is busy or out of quota.',
  network: 'No connection to AngelOS.',
  off: 'Voice is not available right now.',
  server: 'The server could not start voice.',
  generic: 'Voice could not start.',
};
/** Picks the headline from the real error text. Mic is blamed only when the microphone itself failed. */
function voiceErrorKind(msg: string | null): VoiceErrKind {
  const m = (msg ?? '').toLowerCase();
  if (/microphone is off|notallowederror|permission denied|microphone access/.test(m)) return 'mic';
  if (/ai uses|usage limit|too many voice sessions/.test(m)) return 'limit';
  if (/\((429|402)\)|quota/.test(m)) return 'quota';
  if (/network|failed to fetch|timed? ?out|abort/.test(m)) return 'network';
  if (/not available|not set up|live voice is off/.test(m)) return 'off';
  if (/could not (start|connect)|\(\d{3}\)|workspace not found|status \d{3}/.test(m)) return 'server';
  return 'generic';
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  if (__DEV__) console.warn(error);
  const t = (k: string, d: string) => i18nInstance.t(k, d);
  return <EBView style={{ flex: 1, backgroundColor: N.bg, justifyContent: 'center', padding: 24 }}>
    <EBText style={{ color: N.text, ...tokens.type.headline, marginBottom: 12 }}>{t('aip.crashTitle', 'Something went wrong')}</EBText>
    <EBText style={{ color: N.text2, ...tokens.type.subhead, marginBottom: 20 }}>{t('aip.crashBody', 'Please try again.')}</EBText>
    <EBPressable accessibilityRole="button" onPress={() => { void retry(); }} style={{ minHeight: 44, justifyContent: 'center' }}><EBText style={{ color: N.text, ...tokens.type.body }}>{t('common.tryAgain', 'Try again')}</EBText></EBPressable>
    <EBPressable accessibilityRole="button" onPress={() => (ebRouter.canGoBack() ? ebRouter.back() : ebRouter.replace('/ai' as any))} style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}><EBText style={{ color: N.text, ...tokens.type.body }}>{t('common.goBack', 'Go back')}</EBText></EBPressable>
  </EBView>;
}
