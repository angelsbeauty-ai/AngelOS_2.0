import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { Field, Tabs, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { addClientNote, addTreatment, getClient, setClientArchived, type ClientDetail } from '../../src/lib/clients';
import { formatYen, recordFinanceEntry } from '../../src/lib/finance';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';

type Tab = 'overview' | 'visits' | 'notes' | 'money' | 'forms';
const METHODS = [['cash', 'Cash'], ['card', 'Card'], ['paypay', 'PayPay'], ['bank_transfer', 'Bank transfer']] as const;

export default function ClientDetailScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [tab, setTab] = useState<Tab>(focus === 'note' ? 'notes' : 'overview');
  const [note, setNote] = useState('');
  const [treatment, setTreatment] = useState({ service: '', area: '', pigments: '', needle: '', numbing: '', reaction: '', stage: 'first_session' });
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (id) void load(); }, [id]);
  async function load() {
    if (!id) return;
    setBusy(true);
    try { const wsId = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(wsId); setDetail(await getClient(wsId, id)); }
    catch (error) { void dialog.notify('Could not load client', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function run(label: string, fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (error) { void dialog.notify(label, error instanceof Error ? error.message : 'Please try again.'); }
  }

  if (busy && !detail) return <Screen><Card><BodyText>Loading client…</BodyText></Card></Screen>;
  if (!detail || !id || !workspaceId) return <Screen><Card><BodyText>Client not found.</BodyText></Card></Screen>;
  const { client } = detail;
  const latestForm = detail.healthForms[0];
  const upcoming = detail.appointments.filter((a) => Date.parse(a.start_at) > Date.now() && !['cancelled', 'no_show'].includes(a.status));
  const past = detail.appointments.filter((a) => !upcoming.includes(a));
  const contacts: Array<[string, string]> = [];
  if (client.phone) contacts.push(['Call', `tel:${client.phone.replace(/[^+\d]/g, '')}`]);
  if (client.email) contacts.push(['Email', `mailto:${client.email}`]);
  if (client.instagram_handle) contacts.push(['Instagram', `https://instagram.com/${client.instagram_handle.replace(/^@/, '')}`]);
  if (client.line_id) contacts.push(['LINE', `https://line.me/R/ti/p/~${encodeURIComponent(client.line_id)}`]);

  return <Screen>
    <Card premium>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{client.display_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={fieldStyles.grow}>
          <ScreenTitle>{client.display_name}</ScreenTitle>
          <SupportText>{client.status.replaceAll('_', ' ')} · {client.language === 'ja' ? 'Japanese' : 'English'}</SupportText>
          <View style={fieldStyles.row}>
            {latestForm ? latestForm.red_flags.length ? <Pill tone="warning">Health: check before treatment</Pill> : <Pill tone="success">Health form OK</Pill> : <Pill>No health form yet</Pill>}
            {detail.touchUpDue ? <Pill tone="gold">Touch-up due</Pill> : null}
            {client.do_not_auto_message ? <Pill tone="warning">Manual messages only</Pill> : null}
            {client.archived_at ? <Pill>Archived</Pill> : null}
          </View>
        </View>
      </View>
      <View style={fieldStyles.row}>
        <ActionButton kind="primary" label="Book" onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: id } })} />
        <ActionButton label="Message" onPress={() => router.push({ pathname: '/messages/new', params: { clientId: id } } as any)} />
        <ActionButton label="Edit" onPress={() => router.push(`/clients/${id}/edit` as any)} />
        <ActionButton label="Ask AngelOS" onPress={() => router.push({ pathname: '/ai', params: { screen: 'client', entityType: 'client', entityId: id, entityLabel: client.display_name } })} />
      </View>
      {contacts.length ? <View style={fieldStyles.row}>{contacts.map(([label, url]) => <Chip key={label} label={label} onPress={() => void Linking.openURL(url).catch(() => undefined)} />)}</View> : null}
    </Card>

    <Tabs value={tab} onChange={setTab} options={[{ id: 'overview', label: 'Overview' }, { id: 'visits', label: 'Visits' }, { id: 'notes', label: 'Notes' }, { id: 'money', label: 'Money' }, { id: 'forms', label: 'Forms' }]} />

    {tab === 'overview' ? <>
      <Card>
        <SectionTitle>Next booking</SectionTitle>
        {upcoming.length ? upcoming.slice(0, 3).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.service_name}</Text>) : <SupportText>Nothing booked.</SupportText>}
      </Card>
      <Card>
        <SectionTitle>Details</SectionTitle>
        <BodyText>{client.phone ?? 'No phone saved'}</BodyText>
        <BodyText>{client.email ?? 'No email saved'}</BodyText>
        {client.instagram_handle ? <BodyText>Instagram: {client.instagram_handle}</BodyText> : null}
        {client.line_id ? <BodyText>LINE: {client.line_id}</BodyText> : null}
        {client.birthday ? <BodyText>Birthday: {client.birthday}</BodyText> : null}
      </Card>
      <ActionButton label={client.archived_at ? 'Unarchive client' : 'Archive client'} kind="quiet" onPress={async () => {
        if (!client.archived_at && !(await confirm({ title: `Archive ${client.display_name}?`, message: 'They move to the Archived list. Nothing is deleted.', confirmText: 'Archive' }))) return;
        void run('Could not update client', () => setClientArchived(workspaceId, id, !client.archived_at));
      }} />
    </> : null}

    {tab === 'visits' ? <>
      <Card>
        <SectionTitle>Treatment history</SectionTitle>
        {detail.treatments.length === 0 ? <SupportText>No treatments recorded yet.</SupportText> : null}
        {detail.treatments.map((t: any) => <View key={t.id} style={styles.item}>
          <Text style={fieldStyles.strong}>{t.service_name} · {t.stage.replaceAll('_', ' ')}</Text>
          <SupportText>{new Date(t.performed_at).toLocaleDateString()}{t.area ? ` · ${t.area}` : ''}</SupportText>
          {[t.pigments && `Pigments: ${t.pigments}`, t.needle && `Needle: ${t.needle}`, t.numbing && `Numbing: ${t.numbing}`, t.reaction && `Reaction: ${t.reaction}`].filter(Boolean).map((line: string) => <BodyText key={line}>{line}</BodyText>)}
          {t.notes ? <BodyText>{t.notes}</BodyText> : null}
        </View>)}
      </Card>
      <Card>
        <SectionTitle>Add a treatment</SectionTitle>
        <View style={fieldStyles.row}>{[['first_session', 'First session'], ['touch_up', 'Touch-up'], ['colour_boost', 'Colour boost']].map(([v, l]) => <Chip key={v} label={l} selected={treatment.stage === v} onPress={() => setTreatment({ ...treatment, stage: v })} />)}</View>
        <Field label="Service" value={treatment.service} onChangeText={(service) => setTreatment({ ...treatment, service })} placeholder="e.g. Powder brows" />
        <Field label="Area" value={treatment.area} onChangeText={(area) => setTreatment({ ...treatment, area })} placeholder="Brows, lips, eyeliner…" />
        <Field label="Pigments" value={treatment.pigments} onChangeText={(pigments) => setTreatment({ ...treatment, pigments })} />
        <Field label="Needle" value={treatment.needle} onChangeText={(needle) => setTreatment({ ...treatment, needle })} />
        <Field label="Numbing" value={treatment.numbing} onChangeText={(numbing) => setTreatment({ ...treatment, numbing })} />
        <Field label="Reaction / healing notes" value={treatment.reaction} onChangeText={(reaction) => setTreatment({ ...treatment, reaction })} multiline />
        <ActionButton kind="primary" label="Save treatment" disabled={!treatment.service.trim()} onPress={() => void run('Could not save treatment', async () => {
          await addTreatment(workspaceId, id, { serviceName: treatment.service.trim(), stage: treatment.stage, area: treatment.area || undefined, pigments: treatment.pigments || undefined, needle: treatment.needle || undefined, numbing: treatment.numbing || undefined, reaction: treatment.reaction || undefined });
          setTreatment({ service: '', area: '', pigments: '', needle: '', numbing: '', reaction: '', stage: 'first_session' });
        })} />
      </Card>
      <Card>
        <SectionTitle>Bookings</SectionTitle>
        {past.length ? past.slice(0, 20).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleDateString()} · {a.service_name} · {a.status.replaceAll('_', ' ')}</Text>) : <SupportText>No past bookings.</SupportText>}
      </Card>
      <ActionButton label="Add photos" onPress={() => router.push({ pathname: '/media/import', params: { clientId: id, role: 'other' } })} />
    </> : null}

    {tab === 'notes' ? <Card>
      <SectionTitle>Notes</SectionTitle>
      <Field label="New note" value={note} onChangeText={setNote} multiline autoFocus={focus === 'note'} />
      <ActionButton kind="primary" label="Add note" disabled={!note.trim()} onPress={() => void run('Could not save note', async () => { await addClientNote(workspaceId, id, note.trim()); setNote(''); })} />
      {detail.notes.map((n) => <View key={n.id} style={styles.item}><BodyText>{n.content}</BodyText><SupportText>{new Date(n.created_at).toLocaleDateString()}</SupportText></View>)}
    </Card> : null}

    {tab === 'money' ? <Card>
      <SectionTitle>Payments</SectionTitle>
      {detail.payments.length === 0 ? <SupportText>No payments yet.</SupportText> : detail.payments.map((p) => <View key={p.id} style={fieldStyles.line}><View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{p.entry_type.replaceAll('_', ' ')}</Text><SupportText>{p.method?.replaceAll('_', ' ') ?? 'other'} · {new Date(p.occurred_at).toLocaleDateString()}</SupportText></View><Text style={fieldStyles.strong}>{formatYen(Number(p.amount), p.currency)}</Text></View>)}
      <Field label="Money received" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="¥" hint="Only record money you actually received." />
      <View style={fieldStyles.row}>{METHODS.map(([v, l]) => <Chip key={v} label={l} selected={method === v} onPress={() => setMethod(v)} />)}</View>
      <ActionButton kind="primary" label="Record payment" disabled={!(Number(amount) > 0)} onPress={() => void run('Could not record payment', async () => { await recordFinanceEntry(workspaceId, { clientId: id, entryType: 'payment', amount: Number(amount), method, idempotencyKey: `client-payment:${id}:${Date.now()}` }); setAmount(''); })} />
    </Card> : null}

    {tab === 'forms' ? <>
      <Card>
        <SectionTitle>Health form</SectionTitle>
        {latestForm ? <>
          <SupportText>Signed by {latestForm.signed_name ?? 'client'} on {new Date(latestForm.signed_at ?? latestForm.created_at).toLocaleDateString()}</SupportText>
          {latestForm.red_flags.length ? <Banner tone="warning">Check before treatment: {latestForm.red_flags.map((f) => f.replaceAll('_', ' ')).join(', ')}</Banner> : <BodyText>No red flags.</BodyText>}
        </> : <SupportText>No health form yet. Fill it in with the client before the first session.</SupportText>}
        <ActionButton kind="primary" label="Fill health form" onPress={() => router.push(`/clients/${id}/health` as any)} />
      </Card>
      <Card>
        <SectionTitle>Consent</SectionTitle>
        {detail.consents.length === 0 ? <SupportText>No consent saved yet.</SupportText> : detail.consents.map((c: any) => <BodyText key={c.id}>{c.consent_type.replaceAll('_', ' ')}: {c.status}{c.signed_name ? ` (signed ${c.signed_name})` : ''}</BodyText>)}
        <ActionButton label="Add consent" onPress={() => router.push({ pathname: `/clients/${id}/health`, params: { mode: 'consent' } } as any)} />
      </Card>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ui.spacing.sm },
  avatar: { width: 52, height: 52, borderWidth: 1, borderColor: ui.colors.softGold, backgroundColor: ui.colors.elevated, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: ui.colors.gold, fontWeight: '700', fontSize: 20 },
  item: { borderTopWidth: 1, borderTopColor: ui.colors.border, paddingTop: ui.spacing.xs, gap: 3 },
  link: { color: ui.colors.gold, fontSize: 15, fontWeight: '600', paddingVertical: 6 }
});
