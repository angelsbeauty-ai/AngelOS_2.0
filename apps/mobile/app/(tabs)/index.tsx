import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { getMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';
import { getBriefing, getHomeSummary, type Briefing, type HomeSummary } from '../../src/lib/home';
import { tokens } from '../../src/design/theme';

export const GREEN = '#1F7A4D';
const INK = '#000000'; const GREY = '#737373'; const LINE = '#DBDBDB';

/** Home Command Center: date, greeting + voice, AI briefing (numbers only), and four boxes. Real data only. */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [ws, setWs] = useState<string | null>(null);
  const [noStudio, setNoStudio] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [sum, setSum] = useState<HomeSummary | null>(null);
  const [sumErr, setSumErr] = useState(false);
  const [brief, setBrief] = useState<Briefing | null>(null);
  const [briefState, setBriefState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      const w = await getActiveWorkspace(); setWs(w.id); setNoStudio(false);
      void getMe().then((m: any) => setName(((m?.displayName ?? '') as string).trim().split(/\s+/)[0] || null)).catch(() => undefined);
      setSumErr(false);
      await Promise.all([
        getHomeSummary(w.id, 'day').then(setSum).catch(() => setSumErr(true)),
        getBriefing(w.id).then((b) => { setBrief(b); setBriefState('ready'); }).catch(() => setBriefState('error'))
      ]);
    } catch (e) { if (isNoWorkspace(e)) setNoStudio(true); else setSumErr(true); }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setSignedIn(Boolean(data.session)); setSessionReady(true); if (data.session) void load(); });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => { if (!mounted) return; setSignedIn(Boolean(s)); setSessionReady(true); });
    return () => { mounted = false; l.subscription.unsubscribe(); };
  }, [load]);

  if (!sessionReady) return <Screen><Text style={styles.muted}>{t('today.loading')}</Text></Screen>;
  if (!signedIn) return <Redirect href="/login" />;

  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const now = new Date();
  const h = now.getHours();
  const hello = h < 12 ? t('home.morning', 'Good morning') : h < 18 ? t('home.afternoon', 'Good afternoon') : t('home.evening', 'Good evening');
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const s = sum?.schedule; const m = sum?.messages; const so = sum?.social; const a = sum?.assistant;
  const openReport = (section?: string) => router.push({ pathname: '/reports', params: section ? { section } : {} } as any);

  return <Screen onRefresh={load} onSwipeUpAtEnd={() => openReport()}>
    <View style={styles.hello}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.date}>{now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={styles.greet} numberOfLines={1}>{name ? `${hello}, ${name}` : hello}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.voice', 'Talk to your assistant')} onPress={() => router.push('/voice' as any)} style={styles.mic}><Microphone size={22} color={GREEN} weight="fill" /></Pressable>
    </View>

    {noStudio ? <NoStudio /> : <>
      <View style={styles.brief}>
        <View style={styles.briefHead}><Sparkle size={16} color={GREEN} weight="fill" /><Text style={styles.briefTitle}>{t('home.briefing', 'Daily briefing')}</Text></View>
        <Text style={styles.briefText}>{briefState === 'loading' ? t('home.briefLoading', 'Getting today ready…') : briefState === 'error' ? t('home.briefError', 'The briefing could not load. Pull down to try again.') : brief?.text}</Text>
      </View>

      {sumErr && !sum ? <Text style={styles.muted}>{t('home.sumError', 'Your numbers could not load right now. Pull down to try again.')}</Text> : null}

      <View style={styles.grid}>
        <Box icon={<CalendarCheck size={20} color={GREEN} weight="duotone" />} title={t('home.schedule', "Today's schedule")} value={s ? String(s.total) : '–'} unit={t('home.bookings', 'bookings')} onPress={() => openReport('schedule')}
          lines={s ? [s.next ? `${t('home.next', 'Next')} ${time(s.next.start_at)} · ${s.next.service ?? ''}` : t('home.noMore', 'Nothing else booked today'), s.total ? `${s.newClients} ${t('home.new', 'new')} · ${s.returningClients} ${t('home.returning', 'returning')}` : '', s.pending ? `${s.pending} ${t('home.pending', 'waiting to confirm')}` : '', s.cancelled ? `${s.cancelled} ${t('home.cancelled', 'cancelled')}` : '', s.touchUpsDue ? `${s.touchUpsDue} ${t('home.touchUps', 'touch-ups due')}` : ''] : []} />
        <Box icon={<ChatCircleDots size={20} color={GREEN} weight="duotone" />} title={t('home.messages', 'Messages')} value={m ? String(m.needsReply) : '–'} unit={t('home.toReply', 'to reply')} onPress={() => openReport('messages')}
          lines={m ? [`${m.unread} ${t('home.unread', 'unread')}`, m.important ? `${m.important} ${t('home.important', 'important')}` : '', m.booking.inProgress ? `${m.booking.inProgress} ${t('home.bookingInProgress', 'booking in progress')}` : '', m.booking.reschedule ? `${m.booking.reschedule} ${t('home.reschedule', 'want to reschedule')}` : ''] : []} />
        <Box icon={<ChartLineUp size={20} color={GREEN} weight="duotone" />} title={t('home.social', 'Social media')} value={so?.followers != null ? so.followers.toLocaleString(locale) : '–'} unit={so?.followers != null ? t('home.followers', 'followers') : ''} onPress={() => openReport('social')}
          lines={so ? (so.connected.length ? [so.followersChange7d ? `${so.followersChange7d > 0 ? '+' : ''}${so.followersChange7d} ${t('home.in7d', 'in 7 days')}` : '', so.reach != null ? `${so.reach.toLocaleString(locale)} ${t('home.reach', 'reach')}` : '', `${so.postsInPeriod} ${t('home.postsToday', 'posted today')}`] : [t('home.noSocial', 'No accounts connected yet')]) : []} />
        <Box icon={<Sparkle size={20} color={GREEN} weight="duotone" />} title={t('home.assistant', 'AI assistant report')} value={a ? String(a.suggestions.length) : '–'} unit={t('home.ideas', 'suggestions')} onPress={() => openReport('assistant')}
          lines={a ? [a.pendingApprovals ? `${a.pendingApprovals} ${t('home.approvals', 'waiting for your approval')}` : t('home.noApprovals', 'Nothing waiting for approval'), a.suggestions[0]?.title ?? ''] : []} />
      </View>

      <Pressable accessibilityRole="button" onPress={() => openReport()} style={styles.full}><Text style={styles.fullText}>{t('home.fullReport', 'See full report')}</Text><CaretRight size={16} color={GREEN} weight="bold" /></Pressable>
      <Text style={styles.hint}>{t('home.hint', 'Swipe up for the full report · swipe down on the top bar to talk')}</Text>
    </>}
  </Screen>;
}

