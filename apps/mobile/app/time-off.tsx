import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { ActionButton, Chip } from '../src/components/MessagingBits';
import { DateField, TimeField, addDayString, dayString, prettyDay, toIso } from '../src/components/DateField';
import { Field, fieldStyles } from '../src/components/Field';
import { Card, ScreenTitle, SectionTitle, SupportText } from '../src/components/ui';
import { createBlock, deleteBlock, getCalendar, type CalendarBlock } from '../src/lib/bookings';
import { getActiveWorkspace } from '../src/lib/workspace';
import { confirm, dialog } from '../src/lib/dialog';

export default function TimeOffScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [kind, setKind] = useState<'day' | 'hours'>('day');
  const [from, setFrom] = useState(dayString(new Date()));
  const [to, setTo] = useState(dayString(new Date()));
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [title, setTitle] = useState('Day off');
  const [flexible, setFlexible] = useState(false);
  useEffect(() => { void load(); }, []);
  async function load() {
    const id = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(id);
    const now = new Date();
    const data = await getCalendar(id, now.toISOString(), new Date(now.getTime() + 180 * 86400000).toISOString()).catch(() => ({ appointments: [], blocks: [] as CalendarBlock[] }));
    setBlocks(data.blocks);
  }
  async function add() {
    if (!workspaceId) return;
    const startAt = kind === 'day' ? toIso(from, '00:00') : toIso(from, start);
    const endAt = kind === 'day' ? toIso(addDayString(to < from ? from : to, 1), '00:00') : toIso(from, end);
    if (Date.parse(endAt) <= Date.parse(startAt)) { void dialog.notify('Check the times', 'The end must be after the start.'); return; }
    try { await createBlock(workspaceId, { title: title.trim() || 'Blocked', blockType: flexible ? 'soft' : 'personal', startAt, endAt }); await load(); }
    catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : ''); }
  }
  return <Screen>
    <ScreenTitle>Days off & blocks</ScreenTitle>
    <SupportText>Days off can't be booked. Flexible blocks ask "Book anyway?".</SupportText>
    <Card>
      <View style={fieldStyles.row}><Chip label="Whole days" selected={kind === 'day'} onPress={() => { setKind('day'); setTitle('Day off'); }} /><Chip label="A few hours" selected={kind === 'hours'} onPress={() => { setKind('hours'); setTitle('Blocked'); }} /></View>
      <Field label="Name" value={title} onChangeText={setTitle} />
      <DateField label={kind === 'day' ? 'First day' : 'Day'} value={from} onChange={(d) => { setFrom(d); if (to < d) setTo(d); }} />
      {kind === 'day' ? <DateField label="Last day" value={to} onChange={setTo} min={from} /> : <View style={fieldStyles.row}><TimeField label="From" value={start} onChange={setStart} /><TimeField label="To" value={end} onChange={setEnd} /></View>}
      <View style={fieldStyles.row}><Chip label="Can't be booked" selected={!flexible} onPress={() => setFlexible(false)} /><Chip label="Flexible" selected={flexible} onPress={() => setFlexible(true)} /></View>
      <ActionButton kind="primary" label="Add" onPress={() => void add()} />
    </Card>
    <Card>
      <SectionTitle>Coming up</SectionTitle>
      {!blocks.length ? <SupportText>No days off or blocks in the next 6 months.</SupportText> : null}
      {blocks.map((b) => <View key={b.id} style={fieldStyles.line}>
        <View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{b.title}</Text><SupportText>{prettyDay(dayString(new Date(b.start_at)))} {new Date(b.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} → {prettyDay(dayString(new Date(b.end_at)))} {new Date(b.end_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {b.block_type === 'soft' ? 'flexible' : "can't be booked"}</SupportText></View>
        <ActionButton kind="quiet" label="Delete" onPress={async () => { if (workspaceId && await confirm({ title: `Delete "${b.title}"?`, message: 'That time becomes bookable again.', confirmText: 'Delete', destructive: true })) { await deleteBlock(workspaceId, b.id).catch(() => undefined); await load(); } }} />
      </View>)}
    </Card>
  </Screen>;
}
