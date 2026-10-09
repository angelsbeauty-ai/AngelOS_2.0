import { label } from '../../src/lib/labels';
import { useTranslation } from 'react-i18next';
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
const METHODS = [['cash', 'cd.cash'], ['card', 'cd.card'], ['paypay', 'cd.paypay'], ['bank_transfer', 'cd.bank']] as const;

export default function ClientDetailScreen() {
  const { t } = useTranslation();
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
    catch (error) { void dialog.notify(t('cf.loadFail'), error instanceof Error ? error.message : t('cf.tryAgain')); }
    finally { setBusy(false); }
  }
  async function run(label: string, fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (error) { void dialog.notify(label, error instanceof Error ? error.message : t('cf.tryAgain')); }
  }

  if (busy && !detail) return <Screen><Card><BodyText>{t('cd.loading')}</BodyText></Card></Screen>;
  if (!detail || !id || !workspaceId) return <Screen><Card><BodyText>{t('cd.notFound')}</BodyText></Card></Screen>;
  const { client } = detail;
  const latestForm = detail.healthForms[0];
  const upcoming = detail.appointments.filter((a) => Date.parse(a.start_at) > Date.now() && !['cancelled', 'no_show'].includes(a.status));
  const past = detail.appointments.filter((a) => !upcoming.includes(a));
  const contacts: Array<[string, string]> = [];
  if (client.phone) contacts.push([t('cd.call'), `tel:${client.phone.replace(/[^+\d]/g, '')}`]);
  if (client.email) contacts.push([t('cd.email'), `mailto:${client.email}`]);
  if (client.instagram_handle) contacts.push(['Instagram', `https://instagram.com/${client.instagram_handle.replace(/^@/, '')}`]);
  if (client.line_id) contacts.push(['LINE', `https://line.me/R/ti/p/~${encodeURIComponent(client.line_id)}`]);

  return <Screen>
    <Card premium>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{client.display_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={fieldStyles.grow}>
          <ScreenTitle>{client.display_name}</ScreenTitle>
          <SupportText>{label(t, 'st', client.status)} · {client.language === 'ja' ? t('cd.ja') : t('cd.en')}</SupportText>
          <View style={fieldStyles.row}>
            {latestForm ? latestForm.red_flags.length ? <Pill tone="warning">{t('cd.hCheck')}</Pill> : <Pill tone="success">{t('cd.hOk')}</Pill> : <Pill>{t('cd.hNone')}</Pill>}
            {detail.touchUpDue ? <Pill tone="gold">{t('cd.touchUp')}</Pill> : null}
            {client.do_not_auto_message ? <Pill tone="warning">{t('cd.manual')}</Pill> : null}
            {client.archived_at ? <Pill>{t('cd.archived')}</Pill> : null}
          </View>
        </View>
      </View>
      <View style={fieldStyles.row}>
        <ActionButton kind="primary" label={t('cd.book')} onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: id } })} />
        <ActionButton label={t('cd.message')} onPress={() => router.push({ pathname: '/messages/new', params: { clientId: id } } as any)} />
        <ActionButton label={t('cd.edit')} onPress={() => router.push(`/clients/${id}/edit` as any)} />
        <ActionButton label={t('cd.ask')} onPress={() => router.push({ pathname: '/ai', params: { screen: 'client', entityType: 'client', entityId: id, entityLabel: client.display_name } })} />
      </View>
      {contacts.length ? <View style={fieldStyles.row}>{contacts.map(([label, url]) => <Chip key={label} label={label} onPress={() => void Linking.openURL(url).catch(() => undefined)} />)}</View> : null}
    </Card>

    <Tabs value={tab} onChange={setTab} options={[{ id: 'overview', label: t('cd.tOverview') }, { id: 'visits', label: t('cd.tVisits') }, { id: 'notes', label: t('cd.tNotes') }, { id: 'money', label: t('cd.tMoney') }, { id: 'forms', label: t('cd.tForms') }]} />

    {tab === 'overview' ? <>
      <Card>
        <SectionTitle>{t('cd.next')}</SectionTitle>
        {upcoming.length ? upcoming.slice(0, 3).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.service_name}</Text>) : <SupportText>{t('cd.nothing')}</SupportText>}
      </Card>
      <Card>
        <SectionTitle>{t('cd.details')}</SectionTitle>
        <BodyText>{client.phone ?? t('cd.noPhone')}</BodyText>
        <BodyText>{client.email ?? t('cd.noEmail')}</BodyText>
        {client.instagram_handle ? <BodyText>Instagram: {client.instagram_handle}</BodyText> : null}
        {client.line_id ? <BodyText>LINE: {client.line_id}</BodyText> : null}
        {client.birthday ? <BodyText>{t('cd.birthday', { v: client.birthday })}</BodyText> : null}
      </Card>
      <ActionButton label={client.archived_at ? t('cd.unarchive') : t('cd.archive')} kind="quiet" onPress={async () => {
        if (!client.archived_at && !(await confirm({ title: t('cd.archiveQ', { name: client.display_name }), message: t('cd.archiveMsg'), confirmText: t('cd.archiveBtn') }))) return;
        void run(t('cd.updateFail'), () => setClientArchived(workspaceId, id, !client.archived_at));
      }} />
    </> : null}

    {tab === 'visits' ? <>
      <Card>
        <SectionTitle>{t('cd.history')}</SectionTitle>
        {detail.treatments.length === 0 ? <SupportText>{t('cd.noTreat')}</SupportText> : null}
        {detail.treatments.map((tr: any) => <View key={tr.id} style={styles.item}>
          <Text style={fieldStyles.strong}>{tr.service_name} · {label(t, 'st', tr.stage)}</Text>
          <SupportText>{new Date(tr.performed_at).toLocaleDateString()}{tr.area ? ` · ${tr.area}` : ''}</SupportText>
          {[tr.pigments && `${t('cd.pigments')}: ${tr.pigments}`, tr.needle && `${t('cd.needle')}: ${tr.needle}`, tr.numbing && `${t('cd.numbing')}: ${tr.numbing}`, tr.reaction && `${t('cd.reaction')}: ${tr.reaction}`].filter(Boolean).map((line: string) => <BodyText key={line}>{line}</BodyText>)}
          {tr.notes ? <BodyText>{tr.notes}</BodyText> : null}
        </View>)}
      </Card>
      <Card>
        <SectionTitle>{t('cd.addTreat')}</SectionTitle>
        <View style={fieldStyles.row}>{[['first_session', t('cd.first')], ['touch_up', t('cd.touch')], ['colour_boost', t('cd.boost')]].map(([v, l]) => <Chip key={v} label={l} selected={treatment.stage === v} onPress={() => setTreatment({ ...treatment, stage: v })} />)}</View>
        <Field label={t('cd.service')} value={treatment.service} onChangeText={(service) => setTreatment({ ...treatment, service })} placeholder={t('cd.servicePh')} />
        <Field label={t('cd.area')} value={treatment.area} onChangeText={(area) => setTreatment({ ...treatment, area })} placeholder={t('cd.areaPh')} />
        <Field label={t('cd.pigments')} value={treatment.pigments} onChangeText={(pigments) => setTreatment({ ...treatment, pigments })} />
        <Field label={t('cd.needle')} value={treatment.needle} onChangeText={(needle) => setTreatment({ ...treatment, needle })} />
        <Field label={t('cd.numbing')} value={treatment.numbing} onChangeText={(numbing) => setTreatment({ ...treatment, numbing })} />
        <Field label={t('cd.reaction')} value={treatment.reaction} onChangeText={(reaction) => setTreatment({ ...treatment, reaction })} multiline />
        <ActionButton kind="primary" label={t('cd.saveTreat')} disabled={!treatment.service.trim()} onPress={() => void run(t('cd.treatFail'), async () => {
          await addTreatment(workspaceId, id, { serviceName: treatment.service.trim(), stage: treatment.stage, area: treatment.area || undefined, pigments: treatment.pigments || undefined, needle: treatment.needle || undefined, numbing: treatment.numbing || undefined, reaction: treatment.reaction || undefined });
          setTreatment({ service: '', area: '', pigments: '', needle: '', numbing: '', reaction: '', stage: 'first_session' });
        })} />
      </Card>
      <Card>
        <SectionTitle>{t('cd.bookings')}</SectionTitle>
        {past.length ? past.slice(0, 20).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleDateString()} · {a.service_name} · {label(t, 'st', a.status)}</Text>) : <SupportText>{t('cd.noPast')}</SupportText>}
      </Card>
      <ActionButton label={t('cd.addPhotos')} onPress={() => router.push({ pathname: '/media/import', params: { clientId: id, role: 'other' } })} />
    </> : null}

    {tab === 'notes' ? <Card>
      <SectionTitle>{t('cd.notes')}</SectionTitle>
      <Field label={t('cd.newNote')} value={note} onChangeText={setNote} multiline autoFocus={focus === 'note'} />
      <ActionButton kind="primary" label={t('cd.addNote')} disabled={!note.trim()} onPress={() => void run(t('cd.noteFail'), async () => { await addClientNote(workspaceId, id, note.trim()); setNote(''); })} />
      {detail.notes.map((n) => <View key={n.id} style={styles.item}><BodyText>{n.content}</BodyText><SupportText>{new Date(n.created_at).toLocaleDateString()}</SupportText></View>)}
    </Card> : null}

    {tab === 'money' ? <Card>
      <SectionTitle>{t('cd.payments')}</SectionTitle>
      {detail.payments.length === 0 ? <SupportText>{t('cd.noPay')}</SupportText> : detail.payments.map((p) => <View key={p.id} style={fieldStyles.line}><View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{label(t, 'st', p.entry_type)}</Text><SupportText>{(p.method ? label(t, 'st', p.method) : null) ?? t('cd.other')} · {new Date(p.occurred_at).toLocaleDateString()}</SupportText></View><Text style={fieldStyles.strong}>{formatYen(Number(p.amount), p.currency)}</Text></View>)}
      <Field label={t('cd.received')} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="¥" hint={t('cd.receivedHint')} />
      <View style={fieldStyles.row}>{METHODS.map(([v, l]) => <Chip key={v} label={t(l)} selected={method === v} onPress={() => setMethod(v)} />)}</View>
      <ActionButton kind="primary" label={t('cd.record')} disabled={!(Number(amount) > 0)} onPress={() => void run(t('cd.payFail'), async () => { await recordFinanceEntry(workspaceId, { clientId: id, entryType: 'payment', amount: Number(amount), method, idempotencyKey: `client-payment:${id}:${Date.now()}` }); setAmount(''); })} />
    </Card> : null}

    {tab === 'forms' ? <>
      <Card>
        <SectionTitle>{t('cd.healthForm')}</SectionTitle>
        {latestForm ? <>
          <SupportText>{t('cd.signedBy', { name: latestForm.signed_name ?? t('cd.clientWord'), date: new Date(latestForm.signed_at ?? latestForm.created_at).toLocaleDateString() })}</SupportText>
          {latestForm.red_flags.length ? <Banner tone="warning">{t('cd.checkB4', { flags: latestForm.red_flags.map((f) => label(t, 'st', f)).join(', ') })}</Banner> : <BodyText>{t('cd.noFlags')}</BodyText>}
        </> : <SupportText>{t('cd.noFormYet')}</SupportText>}
        <ActionButton kind="primary" label={t('cd.fill')} onPress={() => router.push(`/clients/${id}/health` as any)} />
      </Card>
      <Card>
        <SectionTitle>{t('cd.consent')}</SectionTitle>
        {detail.consents.length === 0 ? <SupportText>{t('cd.noConsent')}</SupportText> : detail.consents.map((c: any) => <BodyText key={c.id}>{label(t, 'st', c.consent_type)}: {label(t, 'st', c.status)}{c.signed_name ? ` ${t('cd.signed', { name: c.signed_name })}` : ''}</BodyText>)}
        <ActionButton label={t('cd.addConsent')} onPress={() => router.push({ pathname: `/clients/${id}/health`, params: { mode: 'consent' } } as any)} />
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