function Box({ icon, title, value, unit, lines, onPress }: { icon: React.ReactNode; title: string; value: string; unit: string; lines: string[]; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${value} ${unit}`} onPress={onPress} style={({ pressed }) => [styles.box, pressed && { backgroundColor: '#F2F2F2' }]}>
    <View style={styles.boxHead}>{icon}<Text style={styles.boxTitle} numberOfLines={1}>{title}</Text></View>
    <View style={styles.valueRow}><Text style={styles.value}>{value}</Text>{unit ? <Text style={styles.unit} numberOfLines={1}>{unit}</Text> : null}</View>
    {lines.filter(Boolean).slice(0, 3).map((l, i) => <Text key={i} style={styles.line} numberOfLines={1}>{l}</Text>)}
  </Pressable>;
}

const styles = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -4 },
  date: { fontFamily: tokens.font.uiSemibold, fontSize: 13, letterSpacing: 0.4, color: GREY, textTransform: 'uppercase' },
  greet: { fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30, color: INK },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F3EC' },
  brief: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FAFAFA', borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  briefHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  briefTitle: { fontFamily: tokens.font.uiBold, fontSize: 13, letterSpacing: 0.4, color: GREEN, textTransform: 'uppercase' },
  briefText: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 22, color: '#262626' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  box: { width: '48.5%', minHeight: 168, padding: 14, gap: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5E9DC' },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxTitle: { flex: 1, fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#262626' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  value: { fontFamily: tokens.font.uiBold, fontSize: 30, lineHeight: 36, color: INK, fontVariant: ['tabular-nums'] },
  unit: { flexShrink: 1, fontFamily: tokens.font.uiMedium, fontSize: 13, color: GREY },
  line: { fontFamily: tokens.font.ui, fontSize: 12.5, lineHeight: 17, color: '#262626' },
  full: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#D5E9DC' },
  fullText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: GREEN },
  hint: { fontFamily: tokens.font.ui, fontSize: 12, color: '#8E8E8E', textAlign: 'center', marginTop: -12 },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, color: GREY }
});
