import { label } from '../../src/lib/labels';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsets as useSafeAreaInsets } from '../../src/lib/insets';
import { getMediaViewUrl, listMedia, type MediaAsset } from '../../src/lib/media';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../src/components/Field';
import { BodyText, Button, Card, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { addClientNote, addTreatment, getClient, setClientArchived, type ClientDetail } from '../../src/lib/clients';
import { formatYen, recordFinanceEntry } from '../../src/lib/finance';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';
import { useAppearance } from '../../src/design/appearance';

const METHODS = [['cash', 'cd.cash'], ['card', 'cd.card'], ['paypay', 'cd.paypay'], ['bank_transfer', 'cd.bank']] as const;

export default function ClientDetailScreen() {
  const { t } = useTranslation();
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const { mode, palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const night = mode === 'night';
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [treatOpen, setTreatOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(focus === 'note');
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [treatment, setTreatment] = useState({ service: '', area: '', pigments: '', needle: '', numbing: '', reaction: '', stage: 'first_session' });
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (id) void load(); }, [id]);
  async function load() {
    if (!id) return;
    setBusy(true);
    try { const wsId = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(wsId); setDetail(await getClient(wsId, id));
      void listMedia(wsId, { clientId: id }).then(async (rows) => { const imgs = rows.filter((r) => r.media_type === 'image' && r.upload_status === 'uploaded'); setPhotos(imgs); const urls = await Promise.all(imgs.slice(0, 8).map(async (r) => [r.id, (await getMediaViewUrl(wsId, r.id)).url] as const)); setPreviews(Object.fromEntries(urls)); }).catch(() => undefined); }
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
    <Stack.Screen options={{ title: client.display_name, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={t('cd.edit')} onPress={() => router.push(`/clients/${id}/edit` as any)} hitSlop={8} style={{ paddingHorizontal: 12, height: 32, justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>{t('cd.edit')}</Text></Pressable> }} />
    <View style={styles.header}>
      <View style={[styles.avatar, night && { backgroundColor: '#2A2A2D', borderColor: '#2A2A2D' }]}><Text style={[styles.avatarText, night && { color: '#F4F4F5' }]}>{client.display_name.slice(0, 1).toUpperCase()}</Text></View>
      <View style={fieldStyles.grow}>
        <Text style={[styles.title, { color: palette.text }]}>{client.display_name}</Text>
        <View style={styles.tags}>
          <View style={[styles.tag, { borderColor: night ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)' }]}><Text style={[styles.tagText, { color: night ? '#C7C7CC' : '#3A3A3C' }]}>{client.status === 'lead' ? t('clients.chipLead') : t('clients.chipClient')}</Text></View>
          {client.language ? <View style={[styles.tag, { borderColor: night ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)' }]}><Text style={[styles.tagText, { color: night ? '#C7C7CC' : '#3A3A3C' }]}>{client.language.toLowerCase().startsWith('ja') ? '日本語' : 'English'}</Text></View> : null}
        </View>
      </View>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cd.message')} onPress={() => router.push({ pathname: '/messages/new', params: { clientId: id } } as any)} style={[styles.chip, night && { borderColor: 'rgba(255,255,255,0.18)' }]}><Text style={[styles.chipText, { color: palette.text }]}>{t('cd.message')}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cd.book')} onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: id } })} style={[styles.chip, night && { borderColor: 'rgba(255,255,255,0.18)' }]}><Text style={[styles.chipText, { color: palette.text }]}>{t('cd.book')}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cd.addNote')} onPress={() => setNoteOpen(true)} style={[styles.chip, night && { borderColor: 'rgba(255,255,255,0.18)' }]}><Text style={[styles.chipText, { color: palette.text }]}>{t('cd.addNote')}</Text></Pressable>
    </View>
    {contacts.length ? <View style={fieldStyles.row}>{contacts.map(([label, url]) => <Chip key={label} label={label} onPress={() => void Linking.openURL(url).catch(() => undefined)} />)}</View> : null}

    <Card>
      <SectionTitle>{t('cd.next')}</SectionTitle>
      {upcoming.length ? upcoming.slice(0, 3).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.service_name}</Text>) : <SupportText>{t('cd.nothing')}</SupportText>}
    </Card>
    <Card>
      <SectionTitle>{t('cd.history')}</SectionTitle>
      {detail.treatments.length === 0 ? <SupportText>{t('cd.noTreat')}</SupportText> : null}
      {detail.treatments.map((tr: any) => <View key={tr.id} style={styles.item}>
        <Text style={fieldStyles.strong}>{tr.service_name} · {label(t, 'st', tr.stage)}</Text>
        <SupportText>{new Date(tr.performed_at).toLocaleDateString()}{tr.area ? ` · ${tr.area}` : ''}</SupportText>
      </View>)}
      <Button small variant="secondary" label={t('cd.addTreat')} onPress={() => setTreatOpen(true)} />
    </Card>
    <Card>
      <SectionTitle>{t('cd.notes')}</SectionTitle>
      {detail.notes.map((n) => <View key={n.id} style={styles.item}><BodyText>{n.content}</BodyText><SupportText>{new Date(n.created_at).toLocaleDateString()}</SupportText></View>)}
      <Button small variant="secondary" label={t('cd.addNote')} onPress={() => setNoteOpen(true)} />
    </Card>
    <Card>
      <SectionTitle>{t('cd.photos')}</SectionTitle>
      {photos.length ? <View style={styles.thumbs}>{photos.slice(0, 8).map((m) => <Pressable key={m.id} onPress={() => router.push(`/media/${m.id}` as any)}>{previews[m.id] ? <Image source={{ uri: previews[m.id] }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: night ? '#2A2A2D' : ui.colors.softGold }]} />}</Pressable>)}</View> : <SupportText>{t('cd.noPhotos')}</SupportText>}
      <Button small variant="secondary" label={t('cd.addPhotos')} onPress={() => router.push({ pathname: '/media/import', params: { clientId: id, role: 'other' } })} />
    </Card>
    <Card>
      <SectionTitle>{t('cd.healthForm')}</SectionTitle>
      {latestForm ? <SupportText>{t('cd.signedBy', { name: latestForm.signed_name ?? t('cd.clientWord'), date: new Date(latestForm.signed_at ?? latestForm.created_at).toLocaleDateString() })}</SupportText> : <SupportText>{t('cd.noFormYet')}</SupportText>}
      <ActionButton kind="primary" label={t('cd.fill')} onPress={() => router.push(`/clients/${id}/health` as any)} />
    </Card>
    <Card>
      <SectionTitle>{t('cd.payments')}</SectionTitle>
      {detail.payments.length === 0 ? <SupportText>{t('cd.noPay')}</SupportText> : detail.payments.map((p) => <View key={p.id} style={fieldStyles.line}><View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{label(t, 'st', p.entry_type)}</Text><SupportText>{(p.method ? label(t, 'st', p.method) : null) ?? t('cd.other')} · {new Date(p.occurred_at).toLocaleDateString()}</SupportText></View><Text style={fieldStyles.strong}>{formatYen(Number(p.amount), p.currency)}</Text></View>)}
      <Field label={t('cd.received')} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="¥" />
      <View style={fieldStyles.row}>{METHODS.map(([v, l]) => <Chip key={v} label={t(l)} selected={method === v} onPress={() => setMethod(v)} />)}</View>
      <ActionButton kind="primary" label={t('cd.record')} disabled={!(Number(amount) > 0)} onPress={() => void run(t('cd.payFail'), async () => { await recordFinanceEntry(workspaceId, { clientId: id, entryType: 'payment', amount: Number(amount), method, idempotencyKey: `client-payment:${id}:${Date.now()}` }); setAmount(''); })} />
    </Card>
    <Card>
      <SectionTitle>{t('cd.bookings')}</SectionTitle>
      {past.length ? past.slice(0, 20).map((a) => <Text key={a.id} style={styles.link} onPress={() => router.push(`/bookings/${a.id}` as any)}>{new Date(a.start_at).toLocaleDateString()} · {a.service_name} · {label(t, 'st', a.status)}</Text>) : <SupportText>{t('cd.noPast')}</SupportText>}
    </Card>
    <ActionButton label={client.archived_at ? t('cd.unarchive') : t('cd.archive')} kind="quiet" onPress={async () => {
      if (!client.archived_at && !(await confirm({ title: t('cd.archiveQ', { name: client.display_name }), message: t('cd.archiveMsg'), confirmText: t('cd.archiveBtn') }))) return;
      void run(t('cd.updateFail'), () => setClientArchived(workspaceId, id, !client.archived_at));
    }} />
    <View style={{ height: 58 + insets.bottom }} />

    <Modal visible={treatOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTreatOpen(false)}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, backgroundColor: night ? '#050505' : ui.colors.background }}>
        <SectionTitle>{t('cd.addTreat')}</SectionTitle>
        <Field label={t('cd.service')} value={treatment.service} onChangeText={(service) => setTreatment({ ...treatment, service })} />
        <Button label={t('cd.saveTreat')} disabled={!treatment.service.trim()} onPress={() => void run(t('cd.treatFail'), async () => { setTreatOpen(false); await addTreatment(workspaceId, id, { serviceName: treatment.service.trim(), stage: treatment.stage }); setTreatment({ service: '', area: '', pigments: '', needle: '', numbing: '', reaction: '', stage: 'first_session' }); })} />
        <Button variant="ghost" label={t('cd.close')} onPress={() => setTreatOpen(false)} />
      </ScrollView>
    </Modal>
    <Modal visible={noteOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNoteOpen(false)}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, backgroundColor: night ? '#050505' : '#FFFFFF' }}>
        <Field label={t('cd.newNote')} value={note} onChangeText={setNote} multiline autoFocus />
        <Button label={t('cd.addNote')} disabled={!note.trim()} onPress={() => void run(t('cd.noteFail'), async () => { await addClientNote(workspaceId, id, note.trim()); setNote(''); setNoteOpen(false); })} />
        <Button variant="ghost" label={t('cd.close')} onPress={() => setNoteOpen(false)} />
      </ScrollView>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: '#E4E4E6', backgroundColor: '#E4E4E6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#151515', fontWeight: '700', fontSize: 22 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  tags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  chip: { flex: 1, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  item: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 8, gap: 3 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: 6 }
});
