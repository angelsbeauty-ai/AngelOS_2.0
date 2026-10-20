import { Pressable as EBPressable, Text as EBText, View as EBView } from 'react-native';
import { router as ebRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'phosphor-react-native/src/icons/X';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { MicrophoneSlash } from 'phosphor-react-native/src/icons/MicrophoneSlash';
import { ClosedCaptioning } from 'phosphor-react-native/src/icons/ClosedCaptioning';
import { useLiveVoice } from '../src/components/LiveVoice';
import { crumb, readCrumbs } from '../src/lib/crash-guard';
void crumb('voice code loaded');
import { VoiceOrb } from '../src/components/VoiceOrb';
import { AnswerCard } from '../src/components/AnswerCard';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getBriefing } from '../src/lib/home';
import { D, tokens } from '../src/design/theme';
import { useAppearance } from '../src/design/appearance';

/** Voice (final-D2 07): top row, orb (placeholder), live caption, hint, mute + close. Voice can only draft replies; sending needs her tap. */
export default function VoiceScreen() {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  const [ws, setWs] = useState<string | null>(null);
  const [facts, setFacts] = useState<string | undefined>(undefined);
  const [noWs, setNoWs] = useState(false);
  const [cc, setCc] = useState(true);
  useEffect(() => { void crumb('voice screen shown'); }, []);
  useEffect(() => { void getActiveWorkspace().then(async (w) => { setWs(w.id); const b = await getBriefing(w.id).catch(() => null); setFacts(b?.facts?.join('\n')); }).catch(() => setNoWs(true)); }, []);
  const voice = useLiveVoice(ws, 'home', facts);
  const close = () => { voice.stop(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const off = voice.status && !voice.status.available;
  const live = voice.state === 'live';
  const top = live ? (voice.muted ? t('voice.muted', 'Muted') : t('voice.listening', 'Listening')) : voice.state === 'connecting' ? t('voice.connecting', 'Connecting…') : t('voice.title', 'Talk to your assistant');
  const caption = noWs ? t('voice.noStudio', 'Set up your studio first, then you can talk to your assistant.')
    : off ? (voice.status?.reason ?? t('voice.off', 'Voice is not available right now.'))
    : voice.state === 'error' ? (voice.error ?? t('voice.error', 'Voice could not start. Check microphone permission in Settings.'))
    : live ? (voice.caption ? `“${voice.caption}”` : t('voice.listenCopy', "I'm listening. Take your time."))
    : null;
  const hint = live ? t('voice.tapPause', 'Tap the orb to pause') : t('voice.tapStart', 'Tap the orb to start');

  return <View style={[styles.page, { backgroundColor: palette.bg }]}>
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.close', 'Close')} onPress={close} style={styles.iconBtn}><X size={22} color={palette.text} /></Pressable>
      <Text style={[styles.label, { color: palette.muted }]} numberOfLines={1}>{top}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.captions', 'Captions')} accessibilityState={{ selected: cc }} onPress={() => setCc(!cc)} style={styles.iconBtn}><ClosedCaptioning size={24} color={cc ? palette.text : palette.muted} /></Pressable>
    </View>
    <View style={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={live ? t('voice.stop', 'Stop') : t('voice.start', 'Start talking')} disabled={noWs || !!off || voice.state === 'connecting'} onPress={() => (live ? voice.stop() : void voice.start())}>
        <VoiceOrb state={voice.state} dimmed={!!off || noWs} level={voice.getLevel} />
      </Pressable>
      {cc && caption ? <Text style={[styles.caption, { color: palette.text }]}>{caption}</Text> : null}
      {voice.state === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open Settings" onPress={() => void Linking.openSettings()} style={[styles.settingsBtn, { backgroundColor: palette.text }]}>
          <Text style={[styles.settingsText, { color: palette.bg }]}>Open Settings</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text>
      {voice.cards.length ? <View style={{ alignSelf: 'stretch', marginHorizontal: 16 }}><AnswerCard card={voice.cards[voice.cards.length - 1]} /></View> : null}
      {voice.drafts.map((d) => <View key={d.messageId} style={[styles.draft, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.draftTitle', 'Reply draft. Not sent yet.')}</Text>
        <Text style={[styles.draftBody, { color: palette.text }]}>{d.body}</Text>
        {d.state === 'sent' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.draftSent', 'Sent')}</Text>
          : d.state === 'manual' ? <Text style={[styles.draftLabel, { color: palette.muted }]}>{t('voice.draftManual', 'Approved. Send it from the chat, this app is not connected yet.')}</Text>
          : <View style={styles.draftRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('voice.draftDismiss', 'Not now')} onPress={() => voice.dismissDraft(d.messageId)} style={styles.draftBtn}><Text style={[styles.settingsText, { color: palette.text }]}>{t('voice.draftDismiss', 'Not now')}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('voice.draftApprove', 'Approve and send')} disabled={d.state === 'sending'} onPress={() => void voice.approveDraft(d.messageId)} style={[styles.draftBtn, { backgroundColor: palette.text }]}><Text style={[styles.settingsText, { color: palette.bg }]}>{d.state === 'sending' ? t('voice.draftSending', 'Sending…') : d.state === 'error' ? t('voice.draftRetry', 'Try again') : t('voice.draftApprove', 'Approve and send')}</Text></Pressable>
          </View>}
      </View>)}
    </View>
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" accessibilityLabel={voice.muted ? t('voice.unmute', 'Unmute') : t('voice.mute', 'Mute')} accessibilityState={{ selected: voice.muted }} disabled={!live} onPress={() => voice.setMuted(!voice.muted)} style={[styles.round, styles.mute, { backgroundColor: palette.glass, borderColor: palette.border }, !live && { opacity: 0.5 }]}>
        {voice.muted ? <MicrophoneSlash size={24} color={palette.text} /> : <Microphone size={24} color={palette.text} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.close', 'Close')} onPress={close} style={[styles.round, styles.end]}><X size={24} color="#FFFFFF" /></Pressable>
    </View>
      </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: D.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 72 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: D.listening },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  caption: { fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 32, color: D.text, textAlign: 'center', maxWidth: 340, marginTop: 24 },
  hint: { fontFamily: tokens.font.ui, fontSize: 15, color: D.muted, textAlign: 'center' },
  settingsBtn: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  draft: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  draftLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 13 },
  draftBody: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  draftRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  draftBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  settingsText: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  mute: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: D.hairline },
  end: { backgroundColor: D.text },
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <EBView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24 }}>
    <EBText style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Something went wrong</EBText>
    <EBText selectable style={{ color: '#bbb', fontSize: 14, marginBottom: 20 }}>{String(error?.message ?? error)}</EBText>
    <EBPressable onPress={() => { void retry(); }}><EBText style={{ color: '#fff', fontSize: 16 }}>Try again</EBText></EBPressable>
    <EBPressable onPress={() => ebRouter.back()} style={{ marginTop: 16 }}><EBText style={{ color: '#fff', fontSize: 16 }}>Go back</EBText></EBPressable>
  </EBView>;
}
