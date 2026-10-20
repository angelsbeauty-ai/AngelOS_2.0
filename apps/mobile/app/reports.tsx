import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getBriefing, getHomeSummary, type HomeSummary, type Period } from '../src/lib/home';
import { Skeleton, ScreenTitle } from '../src/components/ui';
import { useAppearance } from '../src/design/appearance';
import { useNightFix } from '../src/design/night-web';
import { PLATFORM_NAME } from '../src/lib/social';
import { tokens } from '../src/design/theme';

const GREEN = '#151515'; const GREY = '#6C6C70'; const LINE = '#F2F2F2';

/** Full report of the four Home sections, for today / this week / this month. Real data only. */
export default function Reports() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ section?: string }>();
  const [period, setPeriod] = useState<Period>('day');
  const [data, setData] = useState<HomeSummary | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const scroll = useRef<ScrollView>(null); const pos = useRef<Record<string, number>>({});
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const load = useCallback(async (p: Period) => {
    setState('loading');
    try { const w = await getActiveWorkspace(); if (p === 'day') void getBriefing(w.id).then((b) => setBrief(b.text)).catch(() => setBrief(null)); setData(await getHomeSummary(w.id, p)); setState('ready'); } catch { setState('error'); }
  }, []);
  useEffect(() => { void load(period); }, [period, load]);
  useEffect(() => { if (state === 'ready' && params.section) setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (pos.current[params.section!] ?? 0) - 8), animated: true }), 50); }, [state, params.section]);
  const { palette, mode } = useAppearance();
  useNightFix(mode === 'night');
  const when = period === 'day' ? t('rep.today', 'today') : period === 'week' ? t('rep.week', 'this week') : t('rep.month', 'this month');
  const dt = (iso: string) => new Date(iso).toLocaleString(locale, period === 'day' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const s = data?.schedule; const m = data?.messages; const so = data?.social; const a = data?.assistant;
  const mark = (k: string) => ({ onLayout: (e: any) => { pos.current[k] = e.nativeEvent.layout.y; } });

  return <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={styles.page}>
    <ScreenTitle>{t('home.reportTitle', { defaultValue: 'Full report' })}</ScreenTitle>
    <View style={styles.seg}>{(['day', 'week', 'month'] as Period[]).map((p) => <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: period === p }} onPress={() => setPeriod(p)} style={[styles.segItem, period === p && styles.segOn]}>
      <Text style={[styles.segText, period === p && { color: '#FFF' }]}>{p === 'day' ? t('rep.day', 'Day') : p === 'week' ? t('rep.weekBtn', 'Week') : t('rep.monthBtn', 'Month')}</Text></Pressable>)}</View>
    {state === 'loading' ? <Skeleton rows={4} height={90} /> : null}
    {state === 'error' ? <Text style={styles.muted}>{t('rep.error', 'The report could not load. Please try again.')}</Text> : null}
    {state === 'ready' && data ? <>
      {period === 'day' && brief ? <View style={styles.section}><Text style={styles.h}>{t('home.briefing', 'Daily briefing')}</Text><Text style={styles.brief}>{brief}</Text></View> : null}
      {data.unavailable.length ? <Text style={styles.muted}>{t('rep.partial', 'Some parts could not load right now:')} {data.unavailable.join(', ')}</Text> : null}

      <View {...mark('schedule')} style={styles.section}>
        <Text style={styles.h}>{period === 'day' ? t('home.schedule', "Today's schedule") : t('rep.schedule', 'Schedule')}</Text>
        <Stats items={[[s!.total, t('rep.bookings', 'bookings')], [s!.newClients, t('home.new', 'new')], [s!.returningClients, t('home.returning', 'returning')], [s!.pending, t('rep.pending', 'to confirm')], [s!.cancelled, t('home.cancelled', 'cancelled')], [s!.touchUpsDue, t('rep.touch', 'touch-ups due')]]} />
        {s!.items.length ? s!.items.map((b) => <Pressable key={b.id} style={styles.row} onPress={() => router.push(`/bookings/${b.id}` as any)}>
          <Text style={styles.time}>{dt(b.start_at)}</Text>
          <View style={{ flex: 1 }}><Text style={styles.rowTitle} numberOfLines={1}>{b.client ?? t('rep.client', 'Client')}</Text><Text style={styles.rowSub} numberOfLines={1}>{[b.service, b.returning === true ? t('home.returning', 'returning') : b.returning === false ? t('rep.newClient', 'new client') : null, b.status].filter(Boolean).join(' · ')}</Text></View>
        </Pressable>) : <Text style={styles.muted}>{t('rep.noBookings', 'No bookings')} {when}.</Text>}
      </View>

      <View {...mark('messages')} style={styles.section}>
        <Text style={styles.h}>{t('home.messages', 'Messages')}</Text>
        <Stats items={[[m!.unread, t('home.unread', 'unread')], [m!.needsReply, t('home.toReply', 'to reply')], [m!.important, t('home.important', 'important')], [m!.booking.inProgress, t('rep.bookingProg', 'booking in progress')], [m!.booking.inquiries, t('rep.inquiries', 'booking questions')], [m!.booking.reschedule, t('rep.resched', 'reschedule')]]} />
        <Text style={styles.note}>{t('rep.readNote', 'Read status and booking status are counted separately.')}</Text>
        {m!.alerts.length ? m!.alerts.map((x) => <Pressable key={x.id} style={styles.row} onPress={() => router.push(`/messages/${x.id}` as any)}>
          <View style={{ flex: 1 }}><Text style={styles.rowTitle} numberOfLines={1}>{x.name} <Text style={styles.rowSub}>· {x.platform}</Text></Text><Text style={styles.rowSub} numberOfLines={1}>{[x.important ? t('home.important', 'important') : null, x.needsReply ? t('home.toReply', 'to reply') : null, x.unread ? t('home.unread', 'unread') : null].filter(Boolean).join(' · ')}</Text></View>
          {x.at ? <Text style={styles.rowSub}>{new Date(x.at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</Text> : null}
        </Pressable>) : <Text style={styles.muted}>{t('rep.noMsgs', 'No messages need you right now.')}</Text>}
      </View>

      <View {...mark('social')} style={styles.section}>
        <Text style={styles.h}>{t('home.social', 'Social media')}</Text>
        {so!.connected.length ? <>
          {so!.platforms.map((p) => <View key={p.platform} style={styles.row}><Text style={[styles.rowTitle, { flex: 1 }]}>{PLATFORM_NAME[p.platform as keyof typeof PLATFORM_NAME] ?? p.platform}</Text>
            <Text style={styles.rowSub}>{[p.followers != null ? `${p.followers.toLocaleString(locale)} ${t('home.followers', 'followers')}` : null, p.reach != null ? `${p.reach.toLocaleString(locale)} ${t('home.reach', 'reach')}` : null, p.engagement != null ? `${p.engagement.toLocaleString(locale)} ${t('rep.eng', 'interactions')}` : null].filter(Boolean).join(' · ') || t('rep.noNumbers', 'No numbers yet')}</Text></View>)}
          <Text style={styles.sub}>{t('rep.posts', 'Posts')} {when}: {so!.postsInPeriod}</Text>
          {so!.recentPosts.map((p, i) => <View key={i} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text><Text style={styles.rowSub}>{PLATFORM_NAME[p.platform as keyof typeof PLATFORM_NAME] ?? p.platform}{p.published_at ? ` · ${dt(p.published_at)}` : ''}</Text></View></View>)}
        </> : <Text style={styles.muted}>{t('rep.noSocial', 'No social accounts connected yet.')}</Text>}
      </View>

      <View {...mark('assistant')} style={styles.section}>
        <Text style={styles.h}>{t('home.assistant', 'AI assistant report')}</Text>
        <Text style={styles.sub}>{a!.pendingApprovals ? `${a!.pendingApprovals} ${t('home.approvals', 'waiting for your approval')}` : t('home.noApprovals', 'Nothing waiting for approval')}</Text>
        {a!.suggestions.length ? a!.suggestions.map((x) => <Pressable key={x.key} style={styles.row} onPress={() => router.push('/suggestions' as any)}>
          <View style={{ flex: 1, gap: 2 }}><Text style={styles.rowTitle}>{x.title}</Text>{x.reason ? <Text style={styles.rowSub}>{t('rep.why', 'Why')}: {x.reason}</Text> : null}</View></Pressable>)
          : <Text style={styles.muted}>{t('rep.noSugg', 'No suggestions right now. They appear when your data shows something worth doing.')}</Text>}
        <Text style={styles.note}>{t('rep.noCompetitors', 'Competitor notes are shown only when they can be verified. None yet.')}</Text>
      </View>
    </> : null}
  </ScrollView>;
}

function Stats({ items }: { items: Array<[number, string]> }) {
  return <View style={styles.stats}>{items.map(([n, l], i) => <View key={i} style={styles.stat}><Text style={styles.statN}>{n}</Text><Text style={styles.statL} numberOfLines={2}>{l}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  brief: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 22, color: '#151515' },
  page: { padding: 16, gap: 24, paddingBottom: 120, maxWidth: 520, width: '100%', alignSelf: 'center' },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 10, backgroundColor: '#F2F2F2' },
  segItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: GREEN },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  section: { gap: 10 },
  h: { fontFamily: tokens.font.uiBold, fontSize: 20, color: '#151515' },
  sub: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  stat: { width: '33.33%', gap: 2 },
  statN: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#151515', fontVariant: ['tabular-nums'] },
  statL: { fontFamily: tokens.font.ui, fontSize: 12.5, color: GREY },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  time: { width: 76, fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#151515' },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 13, color: GREY },
  note: { fontFamily: tokens.font.ui, fontSize: 12, color: '#76767A' },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, color: GREY }
});
