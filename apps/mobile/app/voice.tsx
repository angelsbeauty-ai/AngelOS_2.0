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

export type VoiceVisual = 'connecting' | 'listening' | 'speaking' | 'muted' | 'error' | 'mic-denied';

export type VoiceOverlayPreview = { visual?: VoiceVisual; caption?: string; showResume?: boolean };

const COPY: Record<VoiceVisual, { title: string; sub: string }> = {
  connecting: { title: 'Connecting', sub: 'Getting ready to listen.' },
  listening: { title: 'Listening', sub: 'Go ahead. I\u2019m here.' },
  speaking: { title: 'Speaking', sub: 'You can interrupt me at any time.' },
  muted: { title: 'Microphone muted', sub: 'You can still listen, read and type.' },
  error: { title: 'Connection interrupted', sub: 'Listening and playback are paused.' },
  'mic-denied': { title: 'Microphone access is off', sub: 'Allow microphone access to talk live.' },
};

export function resolveVoiceVisual(input: { state?: string; error?: string | null; muted?: boolean; speaking?: boolean; status?: { available?: boolean } | null }): VoiceVisual {
  if (voiceErrorKind(input.error ?? null) === 'mic' && input.state === 'error') return 'mic-denied';
  if (input.state === 'error') return 'error';
  if (input.state === 'connecting' || input.state === 'idle') return input.state === 'connecting' ? 'connecting' : 'listening';
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
  muted: boolean;
  setMuted: (m: boolean) => void;
  caption?: string;
  speaking?: boolean;
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
export function VoiceOverlay({ voice, onMinimize, onEnd, showResume, onResume, preview, chatId, noWs }: {
  voice: OverlayVoice;
  onMinimize: () => void;
  onEnd: () => void;
  showResume?: boolean;
  onResume?: () => void;
  preview?: VoiceOverlayPreview;
  chatId?: string;
  noWs?: boolean;
}) {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  const insets = useInsets();
  const visual = preview?.visual ?? resolveVoiceVisual(voice);
  const live = voice.state === 'live' || ['listening', 'speaking', 'muted'].includes(visual);
  const off = voice.status && !voice.status.available;
  const errKind = voiceErrorKind(voice.error);
  const micDenied = visual === 'mic-denied';
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
  const spoken = preview?.caption ?? voice.caption;
  const captionText = noWs ? t('voice.noStudio', 'Set up your studio first, then you can talk to your assistant.')
    : off ? (voice.status?.reason ?? t('voice.off', 'Voice is not available right now.'))
    : visual === 'speaking' && spoken ? spoken
    : null;
  const muteLabel = micDenied ? 'Microphone access is off. Open Settings to enable' : voice.muted ? 'Unmute' : 'Mute';
  const muteCaption = micDenied ? 'Mic off' : voice.muted ? 'Unmute' : 'Mute';
  const hint = visual === 'error' || visual === 'mic-denied' ? 'Minimize keeps this session. End closes it.' : 'Minimize keeps voice on. End stops voice.';
  const resume = showResume ?? preview?.showResume;

  return <View onAccessibilityEscape={onMinimize} accessibilityLabel="AngelOS live voice" accessibilityViewIsModal accessibilityActions={[{ name: 'escape', label: 'Minimize' }]} onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'escape') onMinimize(); }} style={[styles.page, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Minimize" onPress={onMinimize} style={styles.iconBtn}>
        <CaretDown size={20} color={palette.text} />
        <Text style={[styles.minimizeLabel, { color: palette.text }]}>Minimize</Text>
      </Pressable>
      <Text style={[styles.liveTag, { color: palette.muted }]} numberOfLines={1}>AngelOS · Live</Text>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={live ? copy.title : 'Start talking'} disabled={noWs || !!off || voice.state === 'connecting' || live} onPress={() => { if (!live) void voice.start(); }}>
        <VoiceOrb state={voice.state === 'idle' && visual !== 'listening' ? 'connecting' : voice.state} dimmed={!!off || noWs} level={voice.getLevel} />
      </Pressable>
      <Text style={[styles.caption, { color: palette.text }]}>{copy.title}</Text>
      <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>{copy.sub}</Text>
      {visual === 'speaking' && captionText ? <View style={[styles.captions, { backgroundColor: palette.glass, borderColor: palette.border }]}><Text style={[styles.eyebrow, { color: palette.muted }]}>LIVE CAPTIONS</Text><Text style={[styles.captionBody, { color: palette.text }]}>{captionText}</Text></View> : null}
      {visual === 'muted' ? <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>Your microphone stays off as you move around AngelOS, until you unmute.</Text> : null}
      {visual === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry voice connection" onPress={() => void voice.start()} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Retry</Text>
        </Pressable>
      ) : null}
      {micDenied ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open microphone settings" onPress={() => void Linking.openSettings()} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Open Settings</Text>
        </Pressable>
      ) : null}
      {micDenied ? <Text style={[styles.hint, { color: palette.muted, maxWidth: 320 }]}>Returning rechecks access.{resume ? ' Tap Resume to start listening.' : ' You can still read and type.'}</Text> : null}
      {resume && micDenied ? (
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
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => voice.dismissDraft(d.messageId)} style={styles.draftBtn}><Text style={[styles.settingsText, { color: palette.text }]}>Not now</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Approve" disabled={d.state === 'sending'} onPress={() => void voice.approveDraft(d.messageId)} style={[styles.draftBtn, { backgroundColor: palette.text }]}><Text style={[styles.settingsText, { color: palette.bg }]}>{d.state === 'sending' ? 'Sending…' : d.state === 'error' ? 'Try again' : 'Approve'}</Text></Pressable>
          </View>}
      </View>)}
      {(voice.actions ?? []).map((a) => <View key={a.id} style={[styles.draft, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.actionTitle', 'Waiting for your Approve. Nothing is saved yet.')}</Text>
        <Text style={[styles.draftBody, { color: palette.text }]}>{a.summary}</Text>
        {a.state === 'done' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.actionDone', 'Approved and saved')}</Text>
          : <View style={styles.draftRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => voice.dismissAction?.(a.id)} style={styles.draftBtn}><Text style={[styles.settingsText, { color: palette.text }]}>Not now</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Approve" disabled={a.state === 'saving'} onPress={() => void voice.approveAction?.(a.id)} style={[styles.draftBtn, { backgroundColor: palette.text }]}><Text style={[styles.settingsText, { color: palette.bg }]}>{a.state === 'saving' ? 'Saving…' : a.state === 'error' ? 'Try again' : 'Approve'}</Text></Pressable>
          </View>}
      </View>)}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Minimize and show assistant chat to type" onPress={onMinimize} style={[styles.showChat, { borderColor: palette.border, backgroundColor: palette.glass }]}>
      <Text style={[styles.showChatText, { color: palette.text }]}>Show chat & type</Text>
      <CaretRight size={16} color={palette.text} />
    </Pressable>
    <View style={styles.buttons}>
      <View style={styles.control}>
        <Pressable accessibilityRole="button" accessibilityLabel={muteLabel} accessibilityState={{ selected: voice.muted }} disabled={!live || micDenied} onPress={() => voice.setMuted(!voice.muted)} style={[styles.round, styles.mute, { backgroundColor: palette.glass, borderColor: palette.border }, (!live || micDenied) && { opacity: 0.5 }]}>
          {voice.muted || micDenied ? <MicrophoneSlash size={24} color={palette.text} /> : <Microphone size={24} color={palette.text} />}
        </Pressable>
        <Text style={[styles.controlLabel, { color: palette.muted }]}>{muteCaption}</Text>
      </View>
      <View style={styles.control}>
        <Pressable accessibilityRole="button" accessibilityLabel="End voice" onPress={onEnd} style={[styles.round, { backgroundColor: palette.text }]}>
          <PhoneDisconnect size={24} color={palette.bg} />
        </Pressable>
        <Text style={[styles.controlLabel, { color: palette.muted }]}>End voice</Text>
      </View>
    </View>
    <Text style={[styles.hint, { color: palette.muted, marginTop: 12 }]}>{hint}</Text>
    <Text style={[styles.hint, { color: palette.muted }]}>Voice stays on inside AngelOS only.</Text>
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
  captions: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13, gap: 5, marginTop: 4 },
  details: { ...tokens.type.footnote, fontFamily: tokens.font.ui, textAlign: 'left', maxWidth: 340, alignSelf: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  hint: { ...tokens.type.subhead, fontFamily: tokens.font.ui, color: D.muted, textAlign: 'center' },
  settingsBtn: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  draft: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  draftLabel: { ...tokens.type.footnote, fontFamily: tokens.font.uiSemibold },
  draftBody: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  draftRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  draftBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  settingsText: { ...tokens.type.body, fontFamily: tokens.font.uiSemibold },
  showChat: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 18, flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: 22 },
  showChatText: { ...tokens.type.body, fontFamily: tokens.font.uiSemibold },
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
