import { BrandLogo } from '../../src/components/BrandBadge';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { InstagramLogo } from 'phosphor-react-native/src/icons/InstagramLogo';
import { FacebookLogo } from 'phosphor-react-native/src/icons/FacebookLogo';
import { TiktokLogo } from 'phosphor-react-native/src/icons/TiktokLogo';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { Skeleton } from '../../src/components/ui';
import { getAppointment, getCalendar, type AppointmentDetail, type CalendarAppointment } from '../../src/lib/bookings';
import { PostThumb } from '../../src/components/PostThumb';
import { List } from 'phosphor-react-native/src/icons/List';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { Funnel } from 'phosphor-react-native/src/icons/Funnel';
import { DotsThreeVertical } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { contentPostDate, listContent, type ContentPost } from '../../src/lib/content';
import { PLATFORM_NAME } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, webGlass } from '../../src/design/theme';

const ROSE = '#000000'; const BOOK = '#000000';
const BRAND: Record<string, string> = { instagram: '#D62976', facebook: '#1877F2', tiktok: '#000000', line: '#06C755' }; const POSTED = '#000000';
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
type Item = { kind: 'booking'; a: CalendarAppointment; at: Date } | { kind: 'post'; p: ContentPost; at: Date; platforms: string[] };

function Mark({ p }: { p: string; color?: string }) {
  return <BrandLogo platform={p} size={12} />;
}

