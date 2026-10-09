import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { ErrorState } from '../src/components/ErrorState';
import { ActionButton } from '../src/components/MessagingBits';
import { Tabs, fieldStyles } from '../src/components/Field';
import { addDayString, dayString, prettyDay } from '../src/components/DateField';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText, ui } from '../src/components/ui';
import { getBusinessHours, getCalendar, type BusinessHour, type CalendarAppointment, type CalendarBlock } from '../src/lib/bookings';
import { getActiveWorkspace } from '../src/lib/workspace';
import { toFriendly, type FriendlyResult } from '../src/lib/friendly-error';

const FIRST = 8, LAST = 21, HOUR = 52;
type Mode = 'day' | 'week';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const { focusLabel } = useLocalSearchParams<{ focusLabel?: string }>();
  const [mode, setMode] = useState<Mode>('day');
  const [anchor, setAnchor] = useState(dayString(new Date()));
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loadError, setLoadError] = useState<FriendlyResult | null>(null);
  const [busy, setBusy] = useState(true);

  const days = mode === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDayString(weekStart(anchor), i));
  useEffect(() => { void load(); }, [anchor, mode]);
  async function load() {
    setBusy(true); setLoadError(null);
    try {
      const ws = await getActiveWorkspace();
      const start = new Date(`${days[0]}T00:00:00`);
      const end = new Date(`${addDayString(days[days.length - 1], 1)}T00:00:00`);
      const [data, h] = await Promise.all([getCalendar(ws.id, start.toISOString(), end.toISOString()), hours.length ? Promise.resolve(hours) : getBusinessHours(ws.id).catch(() => [])]);
      setAppointments(data.appointments.filter((a) => a.status !== 'cancelled')); setBlocks(data.blocks); setHours(h);
    } catch (e) { setLoadError(toFriendly(e, { action: 'load', thing: 'calendar' })); }
    finally { setBusy(false); }
  }

  const step = mode === 'day' ? 1 : 7;
  return <Screen onRefresh={() => load()}>
    <View style={styles.header}><View style={fieldStyles.grow}><ScreenTitle>{t('calendar.title')}</ScreenTitle><SupportText>{mode === 'day' ? prettyDay(anchor) : t('calendar.weekOf', { day: prettyDay(days[0]) })}</SupportText></View>
      <ActionButton kind="primary" label={t('calendar.newBooking')} onPress={() => router.push('/bookings/new')} /></View>
    {focusLabel ? <Card premium><SectionTitle>{t('calendar.checking')}</SectionTitle><BodyText>{focusLabel}</BodyText></Card> : null}
    <View style={fieldStyles.row}>
      <Tabs value={mode} onChange={setMode} options={[{ id: 'day', label: t('calendar.day') }, { id: 'week', label: t('calendar.week') }]} />
      <ActionButton kind="quiet" label={t('calendar.back')} onPress={() => setAnchor(addDayString(anchor, -step))} />
      <ActionButton kind="quiet" label={t('calendar.today')} onPress={() => setAnchor(dayString(new Date()))} />
      <ActionButton kind="quiet" label={t('calendar.next')} onPress={() => setAnchor(addDayString(anchor, step))} />
    </View>
    {loadError ? <ErrorState title={loadError.title} message={loadError.message} onRetry={() => void load()} /> : null}
    <Card>
      <ScrollView horizontal={mode === 'week'} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.grid}>
          <View style={styles.gutter}>{Array.from({ length: LAST - FIRST }, (_, i) => <Text key={i} style={[styles.hourLabel, { top: i * HOUR }]}>{FIRST + i}:00</Text>)}</View>
          {days.map((d) => {
            const dow = new Date(`${d}T12:00:00`).getDay();
            const h = hours.find((x) => x.day_of_week === dow);
            const closed = h?.is_closed;
            return <View key={d} style={[styles.dayCol, mode === 'week' && styles.weekCol]}>
              {mode === 'week' ? <Text style={[styles.dayHead, d === dayString(new Date()) && { color: ui.colors.gold }]} onPress={() => { setAnchor(d); setMode('day'); }}>{new Date(`${d}T12:00:00`).toLocaleDateString(loc, { weekday: 'short', day: 'numeric' })}</Text> : null}
              <View style={{ height: (LAST - FIRST) * HOUR }}>
                {Array.from({ length: LAST - FIRST }, (_, i) => <View key={i} style={[styles.slot, { top: i * HOUR }, (closed || (h && !closed && h.start_time && h.end_time && (FIRST + i < Number(h.start_time.slice(0, 2)) || FIRST + i >= Number(h.end_time.slice(0, 2))))) ? styles.closed : null]} />)}
                {blocks.filter((b) => overlapsDay(b.start_at, b.end_at, d)).map((b) => <View key={b.id} style={[styles.event, styles.block, pos(b.start_at, b.end_at, d)]}><Text numberOfLines={2} style={styles.blockText}>{b.title || t('calendar.blocked')}</Text></View>)}
                {appointments.filter((a) => overlapsDay(a.start_at, a.end_at, d)).map((a) => <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.client?.display_name ?? t('calendar.client')}, ${a.service_name}`} onPress={() => router.push(`/bookings/${a.id}` as any)} style={[styles.event, styles.appt, a.status === 'request' || a.status === 'confirmation_pending' ? styles.pending : null, pos(a.start_at, a.end_at, d)]}>
                  <Text numberOfLines={1} style={styles.apptTitle}>{a.client?.display_name ?? t('calendar.client')}</Text>
                  {mode === 'day' ? <Text numberOfLines={1} style={styles.apptSub}>{time(a.start_at, loc)} · {a.service_name}{a.status !== 'confirmed' ? ` · ${a.status.replaceAll('_', ' ')}` : ''}</Text> : null}
                </Pressable>)}
              </View>
            </View>;
          })}
        </View>
      </ScrollView>
      {!busy && !appointments.length && !blocks.length ? <SupportText>{mode === 'day' ? t('calendar.nothingDay') : t('calendar.nothingWeek')}</SupportText> : null}
      <SupportText>{t('calendar.legend')}</SupportText>
    </Card>
    <View style={fieldStyles.row}>
      <ActionButton label={t('calendar.hours')} onPress={() => router.push('/business-hours' as any)} />
      <ActionButton label={t('calendar.daysOff')} onPress={() => router.push('/time-off' as any)} />
      <ActionButton label={t('calendar.services')} onPress={() => router.push('/services')} />
    </View>
  </Screen>;
}

function weekStart(day: string) { const dow = new Date(`${day}T12:00:00`).getDay(); return addDayString(day, -((dow + 6) % 7)); }
function time(iso: string, loc: string) { return new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }); }
function overlapsDay(start: string, end: string, day: string) { const s = new Date(`${day}T00:00:00`).getTime(); return Date.parse(start) < s + 86400000 && Date.parse(end) > s; }
function pos(start: string, end: string, day: string) {
  const base = new Date(`${day}T00:00:00`).getTime() + FIRST * 3600000;
  const top = Math.max(0, (Date.parse(start) - base) / 3600000 * HOUR);
  const bottom = Math.min((LAST - FIRST) * HOUR, (Date.parse(end) - base) / 3600000 * HOUR);
  return { top, height: Math.max(22, bottom - top) };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ui.spacing.sm },
  grid: { flexDirection: 'row', flex: 1, paddingTop: 4 },
  gutter: { width: 44, position: 'relative' },
  hourLabel: { position: 'absolute', left: 0, fontSize: 11, color: ui.colors.secondaryText, marginTop: 20 },
  dayCol: { flex: 1, position: 'relative', borderLeftWidth: 1, borderLeftColor: ui.colors.border },
  weekCol: { minWidth: 96 },
  dayHead: { fontSize: 12, fontWeight: '700', color: ui.colors.primaryText, textAlign: 'center', paddingBottom: 4 },
  slot: { position: 'absolute', left: 0, right: 0, height: HOUR, borderTopWidth: 1, borderTopColor: ui.colors.border },
  closed: { backgroundColor: 'rgba(120,120,120,0.10)' },
  event: { position: 'absolute', left: 3, right: 3, borderRadius: 8, padding: 4, overflow: 'hidden' },
  appt: { backgroundColor: ui.colors.warmSurface, borderLeftWidth: 3, borderLeftColor: ui.colors.gold },
  pending: { borderLeftColor: ui.colors.secondaryText, borderStyle: 'dashed', borderWidth: 1, borderColor: ui.colors.border },
  block: { backgroundColor: 'rgba(120,120,120,0.22)' },
  blockText: { fontSize: 11, color: ui.colors.secondaryText },
  apptTitle: { fontSize: 13, fontWeight: '700', color: ui.colors.primaryText },
  apptSub: { fontSize: 12, color: ui.colors.secondaryText }
});
