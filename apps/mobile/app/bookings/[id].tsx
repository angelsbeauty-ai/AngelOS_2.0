import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { DateField, TimeField, dayString } from '../../src/components/DateField';
import { Field, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { cancelAppointment, completeAppointment, confirmAppointment, getAppointment, markNoShow, rescheduleAppointment, updateAppointment, type AppointmentDetail } from '../../src/lib/bookings';
import { formatYen, recordFinanceEntry } from '../../src/lib/finance';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';

const ACTIVE = ['request', 'confirmation_pending', 'confirmed', 'arrival_info_sent', 'checked_in'];
const METHODS = [['cash', 'Cash'], ['card', 'Card'], ['paypay', 'PayPay'], ['bank_transfer', 'Bank transfer']] as const;
const two = (n: number) => String(n).padStart(2, '0');

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [moving, setMoving] = useState(false);
  const [pay, setPay] = useState<{ open: boolean; type: 'payment' | 'deposit'; amount: string; method: string }>({ open: false, type: 'payment', amount: '', method: 'cash' });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, [id]);
  async function load() {
    try {
      const wsId = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(wsId);
      const d = await getAppointment(wsId, id!); setDetail(d);
      const start = new Date(d.appointment.start_at);
      setDay(dayString(start)); setTime(`${two(start.getHours())}:${two(start.getMinutes())}`); setNotes(d.appointment.notes ?? '');
    } catch (e) { void dialog.notify('Could not load booking', e instanceof Error ? e.message : ''); }
  }
  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { void dialog.notify(label, e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function reschedule(override = false): Promise<void> {
    if (!workspaceId || !id) return;
    const startAt = new Date(`${day}T${time}:00`).toISOString();
    try { await rescheduleAppointment(workspaceId, id, { startAt, overrideSoftConflict: override }); setMoving(false); await load(); }
    catch (e: any) {
      if (e?.payload?.code === 'SOFT_CONFLICT' && !override) {
        if (await confirm({ title: 'Book anyway?', message: 'This time is outside your hours or overlaps a flexible block.', confirmText: 'Book anyway' })) return reschedule(true);
        return;
      }
      void dialog.notify(e?.payload?.code === 'HARD_CONFLICT' ? 'That time is taken' : 'Could not move booking', e?.payload?.code === 'HARD_CONFLICT' ? 'Another booking or a day off is already there. Pick another time.' : e instanceof Error ? e.message : '');
    }
  }

  if (!detail || !workspaceId || !id) return <Screen><Card><BodyText>Loading booking…</BodyText></Card></Screen>;
  const a = detail.appointment;
  const active = ACTIVE.includes(a.status);
  const started = Date.parse(a.start_at) <= Date.now();
  const clientName = a.client?.display_name ?? 'Client';
  return <Screen>
    <Card premium>
      <Pill tone={a.status === 'confirmed' ? 'success' : a.status === 'cancelled' || a.status === 'no_show' ? 'warning' : 'gold'}>{a.status.replaceAll('_', ' ')}</Pill>
      <ScreenTitle>{clientName}</ScreenTitle>
      <BodyText>{a.service_name}</BodyText>
      <SupportText>{new Date(a.start_at).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(a.end_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</SupportText>
      {detail.health.status === 'check_before_treatment' ? <Banner tone="warning">Health: check before treatment ({detail.health.redFlags.map((f) => f.replaceAll('_', ' ')).join(', ')})</Banner> : null}
      {detail.health.status === 'missing' ? <Banner>No health form yet for this client.</Banner> : null}
      <View style={fieldStyles.row}>
        {['request', 'confirmation_pending'].includes(a.status) ? <ActionButton kind="primary" label="Confirm" disabled={busy} onPress={() => void act('Could not confirm', () => confirmAppointment(workspaceId, id))} /> : null}
        {active ? <ActionButton label="Reschedule" onPress={() => setMoving(!moving)} /> : null}
        {active && started ? <ActionButton kind="primary" label="Mark done" disabled={busy} onPress={() => void act('Could not mark done', () => completeAppointment(workspaceId, id))} /> : null}
        {active && started ? <ActionButton label="No-show" disabled={busy} onPress={async () => { if (await confirm({ title: `Mark ${clientName} as no-show?`, message: 'This is saved in the booking history.', confirmText: 'Mark no-show', destructive: true })) void act('Could not update', () => markNoShow(workspaceId, id)); }} /> : null}
        {a.client?.id || a.client_id ? <ActionButton label="Message" onPress={() => router.push({ pathname: '/messages/new', params: { clientId: a.client_id } } as any)} /> : null}
        <ActionButton label="Client" onPress={() => router.push(`/clients/${a.client_id}` as any)} />
      </View>
      {active ? <ActionButton kind="quiet" label="Cancel booking" onPress={async () => { if (await confirm({ title: `Cancel ${clientName}'s booking?`, message: 'The time opens up again. No message is sent to the client.', confirmText: 'Cancel booking', destructive: true })) void act('Could not cancel', () => cancelAppointment(workspaceId, id)); }} /> : null}
    </Card>

    {moving ? <Card>
      <SectionTitle>New time</SectionTitle>
      <DateField label="Day" value={day} onChange={setDay} />
      <TimeField label="Start" value={time} onChange={setTime} />
      <ActionButton kind="primary" label="Move booking" onPress={() => void reschedule()} />
    </Card> : null}

    <Card>
      <SectionTitle>Money</SectionTitle>
      <View style={fieldStyles.line}><BodyText>Price</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.price, a.currency)}</Text></View>
      <View style={fieldStyles.line}><BodyText>Received</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.received, a.currency)}</Text></View>
      <View style={fieldStyles.line}><BodyText>Still to pay</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.due, a.currency)}</Text></View>
      {!pay.open ? <View style={fieldStyles.row}>
        <ActionButton kind="primary" label="Record payment" onPress={() => setPay({ ...pay, open: true, type: 'payment', amount: String(detail.money.due || '') })} />
        <ActionButton label="Record deposit" onPress={() => setPay({ ...pay, open: true, type: 'deposit', amount: '' })} />
      </View> : <>
        <Field label={pay.type === 'deposit' ? 'Deposit received' : 'Payment received'} value={pay.amount} onChangeText={(amount) => setPay({ ...pay, amount })} keyboardType="number-pad" />
        <View style={fieldStyles.row}>{METHODS.map(([v, l]) => <Chip key={v} label={l} selected={pay.method === v} onPress={() => setPay({ ...pay, method: v })} />)}</View>
        <View style={fieldStyles.row}>
          <ActionButton kind="primary" label="Save" disabled={!(Number(pay.amount) > 0)} onPress={() => void act('Could not record', async () => {
            await recordFinanceEntry(workspaceId, { clientId: a.client_id, appointmentId: id, entryType: pay.type, amount: Number(pay.amount), method: pay.method, idempotencyKey: `appt-${pay.type}:${id}:${Date.now()}` });
            if (pay.type === 'deposit') await updateAppointment(workspaceId, id, { depositAmount: Number(pay.amount), depositMethod: pay.method }).catch(() => undefined);
            setPay({ ...pay, open: false, amount: '' });
          })} />
          <ActionButton kind="quiet" label="Close" onPress={() => setPay({ ...pay, open: false })} />
        </View>
      </>}
    </Card>

    <Card>
      <SectionTitle>Booking notes</SectionTitle>
      <Field label="Notes (only you see these)" value={notes} onChangeText={setNotes} multiline />
      <ActionButton label="Save notes" disabled={notes === (a.notes ?? '')} onPress={() => void act('Could not save notes', () => updateAppointment(workspaceId, id, { notes }))} />
    </Card>

    <Card>
      <SectionTitle>History</SectionTitle>
      {detail.events.map((e) => <SupportText key={e.id}>{new Date(e.created_at).toLocaleString()} · {e.event_type.replaceAll('_', ' ')}</SupportText>)}
    </Card>
  </Screen>;
}