/** Calendar tab: Google Calendar style month grid with real bookings + posts per day. */
export default function CalendarTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [ws, setWs] = useState<string | null>(null);
  const [appts, setAppts] = useState<CalendarAppointment[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [day, setDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('month');
  const [pickOpen, setPickOpen] = useState(false); const [moreOpen, setMoreOpen] = useState(false); const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); const [query, setQuery] = useState(''); const [show, setShow] = useState<'all' | 'bookings' | 'posts'>('all');
  function setView(m: 'day' | 'week' | 'month') { setMode(m); if (m !== 'month') setAnchor(offset === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : base); }
  const [anchor, setAnchor] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [sel, setSel] = useState<Item | null>(null);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [detailErr, setDetailErr] = useState(false);
  async function openItem(it: Item) {
    setDay(null); setSel(it); setDetail(null); setDetailErr(false);
    if (it.kind === 'booking' && ws) { try { setDetail(await getAppointment(ws, it.a.id)); } catch { setDetailErr(true); } }
  }
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = new Date(base.getFullYear(), base.getMonth(), 1 - base.getDay());
  const weeks = Math.ceil((base.getDay() + new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const weekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const tlDays = mode === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const rangeStart = mode === 'month' ? gridStart : tlDays[0];
  const rangeDays = mode === 'month' ? weeks * 7 : tlDays.length;
  function step(n: number) { if (mode === 'month') setOffset(offset + n); else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n * (mode === 'day' ? 1 : 7))); }
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const w = await getActiveWorkspace(); setWs(w.id);
      const s = new Date(rangeStart); const e = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + rangeDays);
      const [cal, list] = await Promise.all([
        getCalendar(w.id, s.toISOString(), e.toISOString()).catch(() => ({ appointments: [] as CalendarAppointment[], blocks: [] })),
        listContent(w.id).catch(() => [] as ContentPost[])
      ]);
      if (id !== reqId.current) return;
      setAppts(cal.appointments.filter((a) => a.status !== 'cancelled')); setPosts(list.filter((p) => p.status !== 'archived')); setState('ready');
    } catch (err) { if (id === reqId.current) setState(isNoWorkspace(err) ? 'nostudio' : 'error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, mode, anchor.getTime()]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    const add = (it: Item) => m.set(key(it.at), [...(m.get(key(it.at)) ?? []), it]);
    const q = query.trim().toLowerCase(); const hit = (txt: string) => !q || txt.toLowerCase().includes(q);
    if (show !== 'posts') appts.filter((a) => hit(`${a.client?.display_name ?? ''} ${a.service_name}`)).forEach((a) => add({ kind: 'booking', a, at: new Date(a.start_at) }));
    if (show !== 'bookings') posts.filter((p) => hit(`${p.title} ${p.variants?.[0]?.caption ?? ''}`)).forEach((p) => { const d = contentPostDate(p); if (d) add({ kind: 'post', p, at: d, platforms: Array.from(new Set((p.variants ?? []).map((v) => v.platform.split('_')[0]))) }); });
    m.forEach((v) => v.sort((x, y) => x.at.getTime() - y.at.getTime()));
    return m;
  }, [appts, posts, show, query]);

  const months = Array.from({ length: 15 }, (_, i) => i - 2);
  const time = (d: Date) => d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const label = (it: Item) => it.kind === 'booking' ? `${it.a.client?.display_name ?? ''} ${it.a.service_name}`.trim() : (it.p.variants?.[0]?.caption || it.p.title || t('tabs.calendar'));
  const dayItems = day ? byDay.get(key(day)) ?? [] : [];

  return <View style={{ flex: 1 }}>
    <Screen onRefresh={load}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('top.menu', { defaultValue: 'Menu' })} hitSlop={6} onPress={() => router.push('/settings' as any)} style={styles.icon}><List size={26} color="#000" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.pickMonth', 'Choose month')} onPress={() => setPickOpen(true)} style={styles.titleBtn}>
          <Text numberOfLines={1} style={styles.headTitle}>{mode === 'month' ? base.toLocaleDateString(lang, { month: 'short', year: 'numeric' }) : mode === 'day' ? anchor.toLocaleDateString(lang, { month: 'short', day: 'numeric' }) : `${tlDays[0].toLocaleDateString(lang, { month: 'short', day: 'numeric' })} – ${tlDays[6].getDate()}`}</Text>
          <CaretDown size={18} color="#000" weight="bold" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.prev', 'Previous')} hitSlop={6} onPress={() => step(-1)} style={styles.arrow}><CaretLeft size={18} color="#262626" weight="bold" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.next', 'Next')} hitSlop={6} onPress={() => step(1)} style={styles.arrow}><CaretRight size={18} color="#262626" weight="bold" /></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('common2.search', { defaultValue: 'Search' })} hitSlop={6} onPress={() => { setSearchOpen(!searchOpen); setQuery(''); }} style={styles.icon}><MagnifyingGlass size={24} color="#000" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.filter')} hitSlop={6} onPress={() => setFilterOpen(true)} style={styles.icon}><Funnel size={24} color={show !== 'all' ? tokens.color.tide : '#000'} weight={show !== 'all' ? 'fill' : 'regular'} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('top.more', { defaultValue: 'More' })} hitSlop={6} onPress={() => setMoreOpen(true)} style={styles.icon}><DotsThreeVertical size={24} color="#000" weight="bold" /></Pressable>
      </View>
      {searchOpen ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('cal.searchPh', 'Search clients, services, posts')} placeholderTextColor="#8E8E8E" style={styles.search} /> : null}
      {mode === 'month' ? <View style={styles.wkHead}>{cells.slice(0, 7).map((d, i) => <Text key={i} style={styles.wkH}>{d.toLocaleDateString(lang, { weekday: 'short' })}</Text>)}</View> : null}

      {state === 'nostudio' ? <NoStudio /> : null}
      {mode !== 'month' && state === 'ready' ? <View style={styles.grid}>
        <View style={styles.wkRow}><View style={{ width: 40 }} />{tlDays.map((d) => { const today = key(d) === key(now); return <Pressable key={key(d)} onPress={() => { setMode('day'); setAnchor(d); }} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={styles.wk}>{d.toLocaleDateString(lang, { weekday: mode === 'day' ? 'long' : 'narrow' })}</Text>
          <View style={[styles.num, today && styles.numToday]}><Text style={[styles.numText, today && { color: '#FFF' }]}>{d.getDate()}</Text></View></Pressable>; })}</View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 40 }}>{HOURS.map((h) => <View key={h} style={{ height: HOUR_H }}><Text style={styles.hour}>{`${h}:00`}</Text></View>)}</View>
          {tlDays.map((d) => <View key={key(d)} style={styles.col}>
            {HOURS.map((h) => <View key={h} style={styles.hourLine} />)}
            {(byDay.get(key(d)) ?? []).map((it, i) => { const startH = it.at.getHours() + it.at.getMinutes() / 60; const endAt = it.kind === 'booking' ? new Date(it.a.end_at) : new Date(it.at.getTime() + 30 * 60000);
              const top = (Math.max(startH, HOURS[0]) - HOURS[0]) * HOUR_H; const h = Math.max(22, ((endAt.getTime() - it.at.getTime()) / 3600000) * HOUR_H - 2);
              return <Pressable key={i} accessibilityRole="button" onPress={() => void openItem(it)} style={[styles.block, { top, height: h, backgroundColor: it.kind === 'booking' ? BOOK : ROSE }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>{it.kind === 'post' ? it.platforms.slice(0, 1).map((pl) => <Mark key={pl} p={pl} color="#FFF" />) : null}<Text numberOfLines={mode === 'day' ? 1 : 3} style={styles.chipText}>{label(it)}</Text></View>
                {mode === 'day' ? <Text numberOfLines={1} style={[styles.chipText, { opacity: 0.85, fontFamily: tokens.font.ui }]}>{time(it.at)}{it.kind === 'booking' ? ` – ${time(endAt)}` : ''}</Text> : null}
              </Pressable>; })}
          </View>)}
        </View>
      </View> : null}
      {state === 'loading' ? <Skeleton rows={5} height={80} /> : null}

      {mode === 'month' && state !== 'nostudio' && state !== 'loading' ? <View style={styles.grid}>
                {Array.from({ length: weeks }, (_, w) => <View key={w} style={styles.week}>
          {cells.slice(w * 7, w * 7 + 7).map((d) => { const k = key(d); const items = byDay.get(k) ?? []; const inMonth = d.getMonth() === base.getMonth(); const today = k === key(now);
            return <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${d.toDateString()}, ${items.length}`} onPress={() => setDay(d)} style={styles.cell}>
              <View style={[styles.num, today && styles.numToday]}><Text style={[styles.numText, !inMonth && styles.dim, today && { color: '#FFF' }]}>{d.getDate()}</Text></View>
              {(() => { const ps = items.filter((x): x is Extract<Item, { kind: 'post' }> => x.kind === 'post'); const pls = Array.from(new Set(ps.flatMap((x) => x.platforms)));
                return ps.length ? <Pressable onPress={() => ps.length === 1 ? void openItem(ps[0]) : setDay(d)} style={[styles.postChip, !inMonth && { opacity: 0.5 }]}>{pls.slice(0, 3).map((pl) => <Mark key={pl} p={pl} color={BRAND[pl] ?? '#262626'} />)}{ps.length > 1 ? <Text style={styles.postN}>{ps.length}</Text> : null}</Pressable> : null; })()}
              {items.filter((x) => x.kind === 'booking').slice(0, 2).map((it, i) => { const color = BOOK;
                return <Pressable key={i} onPress={() => void openItem(it)} style={[styles.chip, { backgroundColor: color }, !inMonth && { opacity: 0.5 }]}>
                  
                  <Text numberOfLines={1} style={styles.chipText}>{label(it)}</Text></Pressable>; })}
              {items.filter((x) => x.kind === 'booking').length > 2 ? <Text style={styles.more}>+{items.filter((x) => x.kind === 'booking').length - 2}</Text> : null}
            </Pressable>; })}
        </View>)}
      </View> : null}
      {state === 'error' ? <Text style={styles.err}>{t('s3.errBody')}</Text> : null}
    </Screen>

    <Pressable accessibilityRole="button" accessibilityLabel="Add" onPress={() => setAddOpen(true)} style={styles.fab}><Plus size={26} color="#FFF" weight="bold" /></Pressable>

    <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}><View style={styles.sheet}>
        <Pressable style={styles.mi} onPress={() => { setAddOpen(false); router.push('/bookings/new' as any); }}><Text style={styles.miText}>{t('cal.newBooking', 'New booking')}</Text></Pressable>
        <Pressable style={styles.mi} onPress={() => { setAddOpen(false); router.push('/content/new'); }}><Text style={styles.miText}>{t('social2.newPost')}</Text></Pressable>
      </View></Pressable>
    </Modal>

    <Modal visible={!!day} transparent animationType="slide" onRequestClose={() => setDay(null)}>
      <Pressable style={styles.backdrop} onPress={() => setDay(null)}><Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.sheetTitle}>{day?.toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={styles.sheetSub}>{t('cal.counts', { defaultValue: '{{b}} bookings · {{p}} posts', b: dayItems.filter((i) => i.kind === 'booking').length, p: dayItems.filter((i) => i.kind === 'post').length })}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {dayItems.length === 0 ? <Text style={styles.empty}>{t('cal.nothing', 'Nothing on this day yet.')}</Text> : null}
          {dayItems.map((it, i) => <Pressable key={i} style={styles.row} onPress={() => void openItem(it)}>
            <View style={[styles.bar, { backgroundColor: it.kind === 'booking' ? BOOK : ROSE }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={styles.rowTitle}>{it.kind === 'booking' ? it.a.client?.display_name ?? it.a.service_name : label(it)}</Text>
              <Text numberOfLines={1} style={styles.rowSub}>{time(it.at)} · {it.kind === 'booking' ? it.a.service_name : it.platforms.map((p) => PLATFORM_NAME[p as keyof typeof PLATFORM_NAME] ?? p).join(', ')}</Text>
            </View>
          </Pressable>)}
        </ScrollView>
        {ws ? <Pressable style={styles.mi} onPress={() => { setDay(null); router.push('/bookings/week' as any); }}><Text style={[styles.miText, { color: ROSE }]}>{t('nav2.bookingsCal')}</Text></Pressable> : null}
      </Pressable></Pressable>
    </Modal>
    <Modal visible={pickOpen} transparent animationType="fade" onRequestClose={() => setPickOpen(false)}>
      <Pressable style={styles.dropBack} onPress={() => setPickOpen(false)}><View style={styles.drop}>
        <ScrollView style={{ maxHeight: 420 }}>{months.map((o) => { const d = new Date(now.getFullYear(), now.getMonth() + o, 1);
          return <Pressable key={o} style={styles.dropItem} onPress={() => { setOffset(o); setMode('month'); setPickOpen(false); }}><Text style={[styles.miText, o === offset && mode === 'month' && { color: tokens.color.tide }]}>{d.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</Text></Pressable>; })}</ScrollView>
      </View></Pressable>
    </Modal>
    <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
      <Pressable style={styles.dropBack} onPress={() => setMoreOpen(false)}><View style={[styles.drop, { alignSelf: 'flex-end' }]}>
        {(['day', 'week', 'month'] as const).map((m) => <Pressable key={m} style={styles.dropItem} onPress={() => { setView(m); setMoreOpen(false); }}><Text style={[styles.miText, mode === m && { color: tokens.color.tide }]}>{t(`cal.${m}`, { defaultValue: m === 'day' ? 'Day' : m === 'week' ? 'Week' : 'Month' })}</Text></Pressable>)}
        <Pressable style={styles.dropItem} onPress={() => { setMoreOpen(false); setOffset(0); setAnchor(new Date(now.getFullYear(), now.getMonth(), now.getDate())); }}><Text style={styles.miText}>{t('cal.today', 'Today')}</Text></Pressable>
        <Pressable style={styles.dropItem} onPress={() => { setMoreOpen(false); router.push('/bookings/week' as any); }}><Text style={styles.miText}>{t('nav2.bookingsCal')}</Text></Pressable>
        <Pressable style={styles.dropItem} onPress={() => { setMoreOpen(false); router.push('/content/accounts' as any); }}><Text style={styles.miText}>{t('nav3.accounts')}</Text></Pressable>
      </View></Pressable>
    </Modal>
    <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
      <Pressable style={styles.dropBack} onPress={() => setFilterOpen(false)}><View style={[styles.drop, { alignSelf: 'flex-end' }]}>
        {(['all', 'bookings', 'posts'] as const).map((m) => <Pressable key={m} style={styles.dropItem} onPress={() => { setShow(m); setFilterOpen(false); }}><Text style={[styles.miText, show === m && { color: tokens.color.tide }]}>{m === 'all' ? t('messages.all') : m === 'bookings' ? t('cal.bookings', 'Bookings') : t('cal.posts', 'Posts')}</Text></Pressable>)}
      </View></Pressable>
    </Modal>
    <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
      <Pressable style={styles.backdrop} onPress={() => setSel(null)}><Pressable style={styles.sheet} onPress={() => undefined}>
        {sel?.kind === 'booking' ? (() => { const a = detail?.appointment; const c = a?.client ?? sel.a.client; const mins = Math.round((new Date(sel.a.end_at).getTime() - sel.at.getTime()) / 60000);
          return <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(c?.display_name ?? '?').trim()[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.sheetTitle}>{c?.display_name ?? '—'}</Text><Text style={styles.sheetSub}>{sel.a.service_name}</Text></View>
            </View>
            <Field k={t('cal.when', 'When')} v={`${sel.at.toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time(sel.at)} – ${time(new Date(sel.a.end_at))}`} />
            <Field k={t('cal.duration', 'Duration')} v={`${mins} min`} />
            {a ? <Field k={t('cal.price', 'Price')} v={new Intl.NumberFormat(lang, { style: 'currency', currency: a.currency || 'JPY' }).format(a.price_snapshot)} /> : null}
            <Field k={t('cal.status', 'Status')} v={sel.a.status} />
            {a?.client?.phone ? <Field k={t('cal.contact', 'Contact')} v={a.client.phone} /> : null}
            {a?.notes ? <Field k={t('cal.notes', 'Notes')} v={a.notes} /> : null}
            {detailErr ? <Text style={styles.rowSub}>{t('s3.errBody')}</Text> : null}
            <View style={styles.btnRow}>
              {c?.id || a?.client_id ? <Pressable style={styles.btn} onPress={() => { setSel(null); router.push(`/clients/${c?.id ?? a?.client_id}` as any); }}><Text style={styles.btnText}>{t('cal.profile', 'Client profile')}</Text></Pressable> : null}
              {c?.id || a?.client_id ? <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { setSel(null); router.push({ pathname: '/messages/new', params: { clientId: c?.id ?? a?.client_id } } as any); }}><Text style={[styles.btnText, { color: '#FFF' }]}>{t('cal.message', 'Message')}</Text></Pressable> : null}
            </View>
            <Pressable style={styles.mi} onPress={() => { setSel(null); router.push(`/bookings/${sel.a.id}` as any); }}><Text style={[styles.miText, { color: ROSE }]}>{t('cal.openBooking', 'Open booking')}</Text></Pressable>
          </View>; })() : null}
        {sel?.kind === 'post' ? <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <PostThumb workspaceId={ws} post={sel.p} size={88} radius={16} />
            <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={styles.rowTitle}>{sel.p.title}</Text><Text numberOfLines={4} style={styles.rowSub}>{sel.p.variants?.[0]?.caption ?? ''}</Text></View>
          </View>
          <Field k={t('cal.platforms', 'Platforms')} v={sel.platforms.map((p) => PLATFORM_NAME[p as keyof typeof PLATFORM_NAME] ?? p).join(', ') || '—'} />
          <Field k={t('cal.status', 'Status')} v={sel.p.status} />
          <Field k={t('cal.when', 'When')} v={`${sel.at.toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time(sel.at)}`} />
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { setSel(null); router.push(`/content/${sel.p.id}` as any); }}><Text style={[styles.btnText, { color: '#FFF' }]}>{t('cal.edit', 'Edit post')}</Text></Pressable>
        </View> : null}
      </Pressable></Pressable>
    </Modal>
  </View>;
}
function Field({ k, v }: { k: string; v: string }) { return <View style={styles.field}><Text style={styles.fieldK}>{k}</Text><Text style={styles.fieldV}>{v}</Text></View>; }
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); const HOUR_H = 56;
function GROUP_POSTED(s: string) { return s === 'published' || s === 'analyzed'; }

const LINE = '#DBDBDB'; const HOUR_H_STYLE = 56;
const styles = StyleSheet.create({
  months: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  year: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#262626' },
  month: { height: 40, minWidth: 64, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.25)', backgroundColor: '#FFFFFF' },
  monthOn: { backgroundColor: '#262626', borderColor: '#262626' },
  monthText: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#262626' },
  monthTextOn: { color: '#FFF' },
  grid: { marginHorizontal: -16, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE, ...(webGlass as object) },
  wkRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  wk: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 12, color: '#8E8E8E' },
  week: { flexDirection: 'row', minHeight: 104, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  cell: { flex: 1, paddingTop: 6, paddingHorizontal: 2, gap: 3, borderRightWidth: StyleSheet.hairlineWidth, borderColor: LINE, overflow: 'hidden' },
  num: { alignSelf: 'center', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: tokens.color.tide },
  numText: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#262626' },
  dim: { color: '#8E8E8E' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  chipText: { flex: 1, fontFamily: tokens.font.uiSemibold, fontSize: 10, lineHeight: 13, color: '#FFF' },
  more: { fontFamily: tokens.font.uiSemibold, fontSize: 10, color: '#737373', paddingHorizontal: 3 },
  err: { fontFamily: tokens.font.ui, fontSize: 15, color: '#737373', textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 104, width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ROSE, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 32, gap: 8 },
  sheetTitle: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#262626' },
  sheetSub: { fontFamily: tokens.font.ui, fontSize: 15, color: '#737373', marginBottom: 4 },
  empty: { fontFamily: tokens.font.ui, fontSize: 15, color: '#8E8E8E', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#262626' },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 14, color: '#737373' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, marginTop: -4 },
  icon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, height: 44 },
  headTitle: { fontFamily: tokens.font.uiBold, fontSize: 20, color: '#000' },
  search: { height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#EFEFEF', fontFamily: tokens.font.ui, fontSize: 15, color: '#000' },
  wkHead: { flexDirection: 'row', marginHorizontal: -16, marginBottom: -24, paddingBottom: 8 },
  wkH: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#262626' },
  postChip: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', backgroundColor: '#FFF' },
  postN: { fontFamily: tokens.font.uiSemibold, fontSize: 9, color: '#262626', marginLeft: 1 },
  dropBack: { flex: 1, paddingTop: 100, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  drop: { minWidth: 220, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#FFF', paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  dropItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', ...(webGlass as object) },
  seg: { flex: 1, flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: 'rgba(42,39,37,0.06)' },
  segItem: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#262626' },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#262626' },
  rangeLabel: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#262626', textAlign: 'center' },
  hour: { fontFamily: tokens.font.ui, fontSize: 10, color: '#8E8E8E', textAlign: 'right', paddingRight: 4, marginTop: -6 },
  col: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  hourLine: { height: HOUR_H_STYLE, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, padding: 4, overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.14)' },
  avatarText: { fontFamily: tokens.font.uiSemibold, fontSize: 22, color: '#262626' },
  field: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  fieldK: { width: 90, fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#8E8E8E' },
  fieldV: { flex: 1, fontFamily: tokens.font.ui, fontSize: 15, color: '#262626' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.2)' },
  btnPrimary: { backgroundColor: ROSE, borderColor: ROSE },
  btnText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#262626' },
  mi: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 4 },
  miText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#262626' }
});
