import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, G, Polygon, Polyline } from 'react-native-svg';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { Skeleton, screenHeader } from '../../src/components/ui';
import { PostThumb } from '../../src/components/PostThumb';
import { BrandLogo } from '../../src/components/BrandBadge';
import { getInsights, PLATFORM_NAME, type InsightCard, type Insights } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, D } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';

const PLATS = ['all', 'instagram', 'facebook', 'line'] as const;
type Plat = typeof PLATS[number];
const BRAND: Record<string, string> = { instagram: '#D62976', facebook: '#1877F2', line: '#06C755', tiktok: '#151515' };
const GREY = '#6B645B';

/** Analytics, Meta Business Suite Insights style: last 30 days vs the 30 before. Stored real metrics only. */
export default function AnalyticsScreen() {
  const { palette, mode: look } = useAppearance();
  const nt = look === 'night' ? { color: palette.text } : null; const nm = look === 'night' ? { color: palette.muted } : null; const nc = look === 'night' ? { backgroundColor: palette.glass, borderColor: palette.border, shadowOpacity: 0 } : null;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const [plat, setPlat] = useState<Plat>('all');
  const [ws, setWs] = useState<string | null>(null);
  const [data, setData] = useState<Insights | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [tab, setTab] = useState<'views' | 'interactions' | 'follows'>('views');
  const [pickOpen, setPickOpen] = useState(false);
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
    <View style={screenHeader.row}>
      <Text accessibilityRole="header" style={[screenHeader.title, nt]}>{t('tabs.analytics')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('ins.platform', { defaultValue: 'Platform' })} onPress={() => setPickOpen(true)} style={[styles.picker, nc]}>
        <View style={styles.logos}>{(plat === 'all' ? ['instagram', 'facebook', 'line'] : [plat]).map((p, i) => <View key={p} style={[styles.logoRing, i > 0 && { marginLeft: -6 }]}><BrandLogo platform={p} size={20} /></View>)}</View>
        <CaretDown size={14} color={D.text} weight="bold" />
      </Pressable>
    </View>
    <Modal visible={pickOpen} transparent animationType="fade" onRequestClose={() => setPickOpen(false)}>
      <Pressable style={styles.menuBack} onPress={() => setPickOpen(false)}><View style={styles.menu}>
        {PLATS.map((p, i) => <Pressable key={p} accessibilityRole="button" accessibilityState={{ selected: plat === p }} onPress={() => { setPickOpen(false); pick(p); }} style={[styles.menuRow, i > 0 && styles.menuLine]}>
          {p !== 'all' ? <BrandLogo platform={p} size={20} /> : null}<Text style={[styles.segText, plat === p && { color: D.text }]}>{p === 'all' ? t('messages.all') : PLATFORM_NAME[p as keyof typeof PLATFORM_NAME]}</Text></Pressable>)}
      </View></Pressable>
    </Modal>

    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'loading' ? <Skeleton rows={3} height={110} /> : null}
    {state === 'error' ? <Text style={[styles.muted, nm]}>{t('ins.error', 'Insights could not load right now. Pull down to try again.')}</Text> : null}
    {state === 'ready' && data ? <>
      {!data.connected.length ? <Text style={[styles.muted, nm]}>{t('ins.noAccounts', 'Connect Instagram, Facebook or LINE to see insights here.')}</Text> : null}
      <Text style={[styles.headline, nt]}>{h == null ? t('ins.noData', { defaultValue: 'No {{name}}views recorded in the last 30 days yet.', name }) : h.change == null ? t('ins.headFlatNew', { defaultValue: 'Your {{name}}views: {{n}} in the last 30 days', name, n: fmt(h.total) })
        : Math.abs(h.change) < 5 ? t('ins.headSteady', { defaultValue: 'A steady month. Your {{name}}views are about the same as usual.', name })
        : h.change > 0 ? t('ins.headUp', { defaultValue: 'A good month. Your {{name}}views are a little above your usual.', name }) : t('ins.headDown', { defaultValue: 'A quieter month. Your {{name}}views are a little below your usual.', name })}</Text>
      <Text style={[styles.period, nm]}>{t('ins.period', 'Last 30 days · vs your previous 30')}</Text>
      {data.note ? <Text style={[styles.muted, nm]}>{data.note}</Text> : null}
      <View style={styles.grid}>{data.cards.map((c) => <View key={c.key} style={[styles.card, nc]}>
        <Text style={[styles.cardTitle, nt]} numberOfLines={2}>{label[c.key]}</Text>
        {c.total == null && c.key === 'linkClicks' ? null : <Spark lines={c.lines} />}
        <View style={styles.numRow}>
          <Text style={[styles.num, nt, c.total == null && { color: D.faint }]}>{c.total == null ? (c.key === 'linkClicks' ? '—' : '0') : fmt(c.total)}</Text>
          {c.total != null ? <Change v={c.change} prev={c.previous} /> : null}
        </View>
        {c.total == null && c.key === 'linkClicks' ? <Text style={[styles.na, nm]}>{t('ins.linkHint', 'Add a link to your bio and clicks will appear here')}</Text> : null}
      </View>)}</View>

      <View style={styles.topHead}><Text style={[styles.h2, nt]}>{t('ins.topBy', 'Top content by')} {tab === 'views' ? t('ins.viewsLc', 'views') : tab === 'interactions' ? t('ins.interLc', 'interactions') : t('ins.followsLc', 'follows')}</Text>
        <Pressable onPress={() => router.push({ pathname: '/calendar' } as any)}><Text style={[styles.seeAll, nt]}>{t('ins.seeAll', 'See all')}</Text></Pressable></View>
      <View style={styles.tabs}>{(['views', 'interactions', 'follows'] as const).map((k) => <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, nc, tab === k && styles.tabOn, tab === k && look === 'night' && { backgroundColor: '#F4F4F5', borderColor: '#F4F4F5' }]}><Text style={[styles.tabText, nt, tab === k && { color: look === 'night' ? '#151515' : '#FFFFFF' }]}>{k === 'views' ? t('ins.views', 'Views') : k === 'interactions' ? t('ins.interShort', 'Interactions') : t('ins.follows', 'Follows')}</Text></Pressable>)}</View>
      {top.length ? <View style={styles.tiles}>{top.slice(0, 3).map((p) => <Pressable key={p.variantId} style={styles.tile} onPress={() => p.post?.id && router.push(`/content/${p.post.id}` as any)}>
        {p.post ? <PostThumb workspaceId={ws} post={p.post} size={112} radius={12} /> : <View style={[styles.tileBlank]} />}
        <View style={styles.badge}><Text style={styles.badgeText}>{fmt(p.value)}</Text></View></Pressable>)}</View>
        : <Text style={[styles.muted, nm]}>{tab === 'follows' ? t('ins.noFollowsPer', 'Follows per post are not available from the platforms yet.') : t('ins.noTop', 'No post numbers recorded in the last 30 days yet.')}</Text>}

    </> : null}
  </Screen>;
}

