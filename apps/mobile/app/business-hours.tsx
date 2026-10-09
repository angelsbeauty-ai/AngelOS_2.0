import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton } from '../src/components/MessagingBits';
import { TimeField } from '../src/components/DateField';
import { fieldStyles } from '../src/components/Field';
import { Card, ScreenTitle, SupportText } from '../src/components/ui';
import { getBusinessHours, setBusinessHours } from '../src/lib/bookings';
import { getActiveWorkspace } from '../src/lib/workspace';
import { dialog } from '../src/lib/dialog';

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Day = { dayOfWeek: number; startTime: string; endTime: string; isClosed: boolean };

export default function BusinessHoursScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void (async () => {
    const id = (await getActiveWorkspace()).id; setWorkspaceId(id);
    const rows = await getBusinessHours(id);
    setDays([1, 2, 3, 4, 5, 6, 0].map((d) => { const r = rows.find((x) => x.day_of_week === d); return { dayOfWeek: d, startTime: r?.start_time?.slice(0, 5) ?? '10:00', endTime: r?.end_time?.slice(0, 5) ?? '19:00', isClosed: r ? r.is_closed : d === 0 }; }));
  })().catch((e) => void dialog.notify('Could not load hours', e instanceof Error ? e.message : '')); }, []);
  const update = (i: number, patch: Partial<Day>) => setDays((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  async function save() {
    if (!workspaceId) return;
    if (days.some((d) => !d.isClosed && d.startTime >= d.endTime)) { void dialog.notify('Check the times', 'Closing time must be after opening time.'); return; }
    setSaving(true);
    try { await setBusinessHours(workspaceId, days.map((d) => (d.isClosed ? { dayOfWeek: d.dayOfWeek, isClosed: true } : d))); router.back(); }
    catch (e) { void dialog.notify('Could not save hours', e instanceof Error ? e.message : ''); }
    finally { setSaving(false); }
  }
  return <Screen>
    <ScreenTitle>Business hours</ScreenTitle>
    <SupportText>Bookings outside these hours ask "Book anyway?" first.</SupportText>
    {days.map((d, i) => <Card key={d.dayOfWeek}>
      <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{NAMES[d.dayOfWeek]}</Text><View style={fieldStyles.row}><SupportText>{d.isClosed ? 'Closed' : 'Open'}</SupportText><Switch accessibilityLabel={`${NAMES[d.dayOfWeek]} open`} value={!d.isClosed} onValueChange={(open) => update(i, { isClosed: !open })} /></View></View>
      {!d.isClosed ? <View style={fieldStyles.row}><TimeField label="Opens" value={d.startTime} onChange={(startTime) => update(i, { startTime })} /><TimeField label="Closes" value={d.endTime} onChange={(endTime) => update(i, { endTime })} /></View> : null}
    </Card>)}
    <ActionButton kind="primary" label={saving ? 'Saving…' : 'Save hours'} disabled={saving || !days.length} onPress={() => void save()} />
  </Screen>;
}
