import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { DateField, TimeField, dayString } from '../../src/components/DateField';
import { Field, fieldStyles } from '../../src/components/Field';
import { Badge, BodyText, Card, Skeleton, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { cancelAppointment, completeAppointment, confirmAppointment, getAppointment, markNoShow, rescheduleAppointment, updateAppointment, type AppointmentDetail } from '../../src/lib/bookings';
import { formatYen, recordFinanceEntry } from '../../src/lib/finance';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';

const ACTIVE = ['request', 'confirmation_pending', 'confirmed', 'arrival_info_sent', 'checked_in'];
const METHODS = ['cash', 'card', 'paypay', 'bank_transfer'] as const;
const two = (n: number) => String(n).padStart(2, '0');

export default function BookingDetailScreen() {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
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
    } catch (e) { void dialog.notify(t('booking.couldNotLoad'), e instanceof Error ? e.message : ''); }
  }
  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { void dialog.notify(label, e instanceof Error ? e.message : t('booking.tryAgain')); }
    finally { setBusy(false); }
  }
  async function reschedule(override = false): Promise<void> {
    if (!workspaceId || !id) return;
    const startAt = new Date(`${day}T${time}:00`).toISOString();
    try { await rescheduleAppointment(workspaceId, id, { startAt, overrideSoftConflict: override }); setMoving(false); await load(); }
    catch (e: any) {
      if (e?.payload?.code === 'SOFT_CONFLICT' && !override) {
        if (await confirm({ title: t('booking.bookAnyway') + '?', message: t('booking.bookAnywayMsg'), confirmText: t('booking.bookAnyway') })) return reschedule(true);
        return;
      }
      void dialog.notify(e?.payload?.code === 'HARD_CONFLICT' ? t('booking.taken') : t('booking.couldNotMove'), e?.payload?.code === 'HARD_CONFLICT' ? t('booking.takenMsg') : e instanceof Error ? e.message : '');
    }
  }

  if (!detail || !workspaceId || !id) return <Screen><Skeleton rows={3} height={90} /></Screen>;
  const a = detail.appointment;
  const active = ACTIVE.includes(a.status);
  const started = Date.parse(a.start_at) <= Date.now();
  const clientName = a.client?.display_name ?? t('booking.clientDefault');
  return <Screen onRefresh={load}>
    <Card premium>
      <Badge status={a.status} label={t(`booking.status.${a.status}`, { defaultValue: a.status.replaceAll('_', ' ') })} />
      <ScreenTitle>{clientName}</ScreenTitle>
      <BodyText>{a.service_name}</BodyText>
      <SupportText>{new Date(a.start_at).toLocaleString(loc, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(a.end_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</SupportText>
      {detail.health.status === 'check_before_treatment' ? <Banner tone="warning">{t('booking.healthCheck', { flags: detail.health.redFlags.map((f) => f.replaceAll('_', ' ')).join(', ') })}</Banner> : null}
      {detail.health.status === 'missing' ? <Banner>{t('booking.healthMissing')}</Banner> : null}
      <View style={fieldStyles.row}>
        {['request', 'confirmation_pending'].includes(a.status) ? <ActionButton kind="primary" label={t('booking.confirm')} disabled={busy} onPress={() => void act(t('booking.couldNotConfirm'), () => confirmAppointment(workspaceId, id))} /> : null}
        {active ? <ActionButton label={t('booking.reschedule')} onPress={() => setMoving(!moving)} /> : null}
        {active && started ? <ActionButton kind="primary" label={t('booking.markDone')} disabled={busy} onPress={() => void act(t('booking.couldNotDone'), () => completeAppointment(workspaceId, id))} /> : null}
        {active && started ? <ActionButton label={t('booking.noShow')} disabled={busy} onPress={async () => { if (await confirm({ title: t('booking.noShowTitle', { name: clientName }), message: t('booking.noShowMsg'), confirmText: t('booking.noShow'), destructive: true })) void act(t('booking.couldNotUpdate'), () => markNoShow(workspaceId, id)); }} /> : null}
        {a.client?.id || a.client_id ? <ActionButton label={t('booking.message')} onPress={() => router.push({ pathname: '/messages/new', params: { clientId: a.client_id } } as any)} /> : null}
        <ActionButton label={t('booking.clientBtn')} onPress={() => router.push(`/clients/${a.client_id}` as any)} />
      </View>
      {active ? <ActionButton kind="quiet" label={t('booking.cancel')} onPress={async () => { if (await confirm({ title: t('booking.cancelTitle', { name: clientName }), message: t('booking.cancelMsg'), confirmText: t('booking.cancel'), destructive: true })) void act(t('booking.couldNotCancel'), () => cancelAppointment(workspaceId, id)); }} /> : null}
    </Card>

    {moving ? <Card>
      <SectionTitle>{t('booking.newTime')}</SectionTitle>
      <DateField label={t('booking.day')} value={day} onChange={setDay} />
      <TimeField label={t('booking.start')} value={time} onChange={setTime} />
      <ActionButton kind="primary" label={t('booking.moveBooking')} onPress={() => void reschedule()} />
    </Card> : null}

    <Card>
      <SectionTitle>{t('booking.money')}</SectionTitle>
      <View style={fieldStyles.line}><BodyText>{t('booking.price')}</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.price, a.currency)}</Text></View>
      <View style={fieldStyles.line}><BodyText>{t('booking.received')}</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.received, a.currency)}</Text></View>
      <View style={fieldStyles.line}><BodyText>{t('booking.due')}</BodyText><Text style={fieldStyles.strong}>{formatYen(detail.money.due, a.currency)}</Text></View>
      {!pay.open ? <View style={fieldStyles.row}>
        <ActionButton kind="primary" label={t('booking.recordPayment')} onPress={() => setPay({ ...pay, open: true, type: 'payment', amount: String(detail.money.due || '') })} />
        <ActionButton label={t('booking.recordDeposit')} onPress={() => setPay({ ...pay, open: true, type: 'deposit', amount: '' })} />
      </View> : <>
        <Field label={pay.type === 'deposit' ? t('booking.depositReceived') : t('booking.paymentReceived')} value={pay.amount} onChangeText={(amount) => setPay({ ...pay, amount })} keyboardType="number-pad" />
        <View style={fieldStyles.row}>{METHODS.map((v) => <Chip key={v} label={t(`booking.method.${v}`)} selected={pay.method === v} onPress={() => setPay({ ...pay, method: v })} />)}</View>
        <View style={fieldStyles.row}>
          <ActionButton kind="primary" label={t('booking.save')} disabled={!(Number(pay.amount) > 0)} onPress={() => void act(t('booking.couldNotRecord'), async () => {
            await recordFinanceEntry(workspaceId, { clientId: a.client_id, appointmentId: id, entryType: pay.type, amount: Number(pay.amount), method: pay.method, idempotencyKey: `appt-${pay.type}:${id}:${Date.now()}` });
            if (pay.type === 'deposit') await updateAppointment(workspaceId, id, { depositAmount: Number(pay.amount), depositMethod: pay.method }).catch(() => undefined);
            setPay({ ...pay, open: false, amount: '' });
          })} />
          <ActionButton kind="quiet" label={t('booking.close')} onPress={() => setPay({ ...pay, open: false })} />
        </View>
      </>}
    </Card>

    <Card>
      <SectionTitle>{t('booking.notesTitle')}</SectionTitle>
      <Field label={t('booking.notes')} value={notes} onChangeText={setNotes} multiline />
      <ActionButton label={t('booking.saveNotes')} disabled={notes === (a.notes ?? '')} onPress={() => void act(t('booking.couldNotSaveNotes'), () => updateAppointment(workspaceId, id, { notes }))} />
    </Card>

    <Card>
      <SectionTitle>{t('booking.history')}</SectionTitle>
      {detail.events.map((e) => <SupportText key={e.id}>{new Date(e.created_at).toLocaleString(loc)} · {e.event_type.replaceAll('_', ' ')}</SupportText>)}
    </Card>
  </Screen>;
}
