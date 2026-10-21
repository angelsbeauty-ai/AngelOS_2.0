import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react-native/src/icons/Check';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SatinGlyph } from '../../src/components/SatinGlyph';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState, Skeleton } from '../../src/components/ui';
import { Screen } from '../../src/components/Screen';
import { PostThumb } from '../../src/components/PostThumb';
import { NoStudio } from '../../src/components/NoStudio';
import { useAppearance } from '../../src/design/appearance';
import { tokens } from '../../src/design/theme';
import { listContent, type ContentPost } from '../../src/lib/content';
import { gridDate, gridPosts, isCarousel, isScheduled, isVideo, stateOf, type GridFilter, type GridTab } from '../../src/lib/grid';
import { getMediaViewUrl } from '../../src/lib/media';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';

const GAP = 1;
const FILTERS: GridFilter[] = ['published', 'scheduled', 'drafts', 'archive'];
const TABS: GridTab[] = ['grid', 'reels', 'stories'];

/**
 * Content grid (Meta Business Suite style): how the Instagram profile will look.
 * Real posts only. Opened from Calendar, and from New post with the draft's photo + time ("pending")
 * so you can see where it will sit.
 */
export default function ContentGrid() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ pendingAsset?: string; pendingAt?: string; pendingKind?: string; pendingCount?: string }>();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const rose = night ? tokens.color.roseGoldNight : tokens.color.roseGold;
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [ws, setWs] = useState<string | null>(null);
  const [all, setAll] = useState<ContentPost[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'nostudio'>('loading');
  const pendingTab: GridTab = params.pendingKind === 'reel' ? 'reels' : params.pendingKind === 'story' ? 'stories' : 'grid';
  const [tab, setTab] = useState<GridTab>(params.pendingAsset ? pendingTab : 'grid');
  const [filter, setFilter] = useState<GridFilter>(params.pendingAsset ? 'scheduled' : 'published');
  const [menu, setMenu] = useState(false);
  const [list, setList] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState('loading');
      const w = await getActiveWorkspace(); setWs(w.id);
      setAll(await listContent(w.id)); setState('ok');
      if (params.pendingAsset) void getMediaViewUrl(w.id, String(params.pendingAsset)).then((r) => setPendingUrl(r.url)).catch(() => undefined);
    } catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); }
  }, [params.pendingAsset]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const outer = Math.min(width, 600) - 32;
  const cell = Math.floor((outer - GAP * 2) / 3);
  const tileH = cell; // square crops on every tab
  const posts = all ? gridPosts(all, tab, filter) : [];
  const pendingAt = params.pendingAt ? new Date(String(params.pendingAt)) : null;
  const showPending = Boolean(params.pendingAsset) && tab === pendingTab && filter === 'scheduled';
  const pendingIndex = showPending ? Math.max(0, posts.findIndex((p) => (gridDate(p)?.getTime() ?? 0) < (pendingAt?.getTime() ?? Date.now()))) : -1;
  const idx = pendingIndex === -1 || pendingIndex > posts.length ? posts.length : pendingIndex;
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-GB';
  const when = (d: Date | null) => (d ? d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const ph = night ? '#2C2C2E' : '#EDEDED';

  function tile(p: ContentPost) {
    const sched = isScheduled(p);
    const label = [p.title, sched ? t('grid.scheduledFor', { when: when(gridDate(p)) }) : when(gridDate(p)), isCarousel(p) ? t('grid.carousel') : null, isVideo(p) ? t('grid.video') : null].filter(Boolean).join(', ');
    return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(`/content/${p.id}` as any)} style={({ pressed }) => [{ width: cell, height: tileH, opacity: pressed ? 0.85 : 1 }]}>
      <PostThumb workspaceId={ws} post={p} size={cell} height={tileH} radius={0} placeholder={ph} />
      {tab === 'grid' && isCarousel(p) ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="carousel" color="#FFFFFF" size={16} /></View> : null}
      {tab === 'grid' && !isCarousel(p) && isVideo(p) ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="play" color="#FFFFFF" size={16} /></View> : null}
      {tab === 'reels' ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="play" color="#FFFFFF" size={16} /></View> : null}
      {tab === 'stories' ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="story" color="#FFFFFF" size={16} /></View> : null}
      {sched ? <View pointerEvents="none" style={[styles.clock, { backgroundColor: tokens.color.roseGold }]}><SatinGlyph name="clock" color="#FFFFFF" size={13} /></View> : null}
    </Pressable>;
  }

  function pendingTile() {
    return <View key="pending" accessible accessibilityLabel={t('grid.pendingA11y', { when: when(pendingAt) })} style={{ width: cell, height: tileH }}>
      {pendingUrl ? <Image source={{ uri: pendingUrl }} resizeMode="cover" style={{ width: cell, height: tileH }} /> : <View style={{ width: cell, height: tileH, backgroundColor: ph }} />}
      <View pointerEvents="none" style={[styles.clock, { backgroundColor: tokens.color.roseGold }]}><SatinGlyph name="pencil" color="#FFFFFF" size={13} /></View>
    </View>;
  }

  function row(p: ContentPost) {
    const sched = isScheduled(p);
    return <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/content/${p.id}` as any)} style={[styles.row, { borderColor: palette.border }]}>
      <PostThumb workspaceId={ws} post={p} size={56} height={56} radius={8} placeholder={ph} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.6} style={[styles.rowTitle, { color: palette.text }]}>{p.title || (p.variants?.[0]?.caption ?? '').slice(0, 60)}</Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.6} style={[styles.rowSub, { color: palette.muted }]}>{t(`grid.st.${stateLabel(stateOf(p))}`)}{gridDate(p) ? ` · ${when(gridDate(p))}` : ''}</Text>
      </View>
      {sched ? <SatinGlyph name="clock" color={rose} size={16} /> : null}
    </Pressable>;
  }

  const tiles: React.ReactNode[] = posts.map(tile);
  if (showPending) tiles.splice(idx, 0, pendingTile());
  const empty = state === 'ok' && !posts.length && !showPending;

  return <Screen hideAsk onRefresh={load}>
    <View style={styles.head}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.large, { color: palette.text }]}>{t('grid.content')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/content/new', params: { format: tab === 'reels' ? 'reel' : tab === 'stories' ? 'story' : 'post' } } as any)} style={({ pressed }) => [styles.create, { backgroundColor: pressed ? '#72443A' : tokens.color.roseGold }]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.createText, { color: '#FFFFFF' }]}>{t('grid.create')}</Text>
      </Pressable>
    </View>

    <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: palette.border }]}>
      {TABS.map((k) => <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={styles.tabItem}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.tabText, { color: tab === k ? palette.text : palette.muted }]}>{t(`grid.tab.${k}`)}</Text>
        <View style={[styles.underline, { backgroundColor: tab === k ? rose : 'transparent' }]} />
      </Pressable>)}
    </View>

    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('grid.filterA11y', { name: t(`grid.f.${filter}`) })} onPress={() => setMenu(true)} style={styles.drop}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.dropText, { color: palette.text }]}>{t(`grid.f.${filter}`)}</Text>
        <SatinGlyph name="caretDown" color={rose} size={16} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={list ? t('grid.showGrid') : t('grid.showList')} onPress={() => setList((x) => !x)} hitSlop={8} style={styles.toggle}>
        <SatinGlyph name={list ? 'grid' : 'list'} color={rose} size={22} />
      </Pressable>
    </View>

    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'loading' && !all ? <Skeleton rows={3} height={cell} /> : null}
    {state === 'error' ? <ErrorState title={t('grid.errTitle')} message={t('grid.errBody')} onRetry={() => void load()} /> : null}
    {empty ? <EmptyState title={t(`grid.empty.${tab}`)} message={t(`grid.emptyF.${filter}`)} action={{ label: t('grid.create'), onPress: () => router.push('/content/new' as any) }} /> : null}
    {state === 'ok' && !empty ? <Animated.View key={`${tab}-${filter}-${list}`} entering={reduceMotion ? undefined : FadeIn.duration(180)}>
      {list ? <View>{posts.map(row)}</View> : <View style={[styles.grid, { width: outer }]}>{tiles}</View>}
    </Animated.View> : null}

    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
      <Pressable style={styles.scrim} onPress={() => setMenu(false)} accessibilityLabel={t('common.close', 'Close')}>
        <View style={[styles.menu, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: palette.border }]}>
          {FILTERS.map((f, i) => <Pressable key={f} accessibilityRole="menuitem" accessibilityState={{ selected: filter === f }} onPress={() => { setFilter(f); setMenu(false); }} style={[styles.menuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border }]}>
            <Text maxFontSizeMultiplier={1.6} style={[styles.menuText, { color: palette.text }]}>{t(`grid.f.${f}`)}</Text>
            {filter === f ? <Check size={16} color={rose} weight="bold" /> : null}
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </Screen>;
}

function stateLabel(s: string) { return s === 'published' || s === 'analyzed' ? 'published' : s === 'archived' ? 'archived' : s === 'draft' || s === 'prepared' ? 'draft' : s === 'failed' ? 'failed' : 'scheduled'; }

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 },
  large: { ...tokens.type.largeTitle, flexShrink: 1 },
  create: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: 'center' },
  createText: { ...tokens.type.headline },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  dropText: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tabItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'flex-end' },
  tabText: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold, paddingBottom: 10 },
  underline: { height: 2, alignSelf: 'stretch', borderRadius: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  corner: { position: 'absolute', top: 6, right: 6, opacity: 0.95 },
  clock: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold },
  rowSub: { ...tokens.type.footnote },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', paddingTop: 210, paddingHorizontal: 16 },
  menu: { width: 240, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  menuItem: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuText: { ...tokens.type.body }
});
