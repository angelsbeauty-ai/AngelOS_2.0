import { PostThumb } from '../../src/components/PostThumb';
import { NoStudio } from '../../src/components/NoStudio';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SquaresFour } from 'phosphor-react-native/src/icons/SquaresFour';
import { Plug } from 'phosphor-react-native/src/icons/Plug';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { InstagramLogo } from 'phosphor-react-native/src/icons/InstagramLogo';
import { FacebookLogo } from 'phosphor-react-native/src/icons/FacebookLogo';
import { TiktokLogo } from 'phosphor-react-native/src/icons/TiktokLogo';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { ImageSquare } from 'phosphor-react-native/src/icons/ImageSquare';
import { Scissors } from 'phosphor-react-native/src/icons/Scissors';
import { Screen } from '../../src/components/Screen';
import { Button, Overline, ScreenTitle, Skeleton } from '../../src/components/ui';
import { Chip, ROSE } from '../../src/components/SettingsList';
import { contentPostDate, listContent, listIdeas, publishContentVariant, type ContentIdea, type ContentPost } from '../../src/lib/content';
import { getSocialAccounts } from '../../src/lib/social';
import { SocialNumbersCard } from '../../src/components/SocialNumbersCard';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';
import { tokens, webGlass } from '../../src/design/theme';

type View_ = 'drafts' | 'scheduled' | 'posted' | 'ideas';
const VIEWS: View_[] = ['drafts', 'scheduled', 'posted', 'ideas'];
const GROUP: Record<string, View_> = { draft: 'drafts', prepared: 'drafts', approved: 'drafts', scheduled: 'scheduled', publishing: 'scheduled', published: 'posted', analyzed: 'posted', failed: 'scheduled' };
const TONE: Record<string, 'neutral' | 'rose' | 'success' | 'danger'> = { drafts: 'neutral', scheduled: 'rose', posted: 'success', failed: 'danger' };
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function PlatformMark({ p, size = 16, color = '#625B56' }: { p: string; size?: number; color?: string }) {
  const c = { size, color };
  if (p === 'instagram') return <InstagramLogo {...c} />;
  if (p === 'facebook') return <FacebookLogo {...c} />;
  if (p === 'tiktok') return <TiktokLogo {...c} />;
  if (p === 'line') return <ChatCircle {...c} />;
  return null;
}

export default function SocialHome() { return <SocialHomeView />; }

