import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'phosphor-react-native/src/icons/X';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { useLiveVoice } from '../src/components/LiveVoice';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getBriefing } from '../src/lib/home';
import { tokens } from '../src/design/theme';

const GREEN = '#000000';

/** Voice mode: an orb, greets with today's facts (from the same Home briefing), interruptible. Web only for now. */
export default function VoiceScreen() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<string | null>(null);
  const [facts, setFacts] = useState<string | undefined>(undefined);
  const [noWs, setNoWs] = useState(false);
  useEffect(() => { void getActiveWorkspace().then(async (w) => { setWs(w.id); const b = await getBriefing(w.id).catch(() => null); setFacts(b?.facts?.join('\n')); }).catch(() => setNoWs(true)); }, []);
  const voice = useLiveVoice(Platform.OS === 'web' ? ws : null, 'home', facts);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: voice.state === 'live' ? 900 : 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: voice.state === 'live' ? 900 : 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })]));
    loop.start(); return () => loop.stop();
  }, [voice.state, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, voice.state === 'live' ? 1.12 : 1.04] });
  const close = () => { voice.stop(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const native = Platform.OS !== 'web';
  const off = !native && voice.status && !voice.status.available;
  const label = native ? t('voice.soon', 'Voice is coming in the next app update.')
    : noWs ? t('voice.noStudio', 'Set up your studio first, then you can talk to your assistant.')
    : off ? (voice.status?.reason ?? t('voice.off', 'Voice is not available right now.'))
    : voice.state === 'live' ? t('voice.live', 'Listening… talk any time to interrupt.')
    : voice.state === 'connecting' ? t('voice.connecting', 'Connecting…')
    : voice.state === 'error' ? (voice.error ?? t('voice.error', 'Voice could not start.'))
    : t('voice.tap', 'Tap the orb to start. Your microphone is used only while voice is on; nothing is recorded.');

  return <View style={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('voice.close', 'Close')} onPress={close} style={styles.close}><X size={24} color="#262626" weight="bold" /></Pressable>
    <View style={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={voice.state === 'live' ? t('voice.stop', 'Stop') : t('voice.start', 'Start talking')} disabled={native || noWs || !!off || voice.state === 'connecting'} onPress={() => (voice.state === 'live' ? voice.stop() : void voice.start())}>
        <Animated.View style={[styles.halo, { transform: [{ scale }] }]}><View style={[styles.orb, (native || off || noWs) && { opacity: 0.45 }]}><Microphone size={40} color="#FFF" weight="fill" /></View></Animated.View>
      </Pressable>
      <Text style={styles.title}>{voice.state === 'live' ? t('voice.titleLive', "I'm listening") : t('voice.title', 'Talk to your assistant')}</Text>
      <Text style={styles.sub}>{label}</Text>
      {voice.state === 'live' ? <Pressable onPress={voice.stop} style={styles.stop}><Text style={styles.stopText}>{t('voice.stop', 'Stop')}</Text></Pressable> : null}
    </View>
    <Text style={styles.foot}>{t('voice.foot', 'Voice can explain and plan. Changes and messages still need your approval in the app.')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF', padding: 24, paddingTop: 56 },
  close: { position: 'absolute', top: 48, right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  halo: { width: 220, height: 220, borderRadius: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEFEF' },
  orb: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
  title: { fontFamily: tokens.font.uiBold, fontSize: 24, color: '#000', textAlign: 'center' },
  sub: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 22, color: '#737373', textAlign: 'center', maxWidth: 320 },
  stop: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, borderWidth: 1, borderColor: '#DBDBDB', justifyContent: 'center' },
  stopText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#262626' },
  foot: { fontFamily: tokens.font.ui, fontSize: 12, color: '#8E8E8E', textAlign: 'center', paddingBottom: 24 }
});
