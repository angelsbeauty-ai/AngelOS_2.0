import { toFriendly, friendlyText } from '../../src/lib/friendly-error';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Chip } from '../../src/components/MessagingBits';
import { DateField, TimeField, addDayString, dayString } from '../../src/components/DateField';
import { Badge, BodyText, Button, Card, Header, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ApiError } from '../../src/lib/api';
import { createAppointment, listServices, type ServiceItem } from '../../src/lib/bookings';
import { getClient, listClients, type ClientSummary } from '../../src/lib/clients';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

const two = (n: number) => String(n).padStart(2, '0');

export default function NewBookingScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ clientId?: string; start?: string; serviceId?: string }>();
  const startParam = typeof params.start === 'string' && !Number.isNaN(Date.parse(params.start)) ? new Date(params.start) : null;
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [clientId, setClientId] = useState<string | null>(typeof params.clientId === 'string' ? params.clientId : null);
  const [serviceId, setServiceId] = useState<string | null>(typeof params.serviceId === 'string' ? params.serviceId : null);
  const [consents, setConsents] = useState<Array<{ id: string; consent_type: string; status: string }> | null>(null);
  const [date, setDate] = useState(startParam ? dayString(startParam) : addDayString(dayString(new Date()), 1));
  const [time, setTime] = useState(startParam ? `${two(startParam.getHours())}:${two(startParam.getMinutes())}` : '10:00');
  const [softConflict, setSoftConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!workspaceId) return;
    const h = setTimeout(() => { listClients(workspaceId, search).then(setClients).catch(() => undefined); }, search ? 300 : 0);
    return () => clearTimeout(h);
  }, [search, workspaceId]);
  useEffect(() => {
    if (!workspaceId || !clientId) { setConsents(null); return; }
    void getClient(workspaceId, clientId).then((detail) => setConsents(detail.consents ?? [])).catch(() => setConsents(null));
  }, [workspaceId, clientId]);

  async function load() {
    try {
      const workspace = await getActiveWorkspace();
      setWorkspaceId(workspace.id);
      setServices(await listServices(workspace.id));
    } catch (error) { void dialog.notify(t('booking.setupFail'), friendlyText(error, { action: 'save' }).message); }
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedService = services.find((s) => s.id === serviceId);

  async function save(overrideSoftConflict = false) {
    if (!workspaceId || !clientId || !serviceId) return;
    setBusy(true); setSoftConflict(false);
    try {
      const startAt = new Date(`${date}T${time}:00`).toISOString();
      await createAppointment(workspaceId, { clientId, serviceId, startAt, source: 'owner', overrideSoftConflict });
      void dialog.notify(t('booking.created'), `${selectedClient?.display_name ?? ''} · ${selectedService?.name ?? ''}`);
      // O10: back to the calendar on the booked day, at its time.
      router.replace({ pathname: '/calendar', params: { day: date, at: time } } as any);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.payload === 'object' && error.payload && (error.payload as any).code === 'SOFT_CONFLICT') { setSoftConflict(true); return; }
      void dialog.notify(t('booking.createFail'), toFriendly(error, { action: 'save' }).message);
    } finally { setBusy(false); }
  }

  return <Screen>
    <Header title={t('booking.newTitle')} subtitle={t('booking.newSub')} />

    <Card>
      <SectionTitle>{t('booking.client')}</SectionTitle>
      <TextInput value={search} onChangeText={setSearch} placeholder={t('booking.searchClient')} accessibilityLabel={t('booking.searchClient')} placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      {clients.length === 0 ? <SupportText>{t('booking.createClientFirst')}</SupportText> : null}
      <View style={styles.options}>
        {clients.slice(0, 20).map((client) => <Chip key={client.id} label={client.display_name} selected={clientId === client.id} onPress={() => setClientId(client.id)} />)}
      </View>
    </Card>

    <Card>
      <SectionTitle>{t('booking.service')}</SectionTitle>
      {services.length === 0 ? <SupportText>{t('booking.noServices')}</SupportText> : null}
      <View style={styles.options}>
        {services.map((service) => <Chip key={service.id} label={`${service.name} · ${t('booking.min', { n: service.duration_minutes })}`} selected={serviceId === service.id} onPress={() => setServiceId(service.id)} />)}
      </View>
      {selectedService ? <SupportText>{t('booking.estimated', { defaultValue: 'Estimated time: {{n}} min', n: selectedService.duration_minutes })}</SupportText> : null}
    </Card>

    {clientId ? <Card>
      <SectionTitle>{t('booking.consent', 'Consent')}</SectionTitle>
      {consents == null ? <SupportText>{t('booking.consentLoading', 'Checking the consent on file.')}</SupportText> : consents.length === 0 ? <SupportText>{t('booking.noConsent', 'No consent on file yet.')}</SupportText> : consents.map((c) => <BodyText key={c.id}>{c.consent_type.replace(/_/g, ' ')}: {c.status.replace(/_/g, ' ')}</BodyText>)}
      <Button variant="secondary" label={t('booking.addConsent', 'Add consent')} onPress={() => router.push({ pathname: `/clients/${clientId}/health`, params: { mode: 'consent' } } as any)} />
    </Card> : null}

    <Card>
      <SectionTitle>{t('booking.when')}</SectionTitle>
      <DateField label={t('booking.day')} value={date} onChange={setDate} />
      <TimeField label={t('booking.start')} value={time} onChange={setTime} />
    </Card>

    {softConflict ? (
      <Card>
        <View style={styles.warningHeader}><SectionTitle>{t('booking.softTitle')}</SectionTitle><Badge status="request" label={t('booking.review')} /></View>
        <BodyText>{t('booking.softMsg')}</BodyText>
        <Button variant="secondary" label={t('booking.bookAnyway')} onPress={() => void save(true)} />
      </Card>
    ) : null}

    <Button loading={busy} disabled={!clientId || !serviceId} label={busy ? t('booking.checking') : t('booking.check')} onPress={() => void save(false)} />
  </Screen>;
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, backgroundColor: '#FFFFFF', color: ui.colors.primaryText, paddingHorizontal: ui.spacing.sm, fontSize: 16 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ui.spacing.sm },
});
