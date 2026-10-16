import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Polyline } from 'react-native-svg';
import { ArrowDown } from 'phosphor-react-native/src/icons/ArrowDown';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { Skeleton } from '../../src/components/ui';
import { PostThumb } from '../../src/components/PostThumb';
import { BrandLogo } from '../../src/components/BrandBadge';
import { getInsights, PLATFORM_NAME, type InsightCard, type Insights } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

const PLATS = ['all', 'instagram', 'facebook', 'line'] as const;
type Plat = typeof PLATS[number];
const BRAND: Record<string, string> = { instagram: '#D62976', facebook: '#1877F2', line: '#06C755', tiktok: '#000000' };
const UP = '#000000'; const DOWN = '#B3261E'; const GREY = '#737373';

/** Analytics, Meta Business Suite Insights style: last 30 days vs the 30 before. Stored real metrics only. */
export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const [plat, setPlat] = useState<Plat>('all');
  const [ws, setWs] = useState<string | null>(null);
  const [data, setData] = useState<Insights | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [tab, setTab] = useState<'views' | 'interactions' | 'follows'>('views');
  const load = useCallback(async (p: Plat = plat) => {
    try { const w = await getActiveWorkspace(); setWs(w.id); setData(await getInsights(w.id, p)); setState('ready'); }
    catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); }
  }, [plat]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const pick = (p: Plat) => { setPlat(p); setState('loading'); void load(p); };
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString(locale);
  const name = plat === 'all' ? '' : `${PLATFORM_NAME[plat as keyof typeof PLATFORM_NAME] ?? plat} `;
  const h = data?.headline;
  const label: Record<InsightCard['key'], string> = { views: t('ins.views', 'Views'), interactions: t('ins.interactions', 'Content interactions'), follows: t('ins.follows', 'Follows'), linkClicks: t('ins.linkClicks', 'Link clicks') };
  const top = data ? (tab === 'follows' ? [] : data.top[tab]) : [];

  return <Screen onRefresh={() => load()}>
    <Text accessibilityRole="header" style={styles.title}>{t('tabs.analytics')}</Text>
    <View style={styles.seg}>{PLATS.map((p) => <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: plat === p }} onPress={() => pick(p)} style={[styles.segItem, plat === p && styles.segOn]}>
      {p !== 'all' ? <BrandLogo platform={p} size={16} /> : null}<Text numberOfLines={1} style={[styles.segText, plat === p && { color: '#FFF' }]}>{p === 'all' ? t('messages.all') : PLATFORM_NAME[p as keyof typeof PLATFORM_NAME]}</Text></Pressable>)}</View>

    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'loading' ? <Skeleton rows={3} height={110} /> : null}
    {state === 'error' ? <Text style={styles.muted}>{t('ins.error', 'Insights could not load right now. Pull down to try again.')}</Text> : null}
    {state === 'ready' && data ? <>
      {!data.connected.length ? <Text style={styles.muted}>{t('ins.noAccounts', 'Connect Instagram, Facebook or LINE to see insights here.')}</Text> : null}
      <Text style={styles.headline}>{h == null ? t('ins.noData', { defaultValue: 'No {{name}}views recorded in the last 30 days yet.', name }) : h.change == null ? t('ins.headFlatNew', { defaultValue: 'Your {{name}}views: {{n}} in the last 30 days', name, n: fmt(h.total) })
        : h.change === 0 ? t('ins.headSame', { defaultValue: 'Your {{name}}views stayed the same in the last 30 days', name })
        : <>{t('ins.headPre', { defaultValue: 'Your {{name}}views {{dir}} by ', name, dir: h.change > 0 ? t('ins.increased', 'increased') : t('ins.decreased', 'decreased') })}<Text style={{ color: h.change > 0 ? UP : DOWN }}>{Math.abs(h.change)}%</Text>{t('ins.headPost', ' in the last 30 days')}</>}</Text>
      {data.note ? <Text style={styles.muted}>{data.note}</Text> : null}
      <View style={styles.grid}>{data.cards.map((c) => <View key={c.key} style={styles.card}>
        <Text style={styles.cardTitle} numberOfLines={2}>{label[c.key]}</Text>
        <Spark lines={c.lines} />
        <View style={styles.numRow}>
          <Text style={styles.num}>{c.total == null ? (c.key === 'linkClicks' ? '—' : '0') : fmt(c.total)}</Text>
          <Change v={c.change} />
        </View>
        {c.total == null && c.key === 'linkClicks' ? <Text style={styles.na}>{t('ins.na', 'Not available yet')}</Text> : null}
      </View>)}</View>

      <View style={styles.topHead}><Text style={styles.h2}>{t('ins.topBy', 'Top content by')} {tab === 'views' ? t('ins.viewsLc', 'views') : tab === 'interactions' ? t('ins.interLc', 'interactions') : t('ins.followsLc', 'follows')}</Text>
        <Pressable onPress={() => router.push({ pathname: '/calendar' } as any)}><Text style={styles.seeAll}>{t('ins.seeAll', 'See all')}</Text></Pressable></View>
      <View style={styles.tabs}>{(['views', 'interactions', 'follows'] as const).map((k) => <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}><Text style={[styles.tabText, tab === k && { color: '#000000' }]}>{k === 'views' ? t('ins.views', 'Views') : k === 'interactions' ? t('ins.interShort', 'Interactions') : t('ins.follows', 'Follows')}</Text></Pressable>)}</View>
      {top.length ? <View style={styles.tiles}>{top.slice(0, 3).map((p) => <Pressable key={p.variantId} style={styles.tile} onPress={() => p.post?.id && router.push(`/content/${p.post.id}` as any)}>
        {p.post ? <PostThumb workspaceId={ws} post={p.post} size={112} radius={12} /> : <View style={[styles.tileBlank]} />}
        <View style={styles.badge}><Text style={styles.badgeText}>{fmt(p.value)}</Text></View></Pressable>)}</View>
        : <Text style={styles.muted}>{tab === 'follows' ? t('ins.noFollowsPer', 'Follows per post are not available from the platforms yet.') : t('ins.noTop', 'No post numbers recorded in the last 30 days yet.')}</Text>}

    </> : null}
  </Screen>;
}