/** asCalendar: the NAV V1 Calendar tab (month view, posts per day with platform icons, link to bookings). */
export function SocialHomeView({ asCalendar = false }: { asCalendar?: boolean }) {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ view?: string }>();
  const [ws, setWs] = useState<string | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [connected, setConnected] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [view, setView] = useState<View_ | null>(VIEWS.find((v) => v === params.view) ?? null);
  const [month, setMonth] = useState(asCalendar);
  const [day, setDay] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [menu, setMenu] = useState<ContentPost | null>(null);

  const load = useCallback(async () => {
    try {
      const w = await getActiveWorkspace(); setWs(w.id);
      const list = await listContent(w.id); setPosts(list.filter((p) => p.status !== 'archived')); setState('ready');
      void listIdeas(w.id).then((r) => setIdeas(r.ideas)).catch(() => undefined);
      void getSocialAccounts(w.id).then((c) => setConnected(c.filter((x) => x.state === 'connected').length)).catch(() => undefined);
    } catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => { const c: Record<string, number> = {}; posts.forEach((p) => { const g = GROUP[p.status] ?? 'drafts'; c[g] = (c[g] ?? 0) + 1; }); return c; }, [posts]);
  const active: View_ = view ?? (counts.scheduled ? 'scheduled' : 'drafts');
  const byDay = useMemo(() => { const m = new Map<string, ContentPost[]>(); posts.forEach((p) => { const d = contentPostDate(p); if (d) m.set(dayKey(d), [...(m.get(dayKey(d)) ?? []), p]); }); return m; }, [posts]);
  const listed = posts.filter((p) => (GROUP[p.status] ?? 'drafts') === active && (!day || (contentPostDate(p) && dayKey(contentPostDate(p)!) === day)))
    .sort((a, b) => (contentPostDate(a)?.getTime() ?? 0) - (contentPostDate(b)?.getTime() ?? 0));

  const now = new Date(); const lang = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const base = new Date(now.getFullYear(), now.getMonth() + (month ? offset : 0), 1);
  const start = month ? base : new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const cellCount = month ? new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate() : 7;
  const lead = month ? (start.getDay() + 6) % 7 : 0;
  const cells = Array.from({ length: cellCount }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  async function postNow(p: ContentPost) {
    setMenu(null); const v = p.variants?.[0]; if (!ws || !v) return;
    if (!(await confirm({ title: t('s3.postNowQ'), message: p.status === 'scheduled' ? t('s3.postNowSched') : t('s3.postNowMsg'), confirmText: t('s3.postNow') }))) return;
    try { await publishContentVariant(ws, v.id); await dialog.notify(t('s3.posted')); void load(); } catch (e) { await dialog.notify(t('s3.failed'), e instanceof Error ? e.message : ''); }
  }

  const empty = state === 'ready' && posts.length === 0;
  return <View style={{ flex: 1 }}>
    <Screen onRefresh={load}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>{!asCalendar ? <Overline>{now.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</Overline> : null}<ScreenTitle>{asCalendar ? t('tabs.calendar') : t('social2.title')}</ScreenTitle></View>
        {asCalendar ? <Pressable accessibilityRole="button" accessibilityLabel={t('nav2.bookingsCal')} onPress={() => router.push('/bookings/week' as any)} style={styles.round}><Scissors size={20} color="#2A2725" /></Pressable> : null}
        {!asCalendar ? <Pressable accessibilityRole="button" accessibilityLabel={month ? t('s3.week') : t('s3.month')} onPress={() => setMonth(!month)} style={styles.round}><CalendarBlank size={20} color="#2A2725" weight={month ? 'fill' : 'regular'} /></Pressable> : null}
        {!asCalendar ? <Pressable accessibilityRole="button" accessibilityLabel={t('grid.title')} onPress={() => router.push('/content/grid')} style={styles.round}><SquaresFour size={20} color="#2A2725" /></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('nav3.accounts')} onPress={() => router.push('/content/accounts')} style={styles.round}><Plug size={20} color="#2A2725" /></Pressable>
      </View>

      {state === 'loading' ? <><Skeleton rows={1} height={64} /><Skeleton rows={4} height={86} /></> : null}

      {state === 'nostudio' ? <NoStudio /> : null}
      {state === 'error' ? <View style={styles.calm}><Text style={styles.calmTitle}>{t('s3.errTitle')}</Text><Text style={styles.calmBody}>{t('s3.errBody')}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}

      {empty ? <View style={styles.calm}>
        <View style={styles.emptyIcon}><ImageSquare size={30} color={ROSE} weight="duotone" /></View>
        <Text style={styles.calmTitle}>{t('s3.emptyTitle')}</Text><Text style={styles.calmBody}>{t('s3.emptyBody')}</Text>
        {connected === 0 ? <Button label={t('s3.connect')} onPress={() => router.push('/content/accounts')} /> : null}
        <Button variant={connected === 0 ? 'secondary' : 'primary'} label={t('social2.newPost')} onPress={() => router.push('/content/new')} />
      </View> : null}

      {state === 'ready' && !empty ? <>
        {ws && !asCalendar ? <SocialNumbersCard workspaceId={ws} /> : null}
        {month ? <View style={styles.monthNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => { setOffset(offset - 1); setDay(null); }} style={styles.navBtn}><CaretLeft size={20} color="#2A2725" weight="bold" /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setOffset(0); setDay(null); }} style={{ flex: 1 }}><Text style={styles.monthLabel}>{base.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => { setOffset(offset + 1); setDay(null); }} style={styles.navBtn}><CaretRight size={20} color="#2A2725" weight="bold" /></Pressable>
        </View> : null}
        <View style={[styles.strip, month && styles.stripBig]}>
          {month ? Array.from({ length: 7 }, (_, i) => <View key={`w${i}`} style={styles.wd}><Text style={styles.dow}>{new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'narrow' })}</Text></View>) : null}
          {Array.from({ length: lead }).map((_, i) => <View key={`l${i}`} style={styles.cell} />)}
          {cells.map((d) => { const k = dayKey(d); const ps = byDay.get(k) ?? []; const today = k === dayKey(now); const sel = k === day;
            const ring = ps.some((p) => GROUP[p.status] === 'posted') ? '#366A49' : ps.length ? ROSE : 'transparent';
            return <Pressable key={k} accessibilityRole="button" accessibilityLabel={d.toDateString()} onPress={() => setDay(sel ? null : k)} style={[styles.cell, month && styles.cellBig, today && styles.cellToday, sel && !today && styles.cellSel]}>
              {!month ? <Text numberOfLines={1} style={[styles.dow, today && { color: '#FFF' }]}>{d.toLocaleDateString(lang, { weekday: 'narrow' })}</Text> : null}
              <Text numberOfLines={1} style={[styles.dnum, today && { color: '#FFF' }]}>{d.getDate()}</Text>
              {ps.length ? <View style={styles.marks}>{Array.from(new Set(ps.flatMap((p) => (p.variants ?? []).map((v) => v.platform.split('_')[0])))).slice(0, 3).map((pl) => <PlatformMark key={pl} p={pl} size={11} color={today ? '#FFF' : ring} />)}</View> : <View style={[styles.dot, { backgroundColor: ring }]} />}
            </Pressable>; })}
        </View>

        <View style={styles.seg}>{VIEWS.map((v) => <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: active === v }} onPress={() => { setView(v); router.setParams({ view: v }); }} style={[styles.segItem, active === v && styles.segOn]}>
          <Text numberOfLines={1} style={[styles.segText, active === v && { color: '#FFF' }]}>{t(`social2.${v}`)}</Text></Pressable>)}</View>

        {active === 'ideas' ? <View style={styles.list}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/content/campaign')} style={styles.row}><View style={[styles.thumb, styles.thumbIcon]}><Lightbulb size={24} color={ROSE} weight="duotone" /></View><View style={{ flex: 1 }}><Text style={styles.cap}>{t('s3.planCampaign')}</Text><Text style={styles.meta}>{t('s3.planCampaignSub')}</Text></View><CaretRight size={16} color="#A69C94" /></Pressable>
          {ideas.map((idea) => <Pressable key={idea.key} accessibilityRole="button" onPress={() => router.push({ pathname: '/content/new', params: { title: idea.title, goal: idea.objective } })} style={styles.row}>
            <View style={{ flex: 1 }}><Text numberOfLines={2} style={styles.cap}>{idea.title}</Text><View style={styles.metaRow}><Chip label={t('s3.idea')} /><Text numberOfLines={1} style={styles.meta}>{idea.angle}</Text></View></View></Pressable>)}
        </View> : listed.length ? <View style={styles.list}>{listed.map((p) => { const d = contentPostDate(p); const g = p.status === 'failed' ? 'failed' : GROUP[p.status] ?? 'drafts';
          return <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/content/${p.id}`)} onLongPress={() => setMenu(p)} delayLongPress={350} style={styles.row}>
            <PostThumb workspaceId={ws} post={p} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={2} style={styles.cap}>{p.variants?.[0]?.caption?.trim() || p.title}</Text>
              <View style={styles.metaRow}><Chip tone={TONE[g]} label={t(`s3.st.${g}`)} />{Array.from(new Set((p.variants ?? []).map((v) => v.platform))).map((pl) => <PlatformMark key={pl} p={pl} />)}
                {d ? <Text style={styles.meta}>{d.toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text> : null}</View>
              {g === 'failed' ? <Text numberOfLines={3} style={styles.fail}>{(p.variants ?? []).map((v: any) => v.attempts?.[0]?.error_message).find(Boolean) ?? t('sml.failedNoReason')}</Text> : null}
            </View></Pressable>; })}</View>
        : <View style={styles.calm}><Text style={styles.calmBody}>{t(`s3.none.${active}`)}</Text><Button small variant="secondary" label={t('social2.newPost')} onPress={() => router.push('/content/new')} /></View>}
      </> : null}
      <View style={{ height: 70 }} />
    </Screen>

    {!empty && state !== 'nostudio' ? <Pressable accessibilityRole="button" accessibilityLabel={t('social2.newPost')} onPress={() => router.push('/content/new')} style={styles.fab}><Plus size={18} color="#FFF" weight="bold" /><Text style={styles.fabText}>{t('social2.newPost')}</Text></Pressable> : null}

    <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
      <Pressable style={styles.backdrop} onPress={() => setMenu(null)}><View style={styles.menu}>
        <Text numberOfLines={1} style={[styles.meta, { padding: 14 }]}>{menu?.title}</Text>
        {menu && GROUP[menu.status] !== 'posted' ? <Pressable style={styles.mi} onPress={() => { const id = menu.id; setMenu(null); router.push(`/content/${id}`); }}><Text style={styles.miText}>{t('s3.edit')}</Text></Pressable> : null}
        {menu && GROUP[menu.status] !== 'posted' ? <Pressable style={styles.mi} onPress={() => { const id = menu.id; setMenu(null); router.push(`/content/${id}`); }}><Text style={styles.miText}>{t('s3.reschedule')}</Text></Pressable> : null}
        {menu && GROUP[menu.status] !== 'posted' && menu.variants?.length ? <Pressable style={styles.mi} onPress={() => void postNow(menu)}><Text style={styles.miText}>{menu.status === 'failed' ? t('pf.tryAgain') : t('s3.postNow')}</Text></Pressable> : null}
        {menu && GROUP[menu.status] === 'posted' ? <Pressable style={styles.mi} onPress={() => { const id = menu.id; setMenu(null); router.push(`/content/${id}`); }}><Text style={styles.miText}>{t('s3.open')}</Text></Pressable> : null}
      </View></Pressable>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', ...(webGlass as object) },
  strip: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, borderRadius: 24, backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', ...(webGlass as object) },
  cell: { width: '14.28%', alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 14 },
  stripBig: { paddingVertical: 12, paddingHorizontal: 6, marginHorizontal: -8 },
  cellBig: { paddingVertical: 11, minHeight: 58 },
  wd: { width: '14.28%', alignItems: 'center', paddingBottom: 6 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', ...(webGlass as object) },
  monthLabel: { fontFamily: tokens.font.uiBold, fontSize: 19, color: '#2A2725', textAlign: 'center' },
  cellToday: { backgroundColor: '#2A2725' }, cellSel: { backgroundColor: 'rgba(140,85,71,0.12)' },
  dow: { fontFamily: tokens.font.uiSemibold, fontSize: 11, color: '#8C847D' },
  dnum: { fontFamily: tokens.font.uiSemibold, fontSize: 17, color: '#2A2725', fontVariant: ['lining-nums'] },
  dot: { minWidth: 8, height: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  marks: { flexDirection: 'row', gap: 1, minHeight: 11 },
  dotN: { fontSize: 7, color: '#FFF', fontWeight: '700' },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: 'rgba(42,39,37,0.06)' },
  segItem: { flex: 1, flexShrink: 0, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: ROSE },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#2A2725' },
  list: { borderRadius: 24, backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', overflow: 'hidden', ...(webGlass as object) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 86, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(42,39,37,0.10)' },
  thumb: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#FFF' },
  thumbIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,85,71,0.10)' },
  half: { flex: 1 },
  cap: { fontFamily: tokens.font.uiMedium, fontSize: 15, lineHeight: 20, color: '#2A2725' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  fail: { fontFamily: tokens.font.ui, fontSize: 12, lineHeight: 16, color: '#A3392F' },
  meta: { fontFamily: tokens.font.ui, fontSize: 12, color: '#625B56', flexShrink: 1 },
  calm: { alignItems: 'center', gap: 10, padding: 24, borderRadius: 24, backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', ...(webGlass as object) },
  calmTitle: { fontFamily: tokens.font.display, fontSize: 24, color: '#2A2725', textAlign: 'center' },
  calmBody: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#625B56', textAlign: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,85,71,0.10)' },
  fab: { position: 'absolute', right: 16, bottom: 96, height: 52, borderRadius: 26, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ROSE, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  fabText: { fontFamily: tokens.font.uiBold, fontSize: 15, color: '#FFF' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { borderRadius: 20, backgroundColor: 'rgba(250,248,245,0.97)', overflow: 'hidden' },
  mi: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(42,39,37,0.10)' },
  miText: { fontFamily: tokens.font.uiMedium, fontSize: 16, color: '#2A2725' }
});
