import { BrandLogo } from '../../src/components/BrandBadge';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, PixelRatio, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Tray } from 'phosphor-react-native/src/icons/Tray';
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { DotsThreeVertical } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { Copy } from 'phosphor-react-native/src/icons/Copy';
import { X } from 'phosphor-react-native/src/icons/X';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { SwipeRow } from '../../src/components/SwipeRow';
import { useToast } from '../../src/components/Toast';
import { Skeleton } from '../../src/components/ui';
import { createBlock, getAppointment, getCalendar, type AppointmentDetail, type CalendarAppointment, type CalendarBlock } from '../../src/lib/bookings';
import { listClients } from '../../src/lib/clients';
import { contentPostDate, getSchedulingStatus, listContent, scheduleContentVariant, type ContentPost } from '../../src/lib/content';
import { PostScheduleSheet, postStatusLabel, type SchedState } from '../../src/components/PostScheduleSheet';
import { fromJ, hhmm, jNow, toJ, ymd, dayText } from '../../src/lib/jst';
import { useOnline } from '../../src/lib/offline';
import { PLATFORM_NAME } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, D } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';

const ROSE = '#151515';
const TAGS = [
  { id: 'appointment', type: 'soft', label: 'Appointment', color: '#151515' },
  { id: 'task', type: 'other', label: 'Task', color: '#8C6A3D' },
  { id: 'time', type: 'content', label: 'Scheduled time', color: '#3D6B8C' },
  { id: 'private', type: 'personal', label: 'Private', color: '#6B5B7A' }
] as const;
const COLORS = ['#151515', '#8C6A3D', '#3D6B8C', '#6B5B7A', '#2F6B4F', '#8C3D3D'];
function blockMark(notes?: string | null) {
  const m = notes?.match(/\[\[tag:(\w+)\|color:(#[0-9A-Fa-f]{6})\]\]/);
  return m ? { tag: m[1], color: m[2] } : null;
}
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** Monday-first weekday index (Mon 0 … Sun 6). */
const mon = (d: Date) => (d.getDay() + 6) % 7;
const addD = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
type PostItem = { kind: 'post'; p: ContentPost; at: Date; platforms: string[] };
type Item = { kind: 'booking'; a: CalendarAppointment; at: Date; end: Date } | PostItem;
const FS = Math.min(1.6, Math.max(1, PixelRatio.getFontScale()));
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); const HOUR_H = Math.round(52 * FS); const GUTTER = 48;
const PENDING = /pending|request|tentative|unconfirmed/i;
const MAXF = 1.6;
function glyph(p: ContentPost) {
  const vs = p.variants ?? [];
  if (vs.some((v) => v.status === 'failed')) return '!';
  if (vs.length && vs.every((v) => v.status === 'published')) return '✓';
  if (vs.some((v) => v.status === 'scheduled' || v.status === 'publishing')) return '◷';
  return '✎';
}

/** Calendar tab: Month / Week / Day / List. Monday-first, JST 24h. Posts can be dragged (Week/Day) or rescheduled from the sheet. */
export default function CalendarTab() {
  const { t } = useTranslation();
  const { palette, mode: look } = useAppearance();
  const night = look === 'night';
  const RED = night ? '#FF453A' : '#D70015';
  const ln = night ? { borderColor: 'rgba(255,255,255,0.10)' } : null;
  const sheetBg = { backgroundColor: night ? '#1C1C1E' : '#FFFFFF' };
  const toast = useToast();
  const online = useOnline();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ day?: string; at?: string }>();
  const now = jNow();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [offset, setOffset] = useState(0);
  const [ws, setWs] = useState<string | null>(null);
  const [appts, setAppts] = useState<CalendarAppointment[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [mode, setMode] = useState<'day' | 'week' | 'month' | 'list'>(() => (params.day && /^\d{4}-\d{2}-\d{2}$/.test(String(params.day)) ? 'day' : 'month'));
  const [sched, setSched] = useState<SchedState>({ kind: 'loading' });
  const [choice, setChoice] = useState<{ day: Date; min: number | null } | null>(null);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState<{ day: Date; startMin: number } | null>(null);
  const [title, setTitle] = useState('');
  const [howLong, setHowLong] = useState(60);
  const [allDay, setAllDay] = useState(false);
  const [desc, setDesc] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [place, setPlace] = useState('');
  const [remind, setRemind] = useState<number | null>(30);
  const [tag, setTag] = useState<(typeof TAGS)[number]['id']>('task');
  const [color, setColor] = useState<string>(TAGS[1].color);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; display_name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const howLongRef = useRef(60);
  howLongRef.current = howLong;
  const lengthBase = useRef(60);
  const lengthPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { lengthBase.current = howLongRef.current; },
    onPanResponderMove: (_e, g) => setHowLong(Math.min(720, Math.max(15, lengthBase.current + Math.round(g.dy / 28) * 15)))
  })).current;
  const [searchOpen, setSearchOpen] = useState(false); const [query, setQuery] = useState(''); const [show, setShow] = useState<'all' | 'bookings' | 'posts' | 'tasks'>('all');
  const [anchor, setAnchor] = useState<Date>(() => { const d = String(params.day ?? ''); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, mo, dd] = d.split('-').map(Number); return new Date(y, mo - 1, dd); } return todayStart; });
  const [sel, setSel] = useState<Item | null>(null);
  const [selOpts, setSelOpts] = useState<{ edit?: boolean; cancel?: boolean }>({});
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [detailErr, setDetailErr] = useState(false);
  function setView(m: 'day' | 'week' | 'month' | 'list') { setMode(m); if (m === 'day' || m === 'week') setAnchor(offset === 0 ? todayStart : base); }
  async function openItem(it: Item, opts: { edit?: boolean; cancel?: boolean } = {}) {
    setSel(it); setSelOpts(opts); setDetail(null); setDetailErr(false);
    if (it.kind === 'booking' && ws) { try { setDetail(await getAppointment(ws, it.a.id)); } catch { setDetailErr(true); } }
  }
  // C07: the composer comes back here on the scheduled day.
  useEffect(() => { if (params.day && /^\d{4}-\d{2}-\d{2}$/.test(String(params.day))) { const [y, m, d] = String(params.day).split('-').map(Number); setAnchor(new Date(y, m - 1, d)); setMode('day'); } }, [params.day]);

  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = addD(base, -mon(base));
  const weeks = Math.ceil((mon(base) + new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addD(gridStart, i));
  const weekStart = addD(anchor, -mon(anchor));
  const tlDays = mode === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addD(weekStart, i));
  const rangeStart = mode === 'month' ? gridStart : mode === 'list' ? todayStart : tlDays[0];
  const rangeDays = mode === 'month' ? weeks * 7 : mode === 'list' ? 31 : tlDays.length;
  function shiftMonth(n: number) {
    if (mode === 'month' || mode === 'list') { setOffset((o) => o + n); return; }
    const next = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    const moved = new Date(next.getFullYear(), next.getMonth(), Math.min(anchor.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    setAnchor(moved); setOffset((moved.getFullYear() - now.getFullYear()) * 12 + (moved.getMonth() - now.getMonth()));
  }
  function shiftView(n: number) { const order = ['day', 'week', 'month', 'list'] as const; setView(order[(order.indexOf(mode) + n + order.length) % order.length]); }
  function goToday() { setOffset(0); setAnchor(todayStart); if (mode === 'month') return; }
  // ---- P13 drag to reschedule ----
  const drag = useRef<{ it: PostItem; col: number; top: number; h: number; mins0: number; day: number; mins: number } | null>(null);
  const [dragging, setDragging] = useState<{ it: PostItem; col: number; top: number; h: number } | null>(null);
  const [dragHint, setDragHint] = useState<string | null>(null);
  const [moveAsk, setMoveAsk] = useState<{ it: PostItem; target: Date } | null>(null);
  const [gridW, setGridW] = useState(0);
  const dx = useSharedValue(0); const dy = useSharedValue(0); const lift = useSharedValue(1);
  const ghostStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: lift.value }] }));
  const tl = useRef({ days: tlDays, colW: 0 }); tl.current = { days: tlDays, colW: gridW ? (gridW - GUTTER) / tlDays.length : 0 };
  const targetOf = (d: { day: number; mins: number }) => { const day = tl.current.days[d.day]; return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(d.mins / 60), d.mins % 60); };
  function startDrag(it: PostItem, col: number, top: number, h: number) {
    const mins0 = it.at.getHours() * 60 + it.at.getMinutes();
    drag.current = { it, col, top, h, mins0, day: col, mins: mins0 };
    dx.value = 0; dy.value = 0; lift.value = reduceMotion ? 1 : withTiming(1.04, { duration: 120 });
    setDragging({ it, col, top, h }); setDragHint(t('cal.dragHint', { defaultValue: 'Drop to move to {{when}}', when: `${dayText(it.at)} ${hhmm(it.at)}` }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }
  function endDrag() { drag.current = null; setDragging(null); setDragHint(null); dx.value = 0; dy.value = 0; lift.value = 1; }
  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !!drag.current,
    onMoveShouldSetPanResponderCapture: () => !!drag.current,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => {
      const d = drag.current; if (!d) return; const { days, colW } = tl.current;
      const day = Math.min(days.length - 1, Math.max(0, d.col + (colW ? Math.round(g.dx / colW) : 0)));
      const mins = Math.min((HOURS[HOURS.length - 1] + 1) * 60 - 15, Math.max(HOURS[0] * 60, d.mins0 + Math.round((g.dy / HOUR_H) * 4) * 15));
      dx.value = (day - d.col) * colW; dy.value = ((mins - d.mins0) / 60) * HOUR_H;
      if (day !== d.day || mins !== d.mins) { d.day = day; d.mins = mins; void Haptics.selectionAsync().catch(() => undefined); const tg = targetOf(d); setDragHint(t('cal.dragHint', { defaultValue: 'Drop to move to {{when}}', when: `${dayText(tg)} ${hhmm(tg)}` })); }
    },
    onPanResponderRelease: () => {
      const d = drag.current; if (!d) return;
      const target = targetOf(d); const it = d.it;
      if (d.day === d.col && d.mins === d.mins0) { endDrag(); return; }
      if (fromJ(target).getTime() <= Date.now() + 60000) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        endDrag(); toast.show({ title: t('sched.past', 'That time has passed. Pick a time later than now.'), tone: 'error' }); return;
      }
      endDrag(); setMoveAsk({ it, target });
    },
    onPanResponderTerminate: () => endDrag()
  })).current;
  const [moving, setMoving] = useState(false);
  async function approveMove() {
    if (!moveAsk || !ws) return; const { it, target } = moveAsk; const w = ws;
    const vs = (it.p.variants ?? []).filter((v) => ['scheduled', 'approved', 'failed'].includes(v.status));
    const before = vs.filter((v) => v.status === 'scheduled' && v.scheduled_for).map((v) => ({ id: v.id, at: v.scheduled_for as string }));
    setMoving(true); let ok = 0;
    for (const v of vs) { try { await scheduleContentVariant(w, v.id, fromJ(target).toISOString()); ok += 1; } catch { /* counted */ } }
    setMoving(false); setMoveAsk(null);
    if (!ok) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined); toast.show({ title: t('sched.failedTitle', 'Not scheduled'), message: t('sched.failedBody', "It couldn't be scheduled. Your post is kept as approved."), tone: 'error' }); return; }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void load();
    toast.show({ title: t('sched.movedTo', { defaultValue: 'Moved to {{when}}', when: `${dayText(target)}, ${hhmm(target)}` }), tone: 'success', action: before.length ? { label: t('sched.undo', 'Undo'), onPress: () => { void (async () => {
      for (const b of before) if (new Date(b.at).getTime() > Date.now()) await scheduleContentVariant(w, b.id, b.at).catch(() => undefined);
      void load(); toast.show({ title: t('sched.moveUndone', 'Move undone'), tone: 'info' });
    })(); } } : undefined });
  }

  const nav = useRef({ mode, shiftMonth, shiftView });
  nav.current = { mode, shiftMonth, shiftView };
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, g) => {
      if (drag.current) return false;
      const horizontal = Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
      const vertical = Math.abs(g.dy) > 18 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
      if (horizontal) return nav.current.mode !== 'list';
      return vertical && nav.current.mode === 'month';
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 42) nav.current.shiftView(g.dx < 0 ? 1 : -1);
      else if (Math.abs(g.dy) > 42) nav.current.shiftMonth(g.dy < 0 ? 1 : -1);
    }
  })).current;
  const reqId = useRef(0);
  async function loadSched(id = ws) { if (!id) return; setSched({ kind: 'loading' }); try { setSched({ kind: 'ok', status: await getSchedulingStatus(id) }); } catch { setSched({ kind: 'error' }); } }
  function openChoice(d: Date, min: number | null, long = false) { if (long) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); setChoice({ day: d, min }); }

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const w = await getActiveWorkspace(); setWs(w.id);
      void loadSched(w.id);
      const s = fromJ(rangeStart); const e = fromJ(addD(rangeStart, rangeDays));
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
    if (show === 'all' || show === 'bookings') appts.filter((a) => hit(`${a.client?.display_name ?? ''} ${a.service_name}`)).forEach((a) => add({ kind: 'booking', a, at: toJ(new Date(a.start_at)), end: toJ(new Date(a.end_at)) }));
    if (show === 'all' || show === 'posts') posts.filter((p) => hit(`${p.title} ${p.variants?.[0]?.caption ?? ''}`)).forEach((p) => { const d = contentPostDate(p); if (d) add({ kind: 'post', p, at: toJ(d), platforms: Array.from(new Set((p.variants ?? []).map((v) => v.platform.split('_')[0]))) }); });
    m.forEach((v) => v.sort((x, y) => x.at.getTime() - y.at.getTime()));
    return m;
  }, [appts, posts, show, query]);

  const addAt = (d: Date, startMin: number) => {
    setTitle(''); setHowLong(60); setAllDay(false); setDesc(''); setNote(''); setLink(''); setPlace(''); setRemind(30); setClientId(null); setTag('task'); setColor(TAGS[1].color);
    setDraft({ day: d, startMin });
    if (ws) void listClients(ws).then((rows) => setClients(rows.map((c) => ({ id: c.id, display_name: c.display_name })))).catch(() => setClients([]));
  };
  function openKind(kind: 'task' | 'off', on: Date = anchor) {
    setTitle(kind === 'off' ? t('cal.dayOff', 'Day off') : '');
    setHowLong(60); setAllDay(kind === 'off'); setDesc(''); setNote(''); setLink(''); setPlace(''); setRemind(kind === 'off' ? null : 30); setClientId(null);
    setTag(kind === 'off' ? 'private' : 'task');
    setColor(kind === 'off' ? TAGS[3].color : TAGS[1].color);
    setDraft({ day: on, startMin: 10 * 60 });
    if (ws) void listClients(ws).then((rows) => setClients(rows.map((c) => ({ id: c.id, display_name: c.display_name })))).catch(() => setClients([]));
  }
  async function saveDraft() {
    if (!ws || !draft || !title.trim() || saving) return;
    setSaving(true);
    try {
      const start = new Date(draft.day.getFullYear(), draft.day.getMonth(), draft.day.getDate(), allDay ? 0 : Math.floor(draft.startMin / 60), allDay ? 0 : draft.startMin % 60, 0, 0);
      const end = allDay ? addD(start, 1) : new Date(start.getTime() + howLong * 60000);
      const who = clients.find((c) => c.id === clientId)?.display_name;
      const picked = TAGS.find((row) => row.id === tag) ?? TAGS[1];
      const lines = [`[[tag:${tag}|color:${color}]]`, desc.trim() && `Description: ${desc.trim()}`, note.trim() && `Notes: ${note.trim()}`, who && `Client: ${who}`, link.trim() && `Link: ${link.trim()}`, place.trim() && `Location: ${place.trim()}`, remind != null && `Reminder: ${remind} minutes before`].filter(Boolean).join('\n');
      await createBlock(ws, { title: title.trim(), blockType: allDay && tag === 'private' ? 'hard' : picked.type, startAt: fromJ(start).toISOString(), endAt: fromJ(end).toISOString(), notes: lines.slice(0, 1000) || undefined });
      setDraft(null);
      void load();
    } finally { setSaving(false); }
  }
  const time = (d: Date) => hhmm(d);
  const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const draftLang = 'en-GB';
  const platformNames = (ps: string[]) => ps.map((p) => PLATFORM_NAME[p as keyof typeof PLATFORM_NAME] ?? p).join(', ');
  const postTitle = (p: ContentPost) => (p.title?.trim() || p.variants?.[0]?.caption?.split('\n')[0] || t('sched.post', 'Post')).trim();
  const label = (it: Item) => it.kind === 'booking' ? `${it.a.client?.display_name ?? ''} ${it.a.service_name}`.trim() : postTitle(it.p);
  const bookingStatus = (st: string) => st === 'confirmed' ? t('cal.stConfirmed', 'Confirmed') : PENDING.test(st) ? t('cal.stPending', 'Pending') : st === 'completed' ? t('cal.stDone', 'Done') : st === 'no_show' ? t('cal.stNoShow', 'No-show') : t('cal.stBooked', 'Booked');
  const headTitle = (mode === 'month' || mode === 'list' ? base : anchor).toLocaleDateString('en-GB', { month: 'long' });
  const headYear = (mode === 'month' || mode === 'list' ? base : anchor).getFullYear();
  const listItems = useMemo(() => Array.from({ length: 31 }, (_, i) => addD(todayStart, i)).map((d) => ({ d, items: (byDay.get(key(d)) ?? []).filter((it) => key(d) !== key(now) || (it.kind === 'booking' ? it.end : it.at).getTime() >= now.getTime() - 3600000) })).filter((g) => g.items.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byDay, todayStart.getTime()]);

  const header = <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}>
    <View style={styles.headRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cal.prevMonth', 'Previous month')} onPress={() => shiftMonth(-1)} style={styles.icon}><CaretLeft size={20} color={palette.icon} /></Pressable>
      <Text style={[styles.year, { color: palette.text }]}>{headYear}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cal.nextMonth', 'Next month')} onPress={() => shiftMonth(1)} style={styles.icon}><CaretRight size={20} color={palette.icon} /></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common2.search', { defaultValue: 'Search' })} onPress={() => { setSearchOpen(!searchOpen); setQuery(''); }} style={styles.icon}><MagnifyingGlass size={24} color={palette.icon} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cal.addNew', 'Add a post or booking')} onPress={() => openChoice(mode === 'month' || mode === 'list' ? (offset === 0 ? todayStart : base) : anchor, null)} style={styles.icon}><Plus size={26} color={palette.icon} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cal.filter', 'Show')} onPress={() => setMoreOpen(true)} style={styles.icon}><DotsThreeVertical size={24} color={palette.icon} weight="bold" /></Pressable>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.bigTitle, { color: palette.text }]}>{headTitle}</Text>
      <Text style={[styles.rowSub, { color: palette.muted }]}>JST · 24h</Text>
    </View>
    <View style={[styles.seg, night && { backgroundColor: 'rgba(255,255,255,0.06)' }]} accessibilityRole="tablist">
      {(['day', 'week', 'month', 'list'] as const).map((m) => <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => { setView(m); void Haptics.selectionAsync().catch(() => undefined); }} style={[styles.segItem, mode === m && styles.segOn, mode === m && night && { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.segText, { color: mode === m ? palette.text : night ? palette.muted : D.text2 }]}>{t(`cal.${m}`, { defaultValue: m === 'day' ? 'Day' : m === 'week' ? 'Week' : m === 'month' ? 'Month' : 'List' })}</Text></Pressable>)}
    </View>
    {searchOpen ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('cal.searchPh', 'Search clients, services, posts')} placeholderTextColor={palette.muted} style={[styles.search, { color: palette.text, backgroundColor: palette.fill }]} /> : null}
    {mode === 'month' ? <View style={styles.wkHead} importantForAccessibility="no-hide-descendants">{cells.slice(0, 7).map((d, i) => <Text key={i} maxFontSizeMultiplier={1.3} style={[styles.wkH, { color: palette.muted }]}>{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</Text>)}</View> : null}
    {mode === 'day' ? <View style={[styles.dayHead, { backgroundColor: night ? '#000000' : D.bg }]}>
      <View style={[styles.num, styles.numBig, key(anchor) === key(now) ? { backgroundColor: RED } : { backgroundColor: palette.fill }]}><Text style={[styles.numText, { color: key(anchor) === key(now) ? '#FFFFFF' : palette.text }]}>{anchor.getDate()}</Text></View>
      <Text maxFontSizeMultiplier={1.4} style={[styles.rowTitle, { color: palette.text }]}>{anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
    </View> : null}
    {mode === 'week' ? <View style={[styles.wkRow, ln, night && { backgroundColor: '#000000' }]}><View style={{ width: GUTTER }} />{tlDays.map((d) => { const today = key(d) === key(now); return <Pressable key={key(d)} accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => { setMode('day'); setAnchor(d); }} style={{ flex: 1, alignItems: 'center', gap: 2, minHeight: 44 }}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.wk, { color: palette.muted }]}>{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</Text>
      <View style={[styles.num, today && { backgroundColor: RED }]}><Text maxFontSizeMultiplier={1.3} style={[styles.numText, { color: today ? '#FFFFFF' : palette.text }]}>{d.getDate()}</Text></View></Pressable>; })}</View> : null}
  </View>;

  const block = (it: Item, col: number, h: number, top: number) => {
    const isPost = it.kind === 'post';
    const pend = it.kind === 'booking' && PENDING.test(it.a.status);
    const name = it.kind === 'booking' ? (mode === 'week' ? (it.a.client?.display_name || it.a.service_name) : [it.a.client?.display_name, it.a.service_name].filter(Boolean).join(' · ')) : postTitle(it.p);
    const sub = it.kind === 'booking' ? `${time(it.at)} – ${time(it.end)}` : `${postStatusLabel(it.p, (k, dd) => t(k, dd))} · ${platformNames(it.platforms)}`;
    const failed = isPost && glyph(it.p) === '!';
    const ghost = dragging && isPost && dragging.it.p.id === it.p.id;
    const style = [styles.block, { top, height: h, borderColor: night ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)', backgroundColor: night ? 'rgba(255,255,255,0.08)' : '#FFFFFF' }, !isPost && !pend && { backgroundColor: night ? 'rgba(255,255,255,0.12)' : D.accentTint, borderLeftWidth: 2, borderLeftColor: palette.text }, pend && { borderStyle: 'dashed' as const, borderLeftWidth: 2 }, isPost && { borderLeftWidth: 2, borderLeftColor: failed ? RED : palette.muted }, ghost && { opacity: 0.35 }];
    const a11y = `${time(it.at)}, ${name}, ${sub}`;
    return <Pressable key={`${it.kind}-${isPost ? it.p.id : it.a.id}`} accessibilityRole="button" accessibilityLabel={a11y}
      accessibilityActions={isPost ? [{ name: 'activate' }, { name: 'reschedule', label: t('sched.reschedule', 'Reschedule') }] : undefined}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'reschedule') void openItem(it, { edit: true }); else void openItem(it); }}
      delayLongPress={450} onLongPress={isPost && mode !== 'month' ? () => startDrag(it as PostItem, col, top, h) : undefined}
      onPress={() => void openItem(it)} style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        {isPost ? <Text maxFontSizeMultiplier={MAXF} style={[styles.glyph, { color: failed ? RED : palette.text }]}>{glyph(it.p)}</Text> : null}
        {isPost && mode === 'day' ? it.platforms.map((p) => <BrandLogo key={p} platform={p} size={12} />) : null}
        {isPost && mode === 'day' ? <Text maxFontSizeMultiplier={MAXF} style={[styles.chipText, { color: palette.text }]}>{time(it.at)}</Text> : null}
      </View>
      <Text maxFontSizeMultiplier={MAXF} style={[styles.chipText, { color: palette.text }]}>{name}</Text>
      {mode === 'day' ? <Text maxFontSizeMultiplier={MAXF} numberOfLines={2} style={[styles.blockSub, { color: palette.muted }]}>{sub}</Text> : null}
    </Pressable>;
  };

  const grid = () => <View style={[styles.grid, ln]} {...dragPan.panHandlers} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
    <View style={{ flexDirection: 'row', paddingTop: 12 }}>
      <View style={{ width: GUTTER }}>{HOURS.map((h) => <View key={h} style={{ height: HOUR_H }}><Text maxFontSizeMultiplier={1.3} style={[styles.hour, { color: palette.muted }]}>{hourLabel(h)}</Text></View>)}</View>
      {tlDays.map((d, col) => { const isToday = key(d) === key(now); const nowTop = (now.getHours() + now.getMinutes() / 60 - HOURS[0]) * HOUR_H;
        const dayBlocks = (show === 'all' || show === 'tasks') ? blocks.filter((bl) => key(toJ(new Date(bl.start_at))) === key(d)) : [];
        return <View key={key(d)} style={[styles.col, ln, mode === 'day' && { borderLeftWidth: 0 }]}>
          {HOURS.map((h) => <Pressable key={h} accessibilityRole="button" accessibilityLabel={t('cal.addAtTime', { defaultValue: 'Add at {{t}}', t: `${dayText(d)} ${hourLabel(h)}` })} accessibilityHint={t('cal.addHint', 'Opens New post or New booking')} delayLongPress={500} onPress={(e) => openChoice(d, h * 60 + (e.nativeEvent.locationY > HOUR_H / 2 ? 30 : 0))} onLongPress={(e) => openChoice(d, h * 60 + (e.nativeEvent.locationY > HOUR_H / 2 ? 30 : 0), true)} style={[styles.hourLine, { height: HOUR_H }, ln]} />)}
          {dayBlocks.map((bl) => { const st = toJ(new Date(bl.start_at)); const en = toJ(new Date(bl.end_at)); const top = Math.max(0, (st.getHours() + st.getMinutes() / 60 - HOURS[0]) * HOUR_H); const h = Math.max(22, ((en.getTime() - st.getTime()) / 3600000) * HOUR_H - 2);
            const mark = blockMark(bl.notes);
            return <View key={bl.id} accessible accessibilityLabel={`${time(st)}, ${bl.title}`} style={[styles.block, { top, height: h, backgroundColor: palette.fill, borderColor: palette.border }, mark && { backgroundColor: `${mark.color}22`, borderColor: mark.color, borderLeftWidth: 3, borderLeftColor: mark.color }]}><Text maxFontSizeMultiplier={MAXF} style={[styles.chipText, { color: mark?.color ?? palette.text }]}>{bl.title}</Text></View>; })}
          {(byDay.get(key(d)) ?? []).map((it) => { const startH = it.at.getHours() + it.at.getMinutes() / 60; const endAt = it.kind === 'booking' ? it.end : new Date(it.at.getTime() + 30 * 60000);
            const top = (Math.max(startH, HOURS[0]) - HOURS[0]) * HOUR_H; const h = Math.max(Math.round(30 * FS), ((endAt.getTime() - it.at.getTime()) / 3600000) * HOUR_H - 2);
            return block(it, col, h, top); })}
          {isToday && nowTop > 0 && nowTop < HOURS.length * HOUR_H ? <View pointerEvents="none" style={[styles.nowLine, { top: nowTop, backgroundColor: RED }]}><View style={[styles.nowDot, { backgroundColor: RED }]} /></View> : null}
        </View>; })}
    </View>
    {tlDays.some((d) => key(d) === key(now)) ? (() => { const nowTop = (now.getHours() + now.getMinutes() / 60 - HOURS[0]) * HOUR_H; return nowTop > 0 && nowTop < HOURS.length * HOUR_H ? <View pointerEvents="none" style={[styles.nowPill, { top: 12 + nowTop - 9 + 0, backgroundColor: RED }]}><Text style={styles.nowPillText}>{time(now)}</Text></View> : null; })() : null}
    {dragging && tl.current.colW ? <Animated.View pointerEvents="none" style={[styles.block, styles.lifted, { top: 12 + dragging.top + 0, left: GUTTER + dragging.col * tl.current.colW + 2, width: tl.current.colW - 4, height: dragging.h, backgroundColor: night ? '#2C2C2E' : '#FFFFFF', borderColor: palette.text }, reduceMotion && { shadowOpacity: 0, elevation: 0 }, ghostStyle]}>
      <Text maxFontSizeMultiplier={MAXF} style={[styles.chipText, { color: palette.text }]}>{glyph(dragging.it.p)} {postTitle(dragging.it.p)}</Text>
    </Animated.View> : null}
  </View>;

  const monthView = () => <View>
    <View style={[styles.mgrid, ln]}>
      {Array.from({ length: weeks }, (_, w) => <View key={w} style={[styles.week, { minHeight: Math.round(72 * FS) }, ln]}>
        {cells.slice(w * 7, w * 7 + 7).map((d) => {
          const k = key(d); const items = byDay.get(k) ?? []; const inMonth = d.getMonth() === base.getMonth(); const today = k === key(now);
          const nb = items.filter((i) => i.kind === 'booking').length; const np = items.filter((i) => i.kind === 'post').length; const failed = items.some((i) => i.kind === 'post' && glyph(i.p) === '!');
          const a11y = `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${today ? `, ${t('cal.today', 'Today')}` : ''}, ${t('cal.nBookings', { defaultValue: '{{count}} bookings', count: nb })}, ${t('cal.nPosts', { defaultValue: '{{count}} posts', count: np })}`;
          return <Pressable key={k} accessibilityRole="button" accessibilityLabel={a11y} onPress={() => { setAnchor(d); openChoice(d, null); }} style={styles.cell}>
            <View style={[styles.num, today && { backgroundColor: RED }]}><Text maxFontSizeMultiplier={1.4} style={[styles.numText, { color: today ? '#FFFFFF' : inMonth ? palette.text : palette.muted }, !inMonth && { opacity: 0.5 }]}>{d.getDate()}</Text></View>
            {nb ? <View style={[styles.mkBook, { backgroundColor: palette.text }]} /> : null}
            {np ? <View style={styles.mkPost}>{[0, 1, 2, 3].map((i) => <View key={i} style={[styles.mkDot, { backgroundColor: failed ? RED : palette.muted }]} />)}</View> : null}
          </Pressable>;
        })}
      </View>)}
    </View>
    <View style={styles.legend} importantForAccessibility="no-hide-descendants">
      <View style={[styles.mkBook, { backgroundColor: palette.text, marginTop: 0 }]} /><Text style={[styles.legendText, { color: palette.muted }]}>{t('cal.legendBooking', 'Booking')}</Text>
      <View style={[styles.mkPost, { marginTop: 0 }]}>{[0, 1, 2, 3].map((i) => <View key={i} style={[styles.mkDot, { backgroundColor: palette.muted }]} />)}</View><Text style={[styles.legendText, { color: palette.muted }]}>{t('cal.legendPost', 'Post')}</Text>
    </View>
  </View>;

  const listView = () => {
    if (!listItems.length) return <View style={{ paddingVertical: 32, gap: 6, alignItems: 'center' }}>
      <Text style={[styles.rowTitle, { color: palette.text }]}>{t('cal.listEmpty', 'Nothing coming up')}</Text>
      <Text style={[styles.rowSub, { color: palette.muted, textAlign: 'center' }]}>{t('cal.listEmptySub', 'Tap + to add a post or a booking.')}</Text>
    </View>;
    return <View style={{ paddingBottom: 120, marginHorizontal: -16 }}>
      <Text style={[styles.rowSub, { color: palette.muted, marginHorizontal: 16 }]}>{t('cal.listSub', 'List · upcoming')}</Text>
      {listItems.map(({ d, items }) => { const today = key(d) === key(now); return <View key={key(d)}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.listHead, { color: today ? RED : palette.text, marginHorizontal: 16 }]}>{today ? `${t('cal.today', 'Today')} · ` : ''}{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        {items.map((it) => { const pend = it.kind === 'booking' && PENDING.test(it.a.status);
          const title = it.kind === 'booking' ? [it.a.client?.display_name, it.a.service_name].filter(Boolean).join(' · ') + (pend ? ` · ${t('cal.pending', 'pending')}` : '') : `${platformNames(it.platforms)} · ${postTitle(it.p)}`;
          const st = it.kind === 'post' ? postStatusLabel(it.p, (k, dd) => t(k, dd)) : '';
          const row = <Pressable accessibilityRole="button" accessibilityLabel={`${time(it.at)}, ${title}${st ? `, ${st}` : ''}`} onPress={() => void openItem(it)} style={({ pressed }) => [styles.listRow, { minHeight: Math.round(60 * FS), paddingHorizontal: 16, borderColor: night ? 'rgba(255,255,255,0.10)' : LINE, backgroundColor: palette.bg }, pressed && { backgroundColor: palette.fill }]}>
            <View style={[styles.listBar, pend ? { borderWidth: 1, borderColor: palette.muted } : { backgroundColor: it.kind === 'post' && glyph(it.p) === '!' ? RED : palette.muted }]} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAXF} numberOfLines={2} style={[styles.listTitle, { color: palette.text }]}>{title}</Text>
              {st ? <Text maxFontSizeMultiplier={MAXF} numberOfLines={1} style={[styles.rowSub, { color: palette.muted }]}>{it.kind === 'post' ? `${glyph(it.p)} ` : ''}{st}</Text> : null}
            </View>
            <Text maxFontSizeMultiplier={MAXF} style={[styles.listTime, { color: palette.muted }]}>{time(it.at)}</Text>
          </Pressable>;
          if (it.kind !== 'post') return <View key={`b-${it.a.id}`}>{row}</View>;
          const ic = palette.text;
          return <SwipeRow key={`p-${it.p.id}`} night={night} onFullSwipe={() => undefined} actions={[
            { key: 'reschedule', label: t('sched.reschedule', 'Reschedule'), icon: <ArrowsClockwise size={20} color={ic} />, onPress: () => void openItem(it, { edit: true }) },
            { key: 'duplicate', label: t('sched.duplicate', 'Duplicate'), icon: <Copy size={20} color={ic} />, onPress: () => router.push({ pathname: '/content/new', params: { title: it.p.title ?? '', caption: it.p.variants?.[0]?.caption ?? '', date: ymd(addD(it.at, 7)), time: hhmm(it.at) } } as any) },
            { key: 'cancel', label: t('sched.cancel', 'Cancel'), danger: true, icon: <X size={20} color={RED} />, onPress: () => void openItem(it, { cancel: true }) }
          ]}>{row}</SwipeRow>; })}
      </View>; })}
    </View>;
  };

  return <View style={{ flex: 1 }}>
    <Screen onRefresh={load} scrollEnabled={!dragging} scrollY={state !== 'ready' ? undefined : mode === 'day' && params.at && /^\d{2}:\d{2}$/.test(String(params.at)) ? Math.max(0, (Number(String(params.at).slice(0, 2)) - HOURS[0] - 2) * HOUR_H) : (mode === 'week' || mode === 'day') && tlDays.some((d) => key(d) === key(now)) ? Math.max(0, (now.getHours() - HOURS[0] - 2) * HOUR_H) : undefined} header={header}>
      <View {...swipe.panHandlers}>
      {!online && state === 'ready' ? <Text accessibilityLiveRegion="polite" style={[styles.offline, { color: palette.text, backgroundColor: palette.fill }]}>{t('sched.offlineBar', "You're offline · showing what was last loaded")}</Text> : null}
      {state === 'nostudio' ? <NoStudio /> : null}
      {state === 'loading' ? <Skeleton rows={5} height={80} /> : null}
      {state === 'ready' && (mode === 'day' || mode === 'week') ? grid() : null}
      {state === 'ready' && mode === 'month' ? monthView() : null}
      {state === 'ready' && mode === 'list' ? listView() : null}
      {state === 'error' ? <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
        <Text style={[styles.err, { color: palette.muted }]}>{online ? t('s3.errBody') : t('sched.offlineCal', "You're offline. Your calendar will load when you're back online.")}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setState('loading'); void load(); }} style={[styles.btn, { flex: 0, paddingHorizontal: 24, borderColor: palette.border }]}><Text style={[styles.btnText, { color: palette.text }]}>{t('sched.tryAgain', 'Try again')}</Text></Pressable>
      </View> : null}
      </View>
    </Screen>

    {dragHint ? <View pointerEvents="none" style={styles.hintWrap}><Text style={styles.hint}>{dragHint}</Text></View> : null}
    {mode !== 'month' && !dragHint ? <View pointerEvents="box-none" style={styles.bottomBar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cal.goToday', 'Go to today')} onPress={goToday} style={[styles.pill, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: palette.border }]}><Text style={[styles.pillText, { color: palette.text }]}>{t('cal.today', 'Today')}</Text></Pressable>
      <View style={[styles.pill, styles.pillPair, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: palette.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.drafts', 'Drafts')} onPress={() => router.push('/content' as any)} style={styles.pillIcon}><Tray size={22} color={palette.icon} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cal.month', 'Month')} onPress={() => setView('month')} style={styles.pillIcon}><CalendarDots size={22} color={palette.icon} /></Pressable>
      </View>
    </View> : null}

    <Modal visible={!!choice} transparent animationType="slide" onRequestClose={() => setChoice(null)}>
      <Pressable accessibilityLabel={t('common.close', 'Close')} style={styles.backdrop} onPress={() => setChoice(null)}><Pressable style={[styles.sheet, sheetBg]} onPress={() => undefined}>
        <View style={styles.grabber} />
        {choice ? <Text style={[styles.sheetSub, { color: palette.muted }]}>{choice.day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}{choice.min != null ? ` · ${String(Math.floor(choice.min / 60)).padStart(2, '0')}:${String(choice.min % 60).padStart(2, '0')}` : ''}</Text> : null}
        {([
          ['post', t('cal.newPost', 'New post'), t('cal.newPostSub', 'Write it, then Approve to schedule')],
          ['booking', t('cal.newBooking', 'New booking'), t('cal.newBookingSub', 'Add an appointment')],
          ['task', t('cal.task', 'Task'), ''],
          ['off', t('cal.dayOff', 'Day off'), ''],
          ...(choice?.min == null && mode === 'month' ? [['open', t('cal.openDay', 'Open this day'), ''] as const] : [])
        ] as const).map(([id, lbl, sub]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={lbl} onPress={() => {
          const c = choice; setChoice(null); if (!c) return;
          const min = c.min ?? (id === 'post' ? 19 * 60 : 10 * 60);
          const start = new Date(c.day.getFullYear(), c.day.getMonth(), c.day.getDate(), Math.floor(min / 60), min % 60);
          if (id === 'post') router.push({ pathname: '/content/new', params: { date: ymd(c.day), ...(c.min != null ? { time: hhmm(start) } : {}) } } as any);
          else if (id === 'booking') router.push({ pathname: '/bookings/new', params: { start: fromJ(start).toISOString() } } as any);
          else if (id === 'task') addAt(c.day, min);
          else if (id === 'open') { setAnchor(c.day); setMode('day'); }
          else openKind('off', c.day);
        }} style={[styles.mi, { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: night ? 'rgba(255,255,255,0.10)' : LINE }]}>
          <Text style={[styles.miText, { color: palette.text }]}>{lbl}</Text>
          {sub ? <Text style={[styles.rowSub, { color: palette.muted }]}>{sub}</Text> : null}
        </Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => setChoice(null)} style={[styles.mi, { alignItems: 'center' }]}><Text style={[styles.miText, { color: palette.text }]}>{t('common.cancel', 'Cancel')}</Text></Pressable>
      </Pressable></Pressable>
    </Modal>

    <Modal visible={!!moveAsk} transparent animationType="slide" onRequestClose={() => setMoveAsk(null)}>
      <Pressable accessibilityLabel={t('common.close', 'Close')} style={styles.backdrop} onPress={() => setMoveAsk(null)}><Pressable style={[styles.sheet, sheetBg]} onPress={() => undefined}>
        <View style={styles.grabber} />
        {moveAsk ? <>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.text }]}>{t('cal.moveTitle', { defaultValue: 'Move to {{when}}?', when: `${dayText(moveAsk.target)}, ${hhmm(moveAsk.target)}` })}</Text>
          <Text style={[styles.sheetSub, { color: palette.muted }]}>{postTitle(moveAsk.it.p)} · {t('cal.moveFrom', { defaultValue: 'was {{when}}', when: `${dayText(moveAsk.it.at)}, ${hhmm(moveAsk.it.at)}` })}</Text>
          <Pressable accessibilityRole="button" disabled={moving} onPress={() => void approveMove()} style={[styles.btn, { flex: 0, backgroundColor: palette.text, borderColor: palette.text }]}><Text style={[styles.btnText, { color: palette.bg }]}>{moving ? t('sched.saving', 'Saving…') : t('cal.approveMove', 'Approve new time')}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={moving} onPress={() => setMoveAsk(null)} style={[styles.btn, { flex: 0, borderColor: palette.border }]}><Text style={[styles.btnText, { color: palette.text }]}>{t('cal.keepTime', 'Keep the old time')}</Text></Pressable>
        </> : null}
      </Pressable></Pressable>
    </Modal>

    <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
      <Pressable style={styles.backdrop} onPress={() => setDraft(null)}><Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.sheetTitle}>{t('cal.newSchedule', 'New schedule')}</Text>
        {draft ? <Text style={styles.sheetSub}>{draft.day.toLocaleDateString(draftLang, { weekday: 'long', month: 'long', day: 'numeric' })}{allDay ? '' : ` · ${hourLabel(Math.floor(draft.startMin / 60)).slice(0, 2)}:${String(draft.startMin % 60).padStart(2, '0')}`}</Text> : null}
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
          <TextInput value={title} onChangeText={setTitle} placeholder={t('cal.scheduleTitle', 'Title')} placeholderTextColor="#6C6C70" style={styles.input} />
          <View style={styles.switchRow}><Text style={styles.miText}>{t('cal.allDay', 'All day')}</Text><Switch value={allDay} onValueChange={setAllDay} /></View>
          {allDay ? null : <View style={styles.len} {...lengthPan.panHandlers}>
            <Text style={styles.miText}>{t('cal.howLong', 'How long')}</Text>
            <Text style={styles.rowTitle}>{howLong >= 60 ? `${Math.floor(howLong / 60)} h${howLong % 60 ? ` ${howLong % 60} m` : ''}` : `${howLong} m`}</Text>
            <Text style={styles.rowSub}>{t('cal.slide', 'Slide up or down')}</Text>
          </View>}
          <Text style={styles.fieldK}>{t('cal.tag', 'Tag')}</Text>
          <View style={styles.remindRow}>
            {TAGS.map((row) => <Pressable key={row.id} onPress={() => { setTag(row.id); setColor(row.color); }} style={[styles.chipBtn, tag === row.id && { backgroundColor: row.color }]}><Text style={[styles.chipBtnText, tag === row.id && { color: '#FFF' }]}>{row.label}</Text></Pressable>)}
          </View>
          <Text style={styles.fieldK}>{t('cal.color', 'Color')}</Text>
          <View style={styles.remindRow}>
            {COLORS.map((c) => <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />)}
          </View>
          <TextInput value={desc} onChangeText={setDesc} placeholder={t('cal.description', 'Description')} placeholderTextColor="#6C6C70" style={[styles.input, styles.inputTall]} multiline />
          <TextInput value={note} onChangeText={setNote} placeholder={t('cal.notes', 'Notes')} placeholderTextColor="#6C6C70" style={[styles.input, styles.inputTall]} multiline />
          <Text style={styles.fieldK}>{t('cal.client', 'Client')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
            <Pressable onPress={() => setClientId(null)} style={[styles.chipBtn, !clientId && styles.chipOn]}><Text style={[styles.chipBtnText, !clientId && { color: '#FFF' }]}>{t('cal.noClient', 'None')}</Text></Pressable>
            {clients.slice(0, 20).map((c) => <Pressable key={c.id} onPress={() => setClientId(c.id)} style={[styles.chipBtn, clientId === c.id && styles.chipOn]}><Text style={[styles.chipBtnText, clientId === c.id && { color: '#FFF' }]}>{c.display_name}</Text></Pressable>)}
          </ScrollView>
          <TextInput value={link} onChangeText={setLink} placeholder={t('cal.link', 'Link')} placeholderTextColor="#6C6C70" autoCapitalize="none" style={styles.input} />
          <TextInput value={place} onChangeText={setPlace} placeholder={t('cal.location', 'Location')} placeholderTextColor="#6C6C70" style={styles.input} />
          <Text style={styles.fieldK}>{t('cal.reminder', 'Reminder')}</Text>
          <View style={styles.remindRow}>
            {([[null, 'Off'], [10, '10m'], [30, '30m'], [60, '1h'], [1440, '1d']] as const).map(([mins, name]) => <Pressable key={name} onPress={() => setRemind(mins)} style={[styles.chipBtn, remind === mins && styles.chipOn]}><Text style={[styles.chipBtnText, remind === mins && { color: '#FFF' }]}>{name}</Text></Pressable>)}
          </View>
          <Pressable disabled={!title.trim() || saving} onPress={() => void saveDraft()} style={[styles.btn, styles.btnPrimary, (!title.trim() || saving) && { opacity: 0.4 }]}><Text style={[styles.btnText, { color: '#FFF' }]}>{saving ? t('cal.saving', 'Saving…') : t('cal.save', 'Save')}</Text></Pressable>
        </ScrollView>
      </Pressable></Pressable>
    </Modal>

    <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
      <Pressable style={styles.dropBack} onPress={() => setMoreOpen(false)}><View style={[styles.drop, sheetBg, { alignSelf: 'flex-end' }]}>
        {([
          ['posts', t('cal.showPosts', 'Scheduled posts')],
          ['bookings', t('cal.showBookings', 'Appointments')],
          ['tasks', t('cal.showTasks', 'Tasks')]
        ] as const).map(([id, lbl]) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: show === id }} style={styles.dropItem} onPress={() => { setShow(show === id ? 'all' : id); setMoreOpen(false); }}><Text style={[styles.miText, { color: show === id ? tokens.color.tide : palette.text }]}>{lbl}</Text></Pressable>)}
      </View></Pressable>
    </Modal>
    <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
      <Pressable accessibilityLabel={t('common.close', 'Close')} style={styles.backdrop} onPress={() => setSel(null)}><Pressable style={[styles.sheet, sel?.kind === 'post' && sheetBg]} onPress={() => undefined}>
        <View style={styles.grabber} />
        {sel?.kind === 'booking' ? (() => { const a = detail?.appointment; const c = a?.client ?? sel.a.client; const mins = Math.round((new Date(sel.a.end_at).getTime() - sel.at.getTime()) / 60000);
          return <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(c?.display_name ?? '?').trim()[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.sheetTitle}>{c?.display_name ?? '—'}</Text><Text style={styles.sheetSub}>{sel.a.service_name}</Text></View>
            </View>
            <Field k={t('cal.when', 'When')} v={`${sel.at.toLocaleDateString(draftLang, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time(sel.at)} – ${time(new Date(sel.a.end_at))}`} />
            <Field k={t('cal.duration', 'Duration')} v={`${mins} min`} />
            {a ? <Field k={t('cal.price', 'Price')} v={new Intl.NumberFormat(draftLang, { style: 'currency', currency: a.currency || 'JPY' }).format(a.price_snapshot)} /> : null}
            <Field k={t('cal.status', 'Status')} v={bookingStatus(sel.a.status)} />
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
        {sel?.kind === 'post' && ws ? <PostScheduleSheet key={sel.p.id} ws={ws} post={sel.p} at={sel.at} sched={sched} startEditing={selOpts.edit} startCancel={selOpts.cancel} onChanged={() => void load()} onClose={() => setSel(null)} onRetryStatus={() => void loadSched()} /> : null}
      </Pressable></Pressable>
    </Modal>
  </View>;
}
function Field({ k, v }: { k: string; v: string }) { return <View style={styles.field}><Text style={styles.fieldK}>{k}</Text><Text style={styles.fieldV}>{v}</Text></View>; }

const LINE = '#EDEDED';
const styles = StyleSheet.create({
  months: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  legendKey: { width: 10, height: 12, borderRadius: 2 },
  legendText: { fontFamily: tokens.font.ui, fontSize: 13, color: D.muted },
  wkRow: { flexDirection: 'row', paddingVertical: 8, marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE, backgroundColor: D.bg },
  wk: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 12, color: '#6C6C70' },
  week: { flexDirection: 'row', minHeight: 88, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  cell: { flex: 1, paddingTop: 6, paddingHorizontal: 2, gap: 3, overflow: 'hidden' },
  num: { alignSelf: 'center', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: tokens.color.tide },
  numText: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#151515' },
  dim: { color: '#6C6C70' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 10, lineHeight: 13, color: D.text },
  more: { fontFamily: tokens.font.uiSemibold, fontSize: 10, color: '#6C6C70', paddingHorizontal: 3 },
  err: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6C6C70', textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 78, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 32, gap: 8 },
  sheetTitle: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#151515' },
  sheetSub: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6C6C70', marginBottom: 4 },
  empty: { fontFamily: tokens.font.ui, fontSize: 15, color: '#6C6C70', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515' },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 14, color: '#6C6C70' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, marginTop: -4 },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, height: 44 },
  headTitle: { flexShrink: 1, fontFamily: tokens.font.uiBold, fontSize: 24, color: '#151515' },
  search: { height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#F2F2F2', fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  input: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, marginTop: 8, backgroundColor: '#F2F2F2', fontFamily: tokens.font.ui, fontSize: 16, color: '#151515' },
  inputTall: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  len: { minHeight: 72, justifyContent: 'center', gap: 2, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#F7F7F7' },
  remindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 },
  chipBtn: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: '#F2F2F2' },
  chipOn: { backgroundColor: '#151515' },
  chipBtnText: { fontFamily: tokens.font.uiMedium, fontSize: 13, color: '#151515' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchOn: { borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#151515', shadowOpacity: 0.4, shadowRadius: 2 },
  monthLabel: { fontSize: 17, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  wkHead: { flexDirection: 'row', marginHorizontal: -8, marginBottom: -8, paddingBottom: 4 },
  wkH: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiMedium, fontSize: 14, color: D.muted },
  postChip: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', backgroundColor: '#FFF' },
  postN: { fontFamily: tokens.font.uiSemibold, fontSize: 9, color: '#151515', marginLeft: 1 },
  dropBack: { flex: 1, paddingTop: 100, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  drop: { minWidth: 220, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#FFF', paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', shadowColor: '#151515', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  dropItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: D.fill },
  segItem: { flex: 1, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  rangeLabel: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#151515', textAlign: 'center' },
  hour: { fontFamily: tokens.font.ui, fontSize: 10, color: D.muted, textAlign: 'right', paddingRight: 8, marginTop: -6 },
  col: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  hourLine: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, padding: 4, gap: 2, overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.14)' },
  avatarText: { fontFamily: tokens.font.uiSemibold, fontSize: 22, color: '#151515' },
  field: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  fieldK: { width: 90, fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#6C6C70' },
  fieldV: { flex: 1, fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.2)' },
  btnPrimary: { backgroundColor: ROSE, borderColor: ROSE },
  btnText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  mi: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 4 },
  miText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginLeft: -10 },
  year: { fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  bigTitle: { fontFamily: tokens.font.uiBold, fontSize: 32, lineHeight: 38 },
  glyph: { fontFamily: tokens.font.uiBold, fontSize: 11, lineHeight: 14 },
  mkBook: { alignSelf: 'center', width: 18, height: 3, borderRadius: 1.5, marginTop: 4 },
  mkPost: { alignSelf: 'center', flexDirection: 'row', gap: 2, marginTop: 3 },
  mkDot: { width: 3, height: 3, borderRadius: 1.5 },
  lifted: { borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8, zIndex: 10 },
  nowPill: { position: 'absolute', left: 2, width: GUTTER - 6, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  nowPillText: { color: '#FFFFFF', fontFamily: tokens.font.uiSemibold, fontSize: 10 },
  hintWrap: { position: 'absolute', left: 16, right: 16, bottom: 100, alignItems: 'center' },
  hint: { overflow: 'hidden', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1C1C1E', color: '#FFFFFF', fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 92, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { minHeight: 48, minWidth: 48, paddingHorizontal: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  pillPair: { flexDirection: 'row', paddingHorizontal: 4 },
  pillIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.4)', marginBottom: 4 },
  offline: { fontFamily: tokens.font.uiMedium, fontSize: 14, textAlign: 'center', paddingVertical: 8, borderRadius: 10, marginBottom: 6, overflow: 'hidden' },
  listHead: { fontFamily: tokens.font.uiSemibold, fontSize: 17, paddingTop: 18, paddingBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listBar: { width: 4, alignSelf: 'stretch', minHeight: 28, borderRadius: 2 },
  listTitle: { fontFamily: tokens.font.ui, fontSize: 17 },
  listTime: { fontFamily: tokens.font.ui, fontSize: 17, fontVariant: ['tabular-nums'] }
});