function Change({ v }: { v: number | null }) {
  if (v == null) return <Text style={[styles.chg, { color: GREY }]}>··</Text>;
  if (v === 0) return <Text style={[styles.chg, { color: GREY }]}>·· 0%</Text>;
  const up = v > 0;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{up ? <ArrowUp size={13} color={UP} weight="bold" /> : <ArrowDown size={13} color={DOWN} weight="bold" />}<Text style={[styles.chg, { color: up ? UP : DOWN }]}>{Math.abs(v)}%</Text></View>;
}

function Spark({ lines }: { lines: InsightCard['lines'] }) {
  const W = 140, H = 34;
  const all = lines.flatMap((l) => l.points).filter((x): x is number => x != null);
  const max = Math.max(1, ...all);
  return <View style={{ height: H, justifyContent: 'flex-end' }}>
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {lines.length ? lines.map((l) => { const n = l.points.length; const pts = l.points.map((v, i) => `${((i / Math.max(1, n - 1)) * W).toFixed(1)},${(H - 2 - ((v ?? 0) / max) * (H - 6)).toFixed(1)}`).join(' ');
        return <Polyline key={l.platform} points={pts} fill="none" stroke={lines.length > 1 ? BRAND[l.platform] ?? '#000000' : '#000000'} strokeWidth={1.4} />; })
        : <Polyline points={`0,${H - 2} ${W},${H - 2}`} fill="none" stroke="#DBDBDB" strokeWidth={1.4} />}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  title: { fontFamily: tokens.font.uiBold, fontSize: 24, color: '#000', marginTop: -4 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 10, backgroundColor: '#EFEFEF' },
  segItem: { flex: 1, flexDirection: 'row', gap: 5, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segOn: { backgroundColor: '#262626' },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 13.5, color: '#262626' },
  headline: { fontFamily: tokens.font.uiBold, fontSize: 21, lineHeight: 28, color: '#262626', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { width: '48.5%', minHeight: 150, padding: 14, gap: 8, borderRadius: 10, backgroundColor: '#FFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, lineHeight: 20, color: '#262626', minHeight: 40 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#000', fontVariant: ['tabular-nums'] },
  chg: { fontFamily: tokens.font.uiMedium, fontSize: 13.5 },
  na: { fontFamily: tokens.font.ui, fontSize: 11.5, color: '#8E8E8E', marginTop: -4 },
  topHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  h2: { fontFamily: tokens.font.uiBold, fontSize: 19, color: '#262626' },
  seeAll: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#000000' },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  tabOn: { backgroundColor: '#EFEFEF' },
  tabText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#262626' },
  tiles: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { width: '32%', aspectRatio: 0.85, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center' },
  tileBlank: { flex: 1, alignSelf: 'stretch' },
  badge: { position: 'absolute', bottom: 8, alignSelf: 'center', minWidth: 44, paddingHorizontal: 10, height: 22, borderRadius: 11, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: tokens.font.uiSemibold, fontSize: 12.5, color: '#262626' },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21, color: GREY }
});
