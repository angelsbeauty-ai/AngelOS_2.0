import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton } from '../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, ScreenTitle, SupportText } from '../../src/components/ui';
import { listAllServices, updateService } from '../../src/lib/bookings';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

export default function EditServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [active, setActive] = useState(true);
  useEffect(() => { void (async () => {
    const wsId = (await getActiveWorkspace()).id; setWorkspaceId(wsId);
    const s = (await listAllServices(wsId)).find((x) => x.id === id);
    if (!s) throw new Error('Service not found');
    setF({ name: s.name, duration: String(s.duration_minutes), before: String(s.buffer_before_minutes), after: String(s.buffer_after_minutes), price: String(s.standard_price), deposit: s.deposit_amount != null ? String(s.deposit_amount) : '', description: s.description ?? '' });
    setActive(s.active !== false);
  })().catch((e) => void dialog.notify('Could not load service', e instanceof Error ? e.message : '')); }, [id]);
  if (!f) return <Screen><Card><BodyText>Loading…</BodyText></Card></Screen>;
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const int = (v: string) => Number.isInteger(Number(v)) ? Number(v) : NaN;
  async function save() {
    if (!workspaceId || !id || !f) return;
    const body = { name: f.name.trim(), durationMinutes: int(f.duration), bufferBeforeMinutes: int(f.before || '0'), bufferAfterMinutes: int(f.after || '0'), standardPrice: Number(f.price), depositAmount: f.deposit.trim() ? Number(f.deposit) : null, description: f.description.trim() || null, active };
    if (!body.name || !(body.durationMinutes >= 5) || !(body.standardPrice >= 0) || Number.isNaN(body.bufferBeforeMinutes) || Number.isNaN(body.bufferAfterMinutes)) { void dialog.notify('Check the details', 'Name, a duration of at least 5 minutes and a price are needed.'); return; }
    try { await updateService(workspaceId, id, body); router.back(); } catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : ''); }
  }
  return <Screen>
    <ScreenTitle>Edit service</ScreenTitle>
    <Card>
      <Field label="Name" value={f.name} onChangeText={set('name')} />
      <Field label="Description" value={f.description} onChangeText={set('description')} multiline />
      <View style={fieldStyles.row}>
        <View style={{ flex: 1 }}><Field label="Minutes" value={f.duration} onChangeText={set('duration')} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Before (min)" value={f.before} onChangeText={set('before')} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="After (min)" value={f.after} onChangeText={set('after')} keyboardType="number-pad" /></View>
      </View>
      <Field label="Price" value={f.price} onChangeText={set('price')} keyboardType="number-pad" />
      <Field label="Deposit (optional)" value={f.deposit} onChangeText={set('deposit')} keyboardType="number-pad" hint="Shown on the booking so you remember to ask for it." />
      <View style={fieldStyles.line}><View style={fieldStyles.grow}><BodyText>Show for new bookings</BodyText><SupportText>Turn off to hide it. Past bookings keep it.</SupportText></View><Switch accessibilityLabel="Show for new bookings" value={active} onValueChange={setActive} /></View>
      <ActionButton kind="primary" label="Save" onPress={() => void save()} />
    </Card>
  </Screen>;
}
