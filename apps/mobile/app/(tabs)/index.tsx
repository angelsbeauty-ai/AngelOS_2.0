import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { getMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';
import { getHomeSummary, type HomeSummary } from '../../src/lib/home';
import { tokens } from '../../src/design/theme';

export const GREEN = '#000000';

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

  const load = useCallback(async () => {
    try {
      const w = await getActiveWorkspace(); setWs(w.id); setNoStudio(false);
      void getMe().then((m: any) => setName(((m?.displayName ?? '') as string).trim().split(/\s+/)[0] || null)).catch(() => undefined);
      setSumErr(false);
      await Promise.all([
        getHomeSummary(w.id, 'day').then(setSum).catch(() => setSumErr(true)),
        Promise.resolve()
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

  const now = new Date();
  const h = now.getHours();
  const hello = h < 5 ? t('home.evening2', 'Good evening!') : h < 12 ? t('home.morning2', 'Good morning!') : h < 18 ? t('home.afternoon2', 'Good afternoon!') : t('home.evening2', 'Good evening!');
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const s = sum?.schedule; const m = sum?.messages; const so = sum?.social; const imp = sum?.important; const a = sum?.assistant;
  const openReport = (section?: string) => router.push({ pathname: '/reports', params: section ? { section } : {} } as any);
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  const tasks = imp?.tasks ?? (a ? a.pendingApprovals + a.suggestions.length : null);

  return <Screen onRefresh={load} onSwipeUpAtEnd={() => openReport()}>
    <View style={{ gap: 2 }}>
      <Text style={styles.hi} numberOfLines={1}>{name ? t('home.hiName', { defaultValue: 'Hi, {{name}}', name }) : t('home.hi', 'Hi')}</Text>
      <Text style={styles.welcome}>{t('home.welcome', 'Welcome back')}</Text>
    </View>
    <View style={{ gap: 4, marginTop: -2 }}>
      <Text style={styles.big}>{hello}</Text>
      <Text style={styles.sub}>{t('home.todaysReport', "Here's today's report.")}</Text>
    </View>

    {noStudio ? <NoStudio /> : <>
      {sumErr && !sum ? <Text style={styles.muted}>{t('home.sumError', 'Your numbers could not load right now. Pull down to try again.')}</Text> : null}
      <View style={styles.grid}>
        <Box title={t('home.schedule', "Today's schedule")} value={s ? n(s.total, t('home.booking1', 'booking'), t('home.bookings', 'bookings')) : '–'} onPress={() => openReport('schedule')}
          lines={s ? [s.next ? `${t('home.next', 'Next')} ${time(s.next.start_at)}${s.next.service ? ` · ${s.next.service}` : ''}` : t('home.noMore', 'Nothing else booked today'), s.pending ? `${s.pending} ${t('home.pending', 'waiting to confirm')}` : '', s.cancelled ? `${s.cancelled} ${t('home.cancelled', 'cancelled')}` : '', s.total ? `${s.newClients} ${t('home.new', 'new')} · ${s.returningClients} ${t('home.returning', 'returning')}` : ''] : []} />
        <Box title={t('home.messages', 'Messages')} value={m ? `${m.unread} ${t('home.unread', 'unread')}` : '–'} onPress={() => router.push('/messages' as any)}
          lines={m ? [`${m.needsReply} ${t('home.needReply', 'need a reply')}`, m.important ? `${m.important} ${t('home.important', 'important')}` : '', m.booking.inProgress ? `${m.booking.inProgress} ${t('home.bookingInProgress', 'booking in progress')}` : ''] : []} />
        <Box title={t('home.importantTitle', 'Important')} value={tasks != null ? n(tasks, t('home.task1', 'task'), t('home.tasks', 'tasks')) : '–'} onPress={() => openReport('assistant')}
          lines={[imp?.scheduledPosts != null ? n(imp.scheduledPosts, t('home.schedPost1', 'scheduled post'), t('home.schedPosts', 'scheduled posts')) : '', a?.pendingApprovals ? `${a.pendingApprovals} ${t('home.approvals', 'waiting for approval')}` : '', s?.touchUpsDue ? `${s.touchUpsDue} ${t('home.touchUps', 'touch-ups due')}` : '']} />
        <Box title={t('home.social', 'Social media')} value={so?.followers != null ? `${so.followers.toLocaleString(locale)}` : '–'} unit={so?.followers != null ? t('home.followers', 'followers') : ''} onPress={() => openReport('social')}
          lines={so ? (so.connected.length ? [so.followersChange7d != null ? `${so.followersChange7d > 0 ? '+' : ''}${so.followersChange7d} ${t('home.in7d', 'this week')}` : '', so.engagement != null ? `${so.engagement.toLocaleString(locale)} ${t('home.interactions', 'recent interactions')}` : '', `${so.postsInPeriod} ${t('home.postsToday', 'posted today')}`] : [t('home.noSocial', 'No accounts connected yet')]) : []} />
      </View>
    </>}
  </Screen>;
}

function Box({ title, value, unit, lines, onPress }: { title: string; value: string; unit?: string; lines: string[]; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${value} ${unit ?? ''}`} onPress={onPress} style={({ pressed }) => [styles.box, pressed && { backgroundColor: '#FAFAFA' }]}>
    <Text style={styles.boxTitle} numberOfLines={1}>{title}</Text>
    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}{unit ? <Text style={styles.unit}> {unit}</Text> : null}</Text>
    <View style={{ gap: 4, flex: 1 }}>{lines.filter(Boolean).slice(0, 3).map((l, i) => <Text key={i} style={styles.line} numberOfLines={1}>{l}</Text>)}</View>
    <View style={styles.arrow}><ArrowRight size={18} color="#000" weight="bold" /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  hi: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#737373' },
  welcome: { fontFamily: tokens.font.uiBold, fontSize: 17, color: '#000' },
  big: { fontFamily: tokens.font.uiBold, fontSize: 32, lineHeight: 38, color: '#000', letterSpacing: -0.5 },
  sub: { fontFamily: tokens.font.uiMedium, fontSize: 20, lineHeight: 26, color: '#262626' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  box: { width: '48.4%', minHeight: 196, padding: 16, gap: 8, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFEFEF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  boxTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#000' },
  value: { fontFamily: tokens.font.uiBold, fontSize: 22, lineHeight: 28, color: '#000' },
  unit: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#737373' },
  line: { fontFamily: tokens.font.ui, fontSize: 13.5, lineHeight: 18, color: '#262626' },
  arrow: { alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEFEF' },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, color: '#737373' }
});
