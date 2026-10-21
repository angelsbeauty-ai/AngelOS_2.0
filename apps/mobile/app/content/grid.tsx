import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { Copy } from 'phosphor-react-native/src/icons/Copy';
import { InstagramLogo } from 'phosphor-react-native/src/icons/InstagramLogo';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { CircleDashed } from 'phosphor-react-native/src/icons/CircleDashed';
import { Play } from 'phosphor-react-native/src/icons/Play';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Screen } from '../../src/components/Screen';
import { PostThumb } from '../../src/components/PostThumb';
import { NoStudio } from '../../src/components/NoStudio';
import { useAppearance } from '../../src/design/appearance';
import { tokens } from '../../src/design/theme';
import { listContent, type ContentPost } from '../../src/lib/content';
import { gridDate, gridPosts, isCarousel, isScheduled, isVideo, stateOf, type GridFilter, type GridTab } from '../../src/lib/grid';
import { getMediaViewUrl } from '../../src/lib/media';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';

const GAP = 2;
const FILTERS: GridFilter[] = ['published', 'scheduled', 'drafts', 'archive'];
const TABS: GridTab[] = ['grid', 'reels', 'stories'];
const ACCENT = tokens.color.charcoal; // the app's accent token (Neutral Calm)

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
  const glyph = { color: '#FFFFFF', size: 14, weight: 'fill' as const };
  const shade = { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 0 } };
  const ph = night ? '#2C2C2E' : '#EDEDED';

  function tile(p: ContentPost) {
    const sched = isScheduled(p);
    const label = [p.title, sched ? t('grid.scheduledFor', { when: when(gridDate(p)) }) : when(gridDate(p)), isCarousel(p) ? t('grid.carousel') : null, isVideo(p) ? t('grid.video') : null].filter(Boolean).join(', ');
    return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(`/content/${p.id}` as any)} style={({ pressed }) => [{ width: cell, height: tileH, opacity: pressed ? 0.85 : 1 }]}>
      <PostThumb workspaceId={ws} post={p} size={cell} height={tileH} radius={0} placeholder={ph} />
      <View pointerEvents="none" style={[styles.corner, shade]}>
        {tab === 'grid' && isCarousel(p) ? <Copy {...glyph} /> : null}
        {tab === 'grid' && !isCarousel(p) && isVideo(p) ? <Play {...glyph} /> : null}
      </View>
      {tab === 'reels' ? <View pointerEvents="none" style={[styles.corner, shade]}><Play {...glyph} size={13} /></View> : null}
      {tab === 'stories' ? <View pointerEvents="none" style={[styles.corner, shade]}><CircleDashed {...glyph} size={14} weight="bold" /></View> : null}
      {sched ? <View pointerEvents="none" style={[styles.clock, shade]}><Clock {...glyph} size={13} weight="bold" /></View> : null}
    </Pressable>;
  }

  function pendingTile() {
    return <View key="pending" accessible accessibilityLabel={t('grid.pendingA11y', { when: when(pendingAt) })} style={{ width: cell, height: tileH }}>
      {pendingUrl ? <Image source={{ uri: pendingUrl }} resizeMode="cover" style={{ width: cell, height: tileH }} /> : <View style={{ width: cell, height: tileH, backgroundColor: ph }} />}
      <View pointerEvents="none" style={[styles.clock, shade]}><PencilSimple {...glyph} size={13} weight="bold" /></View>
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
      {sched ? <Clock size={16} color={palette.muted} /> : null}
    </Pressable>;
  }

  const tiles: React.ReactNode[] = posts.map(tile);
  if (showPending) tiles.splice(idx, 0, pendingTile());
  const empty = state === 'ok' && !posts.length && !showPending;

  return <Screen hideAsk onRefresh={load}>
    <View style={styles.head}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.large, { color: palette.text }]}>{t('grid.content')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/content/new', params: { format: tab === 'reels' ? 'reel' : tab === 'stories' ? 'story' : 'post' } } as any)} style={({ pressed }) => [styles.create, { backgroundColor: night ? '#FFFFFF' : ACCENT, opacity: pressed ? 0.8 : 1 }]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.createText, { color: night ? '#151515' : '#FFFFFF' }]}>{t('grid.create')}</Text>
      </Pressable>
    </View>

    <View accessibilityRole="tablist" style={[styles.seg, { backgroundColor: night ? '#1C1C1E' : '#EFEFF0' }]}>
      {TABS.map((k) => <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[styles.segItem, tab === k && [styles.segOn, { backgroundColor: night ? '#3A3A3C' : '#FFFFFF' }]]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.segText, { color: tab === k ? palette.text : palette.muted }]}>{t(`grid.tab.${k}`)}</Text>
      </Pressable>)}
    </View>

    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('grid.filterA11y', { name: t(`grid.f.${filter}`) })} onPress={() => setMenu(true)} style={[styles.drop, { borderColor: palette.border }]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.dropText, { color: palette.text }]}>{t(`grid.f.${filter}`)}</Text>
        <CaretDown size={14} color={palette.muted} weight="bold" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={list ? t('grid.showGrid') : t('grid.showList')} onPress={() => setList((x) => !x)} hitSlop={8} style={[styles.toggle, { borderColor: palette.border }]}>
        {list ? <InstagramLogo size={20} color={palette.icon} /> : <ListBullets size={20} color={palette.icon} />}
      </Pressable>
    </View>

    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'loading' && !all ? <View style={styles.grid}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={{ width: cell, height: tileH, backgroundColor: ph, opacity: 0.6 }} />)}</View> : null}
    {state === 'error' ? <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('grid.errTitle')}</Text>
      <Text style={[styles.emptyBody, { color: palette.muted }]}>{t('grid.errBody')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.drop, { borderColor: palette.border, alignSelf: 'center' }]}><Text style={[styles.dropText, { color: palette.text }]}>{t('grid.retry')}</Text></Pressable>
    </View> : null}
    {empty ? <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{t(`grid.empty.${tab}`)}</Text>
      <Text style={[styles.emptyBody, { color: palette.muted }]}>{t(`grid.emptyF.${filter}`)}</Text>
    </View> : null}
    {state === 'ok' && !empty ? (list ? <View>{posts.map(row)}</View> : <View style={[styles.grid, { width: outer }]}>{tiles}</View>) : null}

    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
      <Pressable style={styles.scrim} onPress={() => setMenu(false)} accessibilityLabel={t('common.close', 'Close')}>
        <View style={[styles.menu, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: palette.border }]}>
          {FILTERS.map((f, i) => <Pressable key={f} accessibilityRole="menuitem" accessibilityState={{ selected: filter === f }} onPress={() => { setFilter(f); setMenu(false); }} style={[styles.menuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border }]}>
            <Text maxFontSizeMultiplier={1.6} style={[styles.menuText, { color: palette.text }]}>{t(`grid.f.${f}`)}</Text>
            {filter === f ? <Check size={16} color={palette.text} weight="bold" /> : null}
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
  create: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  createText: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: 12 },
  segItem: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  dropText: { fontFamily: tokens.font.uiMedium, fontSize: 14 },
  toggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  corner: { position: 'absolute', top: 6, right: 6 },
  bottomLeft: { position: 'absolute', bottom: 6, left: 6 },
  clock: { position: 'absolute', top: 6, left: 6, opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 13 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyTitle: { ...tokens.type.headline, textAlign: 'center' },
  emptyBody: { ...tokens.type.subhead, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', paddingTop: 210, paddingHorizontal: 16 },
  menu: { width: 240, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  menuItem: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuText: { fontFamily: tokens.font.ui, fontSize: 16 }
});
