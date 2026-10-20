import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { ListChecks } from 'phosphor-react-native/src/icons/ListChecks';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { BusinessSwitcher } from '../../src/components/BusinessSwitcher';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { getMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';
import { getHomeSummary, type HomeSummary } from '../../src/lib/home';
import { PLATFORM_NAME } from '../../src/lib/social';
import { tokens } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';

export const GREEN = '#151515';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useAppearance();
  const icon = { size: 16, color: palette.icon, weight: 'regular' as const };
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
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const s = sum?.schedule; const m = sum?.messages; const so = sum?.social; const imp = sum?.important; const a = sum?.assistant;
  const openReport = (section?: string) => router.push({ pathname: '/reports', params: section ? { section } : {} } as any);
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  const tasks = imp?.tasks ?? (a ? a.pendingApprovals + a.suggestions.length : null);

  const dateLine = now.toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const upcoming = (s?.items ?? []).filter((it) => it.status !== 'cancelled' && new Date(it.end_at).getTime() > now.getTime()).slice(0, 4);
  const live = (s?.items ?? []).filter((it) => it.status !== 'cancelled');
  const confirmed = live.filter((it) => it.status === 'confirmed').length;
  const pendingN = live.filter((it) => /pending|request|tentative|unconfirmed/i.test(it.status)).length;
  const statusLabel = (st: string) => t(`home.stShort.${st}`, { defaultValue: st === 'confirmed' ? 'Confirmed' : /pending|request|unconfirmed/i.test(st) ? 'Pending' : st === 'completed' ? 'Done' : st === 'no_show' ? 'No-show' : st ? st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, ' ') : '' });
  const na = t('home.unavailable', 'Unavailable');

  return <Screen onRefresh={load} onSwipeUpAtEnd={() => openReport()} header={<View style={styles.pinned}>
    <View style={styles.top}>
      <View style={{ flex: 1 }}><BusinessSwitcher onChanged={() => void load()} /></View>
      <View style={[styles.actions, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('nav.newBooking', 'New booking')} onPress={() => router.push('/bookings/new' as any)} style={styles.actionHit}><Plus size={24} color={palette.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('top.notifications', 'Notifications')} onPress={() => router.push('/notifications' as any)} style={styles.actionHit}><Bell size={24} color={palette.text} /></Pressable>
      </View>
    </View>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={[styles.big, { color: palette.text }]}>{t('home.today', 'Today')}</Text>
      <Text style={[styles.sub, { color: palette.muted }]} numberOfLines={1}>{dateLine} · {name ? t('home.hiName', { defaultValue: 'Hi, {{name}}', name }) : t('home.hi', 'Hi')}</Text>
    </View>

    </View>}>
    {noStudio ? <NoStudio /> : <>
      {sumErr && !sum ? <Text style={[styles.muted, { color: palette.muted }]}>{t('home.sumError', 'Your numbers could not load right now. Pull down to try again.')}</Text> : null}
      <Text style={[styles.section, { color: palette.text }]}>{t('home.upNext', 'Up next')}</Text>
      <View style={[styles.list, { backgroundColor: palette.glass, borderColor: palette.border }]}>
        {!s ? <Text style={[styles.empty, { color: palette.muted }]}>{sumErr ? t('home.sumError', 'Your numbers could not load right now. Pull down to try again.') : t('today.loading')}</Text> : null}
        {s && !upcoming.length ? <Text style={[styles.empty, { color: palette.muted }]}>{t('home.noMore', 'Nothing else booked today')}</Text> : null}
        {upcoming.map((it, i) => <Pressable key={it.id} accessibilityRole="button" onPress={() => router.push(`/bookings/${it.id}` as any)} style={({ pressed }) => [styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }, pressed && { backgroundColor: palette.fill }]}>
          <Text style={[styles.itemSub, { color: palette.muted, minWidth: 44 }]}>{time(it.start_at)}</Text>
          <Text numberOfLines={1} style={[styles.itemTitle, { color: palette.text, flex: 1 }]}>{[it.client, it.service].filter(Boolean).join(' · ') || t('home.booking1', 'booking')}</Text>
          {statusLabel(it.status) ? <Text numberOfLines={1} style={[styles.itemSub, { color: palette.muted, textAlign: 'right' }]}>{statusLabel(it.status)}</Text> : null}
          <CaretRight size={16} color={palette.muted} />
        </Pressable>)}
      </View>
      <View style={styles.grid}>
        <Tile title={t('home.bookingsToday', 'Bookings today')} value={s ? String(live.length) : '—'} line={s ? `${confirmed} ${t('home.confirmed', 'confirmed')} · ${pendingN} ${t('home.pendingShort', 'pending')}` : ''} oneLine onPress={() => router.push('/calendar' as any)} />
        <Tile title={t('home.booked', 'Booked')} value={live.length ? '—' : '¥0'} line={live.length ? t('home.thisWeek', 'this week') : t('home.noBookingsYet', 'No bookings yet')} onPress={() => openReport('schedule')} />
        <Tile title={t('home.unreadTitle', 'Unread')} value={m ? String(m.unread) : na} line={t('home.chatsWaiting', 'chats waiting')} onPress={() => router.push('/messages' as any)} />
        <Tile title={t('home.scheduled', 'Scheduled')} value={imp?.scheduledPosts != null ? String(imp.scheduledPosts) : na} line={imp?.scheduledPosts === 1 ? t('home.postToday', 'post today') : t('home.postsTodayS', 'posts today')} onPress={() => openReport('social')} />
      </View>
    </>}
  </Screen>;
}

