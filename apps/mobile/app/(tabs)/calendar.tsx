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
import { getAppointment, getCalendar, type AppointmentDetail, type CalendarAppointment, type CalendarBlock } from '../../src/lib/bookings';
import { PostThumb } from '../../src/components/PostThumb';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { DotsThreeVertical } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { contentPostDate, listContent, type ContentPost } from '../../src/lib/content';
import { PLATFORM_NAME } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, webGlass, D } from '../../src/design/theme';

const ROSE = '#151515'; const BOOK = '#151515';
const BRAND: Record<string, string> = { instagram: '#D62976', facebook: '#1877F2', tiktok: '#151515', line: '#06C755' }; const POSTED = '#151515';
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
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); const [query, setQuery] = useState(''); const [show, setShow] = useState<'all' | 'bookings' | 'posts' | 'tasks'>('all');
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
      setAppts(cal.appointments.filter((a) => a.status !== 'cancelled')); setBlocks(cal.blocks ?? []); setPosts(list.filter((p) => p.status !== 'archived')); setState('ready');
    } catch (err) { if (id === reqId.current) setState(isNoWorkspace(err) ? 'nostudio' : 'error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, mode, anchor.getTime()]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    const add = (it: Item) => m.set(key(it.at), [...(m.get(key(it.at)) ?? []), it]);
    const q = query.trim().toLowerCase(); const hit = (txt: string) => !q || txt.toLowerCase().includes(q);
    if (show === 'all' || show === 'bookings') appts.filter((a) => hit(`${a.client?.display_name ?? ''} ${a.service_name}`)).forEach((a) => add({ kind: 'booking', a, at: new Date(a.start_at) }));
    if (show === 'all' || show === 'posts') posts.filter((p) => hit(`${p.title} ${p.variants?.[0]?.caption ?? ''}`)).forEach((p) => { const d = contentPostDate(p); if (d) add({ kind: 'post', p, at: d, platforms: Array.from(new Set((p.variants ?? []).map((v) => v.platform.split('_')[0]))) }); });
    m.forEach((v) => v.sort((x, y) => x.at.getTime() - y.at.getTime()));
    return m;
  }, [appts, posts, show, query]);

  const addAt = (d: Date, hour: number, y = 0) => {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, y > HOUR_H / 2 ? 30 : 0, 0, 0);
    router.push({ pathname: '/bookings/new', params: { start: start.toISOString() } } as any);
  };
  const time = (d: Date) => d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const label = (it: Item) => it.kind === 'booking' ? `${it.a.client?.display_name ?? ''} ${it.a.service_name}`.trim() : (it.p.variants?.[0]?.caption || it.p.title || t('tabs.calendar'));
  const dayItems = day ? byDay.get(key(day)) ?? [] : [];

  return <View style={{ flex: 1 }}>
    <Screen onRefresh={load} askBottom={mode !== 'month' ? 176 : undefined}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.prev', 'Previous')} hitSlop={6} onPress={() => step(-1)} style={styles.arrow}><CaretLeft size={18} color={D.text} weight="bold" /></Pressable>
        <Text numberOfLines={1} style={styles.headTitle}>{(mode === 'month' ? base : anchor).toLocaleDateString(lang, { month: 'long' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.next', 'Next')} hitSlop={6} onPress={() => step(1)} style={styles.arrow}><CaretRight size={18} color={D.text} weight="bold" /></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('common2.search', { defaultValue: 'Search' })} hitSlop={6} onPress={() => { setSearchOpen(!searchOpen); setQuery(''); }} style={styles.icon}><MagnifyingGlass size={24} color={D.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('top.more', { defaultValue: 'More' })} hitSlop={6} onPress={() => setMoreOpen(true)} style={styles.icon}><DotsThreeVertical size={24} color={D.text} weight="bold" /></Pressable>
      </View>
      <View style={styles.seg} accessibilityRole="tablist">
        {(['day', 'week', 'month'] as const).map((m) => <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setView(m)} style={[styles.segItem, mode === m && styles.segOn]}>
          <Text style={[styles.segText, mode !== m && { color: D.text2 }]}>{t(`cal.${m}`, { defaultValue: m === 'day' ? 'Day' : m === 'week' ? 'Week' : 'Month' })}</Text></Pressable>)}
      </View>
      {searchOpen ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('cal.searchPh', 'Search clients, services, posts')} placeholderTextColor={D.faint} style={styles.search} /> : null}

      {state === 'nostudio' ? <NoStudio /> : null}
      {mode === 'day' && state === 'ready' ? (() => { const its = (byDay.get(key(anchor)) ?? []).filter((x) => x.kind === 'booking'); const hrs = its.reduce((n, x) => n + (x.kind === 'booking' ? (new Date(x.a.end_at).getTime() - x.at.getTime()) / 3600000 : 0), 0);
        return <View style={styles.dayHead}>
          <View style={[styles.num, styles.numToday, styles.numBig]}><Text style={[styles.numText, { color: '#FFF' }]}>{anchor.getDate()}</Text></View>
          <View style={{ gap: 2 }}><Text style={styles.rowTitle}>{anchor.toLocaleDateString(lang, { weekday: 'long' })}</Text>
            <Text style={styles.rowSub}>{t('cal.dayCount', { defaultValue: '{{n}} bookings · {{h}} h booked', n: its.length, h: Math.round(hrs * 10) / 10 })}</Text></View>
        </View>; })() : null}
      {mode !== 'month' && state === 'ready' ? <View style={styles.grid}>
        {mode === 'week' ? <View style={styles.wkRow}><View style={{ width: GUTTER }} />{tlDays.map((d) => { const today = key(d) === key(now); return <Pressable key={key(d)} onPress={() => { setMode('day'); setAnchor(d); }} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={styles.wk}>{d.toLocaleDateString(lang, { weekday: 'narrow' })}</Text>
          <View style={[styles.num, today && styles.numToday]}><Text style={[styles.numText, today && { color: '#FFF' }]}>{d.getDate()}</Text></View></Pressable>; })}</View> : null}
        <View style={{ flexDirection: 'row', paddingTop: 12 }}>
          <View style={{ width: GUTTER }}>{HOURS.map((h) => <View key={h} style={{ height: HOUR_H }}><Text style={styles.hour}>{hourLabel(h, lang)}</Text></View>)}</View>
          {tlDays.map((d) => { const isToday = key(d) === key(now); const nowTop = (now.getHours() + now.getMinutes() / 60 - HOURS[0]) * HOUR_H;
            const dayBlocks = (show === 'all' || show === 'tasks') ? blocks.filter((bl) => key(new Date(bl.start_at)) === key(d)) : [];
            return <View key={key(d)} style={[styles.col, mode === 'day' && { borderLeftWidth: 0 }]}>
            {HOURS.map((h) => <Pressable key={h} accessibilityRole="button" accessibilityLabel={t('cal.addAt', { defaultValue: 'Add an appointment' })} onPress={(e) => addAt(d, h, e.nativeEvent.locationY)} onLongPress={(e) => addAt(d, h, e.nativeEvent.locationY)} style={styles.hourLine} />)}
            {dayBlocks.map((bl) => { const st = new Date(bl.start_at); const en = new Date(bl.end_at); const top = Math.max(0, (st.getHours() + st.getMinutes() / 60 - HOURS[0]) * HOUR_H); const h = Math.max(22, ((en.getTime() - st.getTime()) / 3600000) * HOUR_H - 2);
              return <View key={bl.id} style={[styles.block, styles.blocked, { top, height: h }]}><Text numberOfLines={2} style={[styles.chipText, { color: D.text2 }]}>{bl.title}</Text>{mode === 'day' ? <Text style={styles.blockSub}>{t('cal.blocked', 'Blocked')}</Text> : null}</View>; })}
            {(byDay.get(key(d)) ?? []).map((it, i) => { const startH = it.at.getHours() + it.at.getMinutes() / 60; const endAt = it.kind === 'booking' ? new Date(it.a.end_at) : new Date(it.at.getTime() + 30 * 60000);
              const top = (Math.max(startH, HOURS[0]) - HOURS[0]) * HOUR_H; const h = Math.max(22, ((endAt.getTime() - it.at.getTime()) / 3600000) * HOUR_H - 2);
              const kind = it.kind === 'post' ? styles.blocked : PENDING.test(it.a.status) ? styles.pending : styles.confirmed;
              const title = it.kind === 'booking' ? it.a.service_name : label(it); const sub = it.kind === 'booking' ? it.a.client?.display_name ?? '' : it.platforms.map((p) => PLATFORM_NAME[p as keyof typeof PLATFORM_NAME] ?? p).join(', ');
              return <Pressable key={i} accessibilityRole="button" onPress={() => void openItem(it)} style={[styles.block, kind, { top, height: h }]}>
                <Text numberOfLines={mode === 'day' ? 1 : 2} style={styles.chipText}>{title}</Text>
                {sub ? <Text numberOfLines={1} style={styles.blockSub}>{sub}</Text> : null}
              </Pressable>; })}
            {isToday && nowTop > 0 && nowTop < HOURS.length * HOUR_H ? <View pointerEvents="none" style={[styles.nowLine, { top: nowTop }]}><View style={styles.nowDot} /></View> : null}
          </View>; })}
        </View>
      </View> : null}
      {state === 'loading' ? <Skeleton rows={5} height={80} /> : null}

      {mode === 'month' && state !== 'nostudio' && state !== 'loading' ? <>
        <View style={styles.wkHead}>{cells.slice(0, 7).map((d, i) => <Text key={i} style={styles.wkH}>{d.toLocaleDateString(lang, { weekday: 'narrow' })}</Text>)}</View>
        <View style={styles.mgrid}>
        {Array.from({ length: weeks }, (_, w) => { const row = cells.slice(w * 7, w * 7 + 7); const thisWeek = row.some((d) => key(d) === key(now));
          return <View key={w} style={styles.week}>
          {row.map((d) => { const k = key(d); const items = byDay.get(k) ?? []; const inMonth = d.getMonth() === base.getMonth(); const today = k === key(now);
            return <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${d.toDateString()}, ${items.length}`} onPress={() => setDay(d)} style={styles.cell}>
              <View style={[styles.num, today && styles.numToday]}><Text style={[styles.numText, !inMonth && styles.dim, today && { color: '#FFF' }]}>{d.getDate()}</Text></View>
              {thisWeek ? items.slice(0, 2).map((it, i) => { const pend = it.kind === 'booking' && PENDING.test(it.a.status);
                return <Pressable key={i} onPress={() => void openItem(it)} style={[styles.chip, pend ? styles.pending : it.kind === 'post' ? styles.blocked : styles.confirmed]}>
                  <Text numberOfLines={1} style={styles.mChip}>{it.kind === 'booking' ? it.a.service_name : label(it)}</Text></Pressable>; })
                : items.length ? <View style={styles.dots}>{items.slice(0, 3).map((_, i) => <View key={i} style={styles.dot} />)}</View> : null}
            </Pressable>; })}
        </View>; })}
        </View>
        <View style={styles.legend}>
          <View style={[styles.legendKey, styles.confirmed]} /><Text style={styles.legendText}>{t('cal.confirmed', 'Confirmed')}</Text>
          <View style={[styles.legendKey, styles.pending, { marginLeft: 16 }]} /><Text style={styles.legendText}>{t('cal.pending', 'Pending')}</Text>
        </View>
      </> : null}
      {state === 'error' ? <Text style={styles.err}>{t('s3.errBody')}</Text> : null}
    </Screen>

    {mode !== 'month' ? <Pressable accessibilityRole="button" accessibilityLabel="Add" onPress={() => setAddOpen(true)} style={styles.fab}><Plus size={26} color="#FFF" weight="bold" /></Pressable> : null}

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
    <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
      <Pressable style={styles.dropBack} onPress={() => setMoreOpen(false)}><View style={[styles.drop, { alignSelf: 'flex-end' }]}>
        {([
          ['posts', 'Scheduled posts'],
          ['bookings', 'Appointments'],
          ['tasks', 'Tasks']
        ] as const).map(([id, label]) => <Pressable key={id} style={styles.dropItem} onPress={() => { setShow(show === id ? 'all' : id); setMoreOpen(false); }}><Text style={[styles.miText, show === id && { color: tokens.color.tide }]}>{label}</Text></Pressable>)}
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
            {a?.notes ? <Field k={t('cal.notes', 'Notes')} v={a.notes} /> : <Field k={t('cal.notes', 'Notes')} v={t('cal.none', 'None')} />}
            <Field k={t('cal.description', 'Description')} v={sel.a.service_name} />
            <Field k={t('cal.link', 'Link')} v={t('cal.none', 'None')} />
            <Field k={t('cal.attachments', 'Attachments')} v={t('cal.none', 'None')} />
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
          <Field k={t('cal.description', 'Description')} v={sel.p.variants?.[0]?.caption?.trim() || t('cal.none', 'None')} />
          <Field k={t('cal.notes', 'Notes')} v={sel.p.strategy_reason?.trim() || t('cal.none', 'None')} />
          <Field k={t('cal.link', 'Link')} v={sel.p.variants?.find((v) => v.live_url)?.live_url || t('cal.none', 'None')} />
          <Field k={t('cal.attachments', 'Attachments')} v={sel.p.media?.map((m) => m.asset?.original_filename).filter(Boolean).join(', ') || t('cal.none', 'None')} />
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { setSel(null); router.push(`/content/${sel.p.id}` as any); }}><Text style={[styles.btnText, { color: '#FFF' }]}>{t('cal.edit', 'Edit post')}</Text></Pressable>
        </View> : null}
      </Pressable></Pressable>
    </Modal>
  </View>;
}
function Field({ k, v }: { k: string; v: string }) { return <View style={styles.field}><Text style={styles.fieldK}>{k}</Text><Text style={styles.fieldV}>{v}</Text></View>; }
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); const HOUR_H = 52; const GUTTER = 48;
const PENDING = /pending|request|tentative|unconfirmed/i;
function hourLabel(h: number, lang: string) { return new Date(2000, 0, 1, h).toLocaleTimeString(lang, { hour: 'numeric' }); }
function GROUP_POSTED(s: string) { return s === 'published' || s === 'analyzed'; }

const LINE = '#EDEDED'; const HOUR_H_STYLE = 52;
const styles = StyleSheet.create({
  months: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  year: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  month: { height: 40, minWidth: 64, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.25)', backgroundColor: '#FFFFFF' },
  monthOn: { backgroundColor: '#151515', borderColor: '#151515' },
  monthText: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#151515' },
  monthTextOn: { color: '#FFF' },
  grid: { marginHorizontal: -16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  mgrid: { marginHorizontal: -8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numBig: { width: 40, height: 40, borderRadius: 20, alignSelf: 'auto' },
  confirmed: { backgroundColor: D.accentTint, borderLeftWidth: 2, borderLeftColor: D.accentDeep },
  pending: { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: '#A8A096', borderLeftWidth: 2, borderLeftColor: D.pendingRule },
  blocked: { backgroundColor: D.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  blockSub: { fontFamily: tokens.font.ui, fontSize: 10, lineHeight: 13, color: D.muted },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: D.accentDeep },
  nowDot: { position: 'absolute', left: -4, top: -3.25, width: 8, height: 8, borderRadius: 4, backgroundColor: D.accentDeep },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: D.text },
  mChip: { fontFamily: tokens.font.uiSemibold, fontSize: 10, lineHeight: 13, color: D.text },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8 },
  legendKey: { width: 10, height: 12, borderRadius: 2 },
  legendText: { fontFamily: tokens.font.ui, fontSize: 13, color: D.muted },
  wkRow: { flexDirection: 'row', paddingVertical: 8, marginTop: -8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE, backgroundColor: D.bg },
  wk: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 12, color: '#766E64' },
  week: { flexDirection: 'row', minHeight: 88, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  cell: { flex: 1, paddingTop: 6, paddingHorizontal: 2, gap: 3, overflow: 'hidden' },
  num: { alignSelf: 'center', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: tokens.color.tide },
  numText: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#151515' },
  dim: { color: '#766E64' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 10, lineHeight: 13, color: D.text },
  more: { fontFamily: tokens.font.uiSemibold, fontSize: 10, color: '#6B645B', paddingHorizontal: 3 },
  err: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6B645B', textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 104, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: ROSE, shadowColor: '#151515', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 32, gap: 8 },
  sheetTitle: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#151515' },
  sheetSub: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6B645B', marginBottom: 4 },
  empty: { fontFamily: tokens.font.ui, fontSize: 15, color: '#766E64', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515' },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 14, color: '#6B645B' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, marginTop: -4, marginLeft: -6 },
  icon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, height: 44 },
  headTitle: { fontFamily: tokens.font.uiBold, fontSize: 20, color: '#151515' },
  search: { height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#F2F2F2', fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  wkHead: { flexDirection: 'row', marginHorizontal: -8, marginBottom: -16, paddingBottom: 8 },
  wkH: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiMedium, fontSize: 14, color: D.muted },
  postChip: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', backgroundColor: '#FFF' },
  postN: { fontFamily: tokens.font.uiSemibold, fontSize: 9, color: '#151515', marginLeft: 1 },
  dropBack: { flex: 1, paddingTop: 100, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  drop: { minWidth: 220, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#FFF', paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', shadowColor: '#151515', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  dropItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', ...(webGlass as object) },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: D.fill, marginTop: -18 },
  segItem: { flex: 1, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  rangeLabel: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#151515', textAlign: 'center' },
  hour: { fontFamily: tokens.font.ui, fontSize: 10, color: D.muted, textAlign: 'right', paddingRight: 8, marginTop: -6 },
  col: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  hourLine: { height: HOUR_H_STYLE, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, padding: 4, gap: 2, overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.14)' },
  avatarText: { fontFamily: tokens.font.uiSemibold, fontSize: 22, color: '#151515' },
  field: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  fieldK: { width: 90, fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#766E64' },
  fieldV: { flex: 1, fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.2)' },
  btnPrimary: { backgroundColor: ROSE, borderColor: ROSE },
  btnText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  mi: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 4 },
  miText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515' }
});
