import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/components/Screen';
import {
  BodyText,
  Card,
  Pill,
  PrimaryActionLabel,
  ScreenTitle,
  SecondaryActionLabel,
  SectionTitle,
  SupportText,
  ui
} from '../src/components/ui';
import { getCalendar, type CalendarAppointment, type CalendarBlock } from '../src/lib/bookings';
import { getActiveWorkspace } from '../src/lib/workspace';

export default function CalendarScreen() {
  const { focusLabel } = useLocalSearchParams<{ focusLabel?: string }>();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setBusy(true);
    try {
      const workspace = await getActiveWorkspace();
      const start = startOfToday();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const data = await getCalendar(workspace.id, start.toISOString(), end.toISOString());
      setAppointments(data.appointments);
      setBlocks(data.blocks);
    } catch (error) { Alert.alert('Could not load calendar', error instanceof Error ? error.message : 'Unknown error'); }
    finally { setBusy(false); }
  }

  const items = [
    ...appointments.map((item) => ({ id: `a-${item.id}`, start: item.start_at, kind: 'appointment' as const, title: `${item.client?.display_name ?? 'Client'} · ${item.service_name}`, detail: item.status })),
    ...blocks.map((item) => ({ id: `b-${item.id}`, start: item.start_at, kind: 'block' as const, title: item.title, detail: `${item.block_type} block` }))
  ].sort((a, b) => a.start.localeCompare(b.start));

  const todayItems = items.filter((item) => isToday(item.start));

  return <Screen>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Pill tone="gold">Next 7 Days</Pill>
        <ScreenTitle>Calendar</ScreenTitle>
        <SupportText>Appointments, blocks and conflicts in one view.</SupportText>
      </View>
      <Link href="/bookings/new" asChild>
        <Pressable style={styles.newBookingButton}>
          <PrimaryActionLabel>New</PrimaryActionLabel>
        </Pressable>
      </Link>
    </View>

    {focusLabel ? (
      <Card premium>
        <SectionTitle>Checking Availability</SectionTitle>
        <BodyText>{focusLabel}</BodyText>
      </Card>
    ) : null}

    <Card>
      <View style={styles.controlRow}>
        <Link href="/services" style={styles.serviceLink}>Manage Services</Link>
        <Pressable onPress={() => void load()} style={styles.refreshButton}>
          <SecondaryActionLabel>Refresh</SecondaryActionLabel>
        </Pressable>
      </View>
    </Card>

    {busy ? <Card><BodyText>Loading calendar...</BodyText></Card> : null}

    {!busy && todayItems.length > 0 && (
      <View>
        <SectionTitle>Today</SectionTitle>
        <View style={styles.timeline}>
          {todayItems.map((item) => <CalendarItem key={item.id} item={item} />)}
        </View>
      </View>
    )}

    {!busy && items.length === 0 ? (
      <Card>
        <SectionTitle>No bookings yet</SectionTitle>
        <SupportText>No appointments or blocks in the next 7 days.</SupportText>
      </Card>
    ) : null}

    {!busy && items.length > 0 && (
      <View>
        <SectionTitle>Upcoming</SectionTitle>
        <View style={styles.timeline}>
          {items.filter((item) => !isToday(item.start)).map((item) => <CalendarItem key={item.id} item={item} />)}
        </View>
      </View>
    )}
  </Screen>;
}

function CalendarItem({ item }: { item: { id: string; start: string; kind: 'appointment' | 'block'; title: string; detail: string } }) {
  return (
    <Card premium={item.kind === 'appointment'}>
      <View style={styles.itemHeader}>
        <Pill tone={item.kind === 'appointment' ? 'gold' : 'secondary'}>{item.kind}</Pill>
        <SupportText>{formatCalendarTime(item.start)}</SupportText>
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <SupportText>{item.detail.replaceAll('_', ' ')}</SupportText>
    </Card>
  );
}

function startOfToday() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
function isToday(value: string) {
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function formatCalendarTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ui.spacing.sm },
  headerCopy: { flex: 1, gap: ui.spacing.xs },
  newBookingButton: { width: 88 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: ui.spacing.sm },
  serviceLink: {
    flex: 1,
    color: ui.colors.gold,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: ui.spacing.sm
  },
  refreshButton: { width: 104 },
  timeline: { gap: ui.spacing.sm, marginTop: ui.spacing.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ui.spacing.sm },
  itemTitle: { color: ui.colors.primaryText, fontSize: 17, fontWeight: '700' }
});