/** Compared with her own previous period only. Never red or green. */
function Change({ v, prev }: { v: number | null; prev: number | null }) {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance(); const c = mode === 'night' ? { color: palette.muted } : null;
  if (v == null) return null;
  if (Math.abs(v) < 5) return <Text style={[styles.chg, c]}>{t('ins.same', 'about the same')}</Text>;
  if (v < 0) return <Text style={[styles.chg, c]} numberOfLines={2}>{t('ins.quieter', 'a little quieter than usual')}</Text>;
  return <Text style={[styles.chg, c]}>{t('ins.vsYou', { defaultValue: '+{{n}}% vs you', n: v })}</Text>;
}

function Spark({ lines }: { lines: InsightCard['lines'] }) {
  const W = 140, H = 34;
  const all = lines.flatMap((l) => l.points).filter((x): x is number => x != null);
  const max = Math.max(1, ...all);
  return <View style={{ height: H, justifyContent: 'flex-end' }}>
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {lines.length ? lines.map((l) => { const n = l.points.length; const pts = l.points.map((v, i) => `${((i / Math.max(1, n - 1)) * W).toFixed(1)},${(H - 2 - ((v ?? 0) / max) * (H - 6)).toFixed(1)}`).join(' ');
        const last = pts.split(' ').pop()?.split(',').map(Number) ?? [W, H];
        return <G key={l.platform}><Polygon points={`0,${H} ${pts} ${W},${H}`} fill={D.accent} fillOpacity={0.18} /><Polyline points={pts} fill="none" stroke={D.accentDeep} strokeWidth={1.4} /><Circle cx={last[0]} cy={last[1]} r={2} fill={D.accentDeep} /></G>; })
        : null}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 24, color: '#151515' },
  headRow: { flexDirection: 'row', alignItems: 'center', marginTop: -4 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline },
  logos: { flexDirection: 'row' },
  logoRing: { borderRadius: 999, backgroundColor: '#FFFFFF', padding: 1 },
  menuBack: { flex: 1, alignItems: 'flex-end', paddingTop: 140, paddingRight: 16 },
  menu: { width: 200, borderRadius: 22, backgroundColor: '#FFFFFF', paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline, shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  menuRow: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  menuLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: D.hairline },
  period: { fontFamily: tokens.font.uiMedium, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: D.muted, marginTop: -12 },
  seg: { flexDirection: 'row', gap: 6 },
  segItem: { flex: 1, flexDirection: "row", gap: 4, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segOn: { backgroundColor: '#F2F2F2' },
  segText: { flexShrink: 1, fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#151515' },
  headline: { fontFamily: tokens.font.uiBold, fontSize: 21, lineHeight: 28, color: '#151515', textAlign: 'left' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  card: { width: '47.8%', minHeight: 150, padding: 14, gap: 8, borderRadius: 22, backgroundColor: '#FFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', shadowColor: '#151515', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, lineHeight: 20, color: '#151515', minHeight: 40 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#151515', fontVariant: ['tabular-nums'] },
  chg: { flexShrink: 1, fontFamily: tokens.font.uiMedium, fontSize: 13.5, color: D.text2 },
  na: { fontFamily: tokens.font.ui, fontSize: 11.5, color: D.text2, marginTop: -4 },
  topHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  h2: { fontFamily: tokens.font.uiBold, fontSize: 19, color: '#151515' },
  seeAll: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline },
  tabOn: { backgroundColor: D.text, borderColor: D.text },
  tabText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  tiles: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { width: '32%', aspectRatio: 0.85, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  tileBlank: { flex: 1, alignSelf: 'stretch' },
  badge: { position: 'absolute', bottom: 8, alignSelf: 'center', minWidth: 44, paddingHorizontal: 10, height: 22, borderRadius: 11, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: tokens.font.uiSemibold, fontSize: 12.5, color: '#151515' },
  muted: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21, color: GREY }
});