function Tile({ title, value, line, onPress, oneLine }: { title: string; value: string; line: string; onPress: () => void; oneLine?: boolean }) {
  const { palette } = useAppearance();
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${value}`} onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: palette.glass, borderColor: palette.border }, pressed && { backgroundColor: palette.fill }]}>
    <Text numberOfLines={1} style={[styles.tileTitle, { color: palette.muted }]}>{title}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[(value === t('home.unavailable', 'Unavailable') || value === '—') ? styles.tileNa : styles.tileValue, { color: value === t('home.unavailable', 'Unavailable') ? palette.muted : palette.text }]}>{value}</Text>
    {line ? <Text numberOfLines={oneLine ? 1 : 2} adjustsFontSizeToFit={oneLine} minimumFontScale={0.8} style={[styles.tileLine, oneLine && styles.tileLineTight, { color: palette.muted }]}>{line}</Text> : null}
  </Pressable>;
}

function Box({ icon, title, value, unit, lines, onPress }: { icon: ReactNode; title: string; value: string; unit?: string; lines: string[]; onPress: () => void }) {
  const { palette } = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${value} ${unit ?? ''}`} onPress={onPress} style={({ pressed }) => [styles.box, { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss }, pressed && { backgroundColor: palette.fill }]}>
    <View style={styles.titleRow}>{icon}<Text style={[styles.boxTitle, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{title}</Text></View>
    <Text style={[styles.value, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}{unit ? <Text style={[styles.unit, { color: palette.muted }]}> {unit}</Text> : null}</Text>
    <View style={{ gap: 4, flex: 1 }}>{lines.filter(Boolean).slice(0, 3).map((l, i) => <Text key={i} style={[styles.line, { color: palette.muted }]} numberOfLines={1}>{l}</Text>)}</View>
    <View style={[styles.arrow, { backgroundColor: palette.fill }]}><ArrowUpRight size={18} color={palette.icon} weight="bold" /></View>
  </Pressable>;
}

function Goal({ label, n, goal, of }: { label: string; n: number; goal: number; of: string }) {
  const pct = goal > 0 ? Math.min(1, n / goal) : 0;
  return <View style={{ gap: 6 }}>
    <View style={styles.titleRow}><Text style={styles.goalLabel}>{label}</Text><Text style={styles.goalOf}>{of}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
  </View>;
}

function Practice({ title, sub, onPress, last }: { title: string; sub: string; onPress: () => void; last?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.practice, !last && styles.practiceLine]}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.practiceTitle}>{title}</Text>
      <Text style={styles.note}>{sub}</Text>
    </View>
    <CaretRight size={16} color="#000" />
  </Pressable>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  actionHit: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  section: { fontFamily: tokens.font.uiBold, fontSize: 22, lineHeight: 28, marginTop: 4 },
  list: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
  itemTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  itemSub: { fontFamily: tokens.font.ui, fontSize: 15 },
  itemStatus: { fontFamily: tokens.font.ui, fontSize: 16 },
  empty: { fontFamily: tokens.font.ui, fontSize: 15, padding: 16 },
  tile: { width: '48.4%', minHeight: 128, padding: 16, paddingHorizontal: 14, gap: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  tileTitle: { fontFamily: tokens.font.uiMedium, fontSize: 15 },
  tileValue: { fontFamily: tokens.font.uiBold, fontSize: 28, lineHeight: 34 },
  tileLine: { fontFamily: tokens.font.ui, fontSize: 13, lineHeight: 17 },
  tileLineTight: { fontSize: 12, letterSpacing: -0.1 },
  tileNa: { fontFamily: tokens.font.uiSemibold, fontSize: 18, lineHeight: 34 },
  pinned: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hi: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#6B645B' },
  welcome: { fontFamily: tokens.font.uiBold, fontSize: 17, color: '#151515' },
  big: { fontFamily: tokens.font.uiBold, fontSize: 34, lineHeight: 41, color: '#151515', letterSpacing: -0.5 },
  sub: { fontFamily: tokens.font.ui, fontSize: 17, lineHeight: 22, color: '#151515' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  box: { width: '48.4%', minHeight: 196, padding: 16, gap: 8, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEDED', shadowColor: '#151515', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxTitle: { flex: 1, fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  value: { fontFamily: tokens.font.uiBold, fontSize: 22, lineHeight: 28, color: '#151515' },
  unit: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#6B645B' },
  line: { fontFamily: tokens.font.ui, fontSize: 13.5, lineHeight: 18, color: '#151515' },
  arrow: { alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F2' },
  card: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2F2F2' },
  cardTitle: { fontFamily: tokens.font.uiBold, fontSize: 17, color: '#151515' },
  goalLabel: { flex: 1, fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#151515' },
  goalOf: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515', fontVariant: ['tabular-nums'] },
  track: { height: 3, borderRadius: 2, backgroundColor: '#F2F2F2', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#151515' },
  inspire: { fontFamily: tokens.font.uiSemibold, fontSize: 16, lineHeight: 22, color: '#151515' },
  practice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  practiceLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F2F2' },
  practiceTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  note: { fontFamily: tokens.font.ui, fontSize: 13, lineHeight: 18, color: '#6B645B' },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6B645B' }
});
