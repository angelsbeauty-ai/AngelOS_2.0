import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ActionButton, Chip } from '../../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../../src/components/Field';
import { BodyText, Card, ScreenTitle, SupportText } from '../../../src/components/ui';
import { getClient, updateClient } from '../../../src/lib/clients';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import { dialog } from '../../../src/lib/dialog';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState('ja');
  const [manualOnly, setManualOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    const wsId = (await getActiveWorkspace()).id; setWorkspaceId(wsId);
    const { client } = await getClient(wsId, id!);
    setForm({ displayName: client.display_name, phone: client.phone ?? '', email: client.email ?? '', lineId: client.line_id ?? '', instagramHandle: client.instagram_handle ?? '', birthday: client.birthday ?? '' });
    setLanguage(client.language === 'en' ? 'en' : 'ja'); setManualOnly(client.do_not_auto_message);
  })().catch((e) => void dialog.notify('Could not load client', e instanceof Error ? e.message : '')); }, [id]);

  async function save() {
    if (!workspaceId || !id) return;
    if (form.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthday)) { void dialog.notify('Check the birthday', 'Use the format 1990-05-21.'); return; }
    setSaving(true);
    try {
      await updateClient(workspaceId, id, { displayName: form.displayName?.trim(), phone: form.phone?.trim() || null, email: form.email?.trim() || null, lineId: form.lineId?.trim() || null, instagramHandle: form.instagramHandle?.trim() || null, birthday: form.birthday || null, language, doNotAutoMessage: manualOnly });
      router.back();
    } catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  if (!form.displayName && form.displayName !== '') return <Screen><Card><BodyText>Loading…</BodyText></Card></Screen>;
  return <Screen>
    <ScreenTitle>Edit client</ScreenTitle>
    <Card>
      <Field label="Name" value={form.displayName} onChangeText={set('displayName')} />
      <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label="LINE ID" value={form.lineId} onChangeText={set('lineId')} autoCapitalize="none" />
      <Field label="Instagram" value={form.instagramHandle} onChangeText={set('instagramHandle')} autoCapitalize="none" placeholder="@name" />
      <Field label="Birthday" value={form.birthday} onChangeText={set('birthday')} placeholder="1990-05-21" hint="Used for an optional birthday message suggestion." />
      <SupportText>Client language (messages to them use only this language)</SupportText>
      <View style={fieldStyles.row}><Chip label="Japanese" selected={language === 'ja'} onPress={() => setLanguage('ja')} /><Chip label="English" selected={language === 'en'} onPress={() => setLanguage('en')} /></View>
      <View style={fieldStyles.line}><View style={fieldStyles.grow}><BodyText>Manual messages only</BodyText><SupportText>AngelOS won't suggest reminder messages for this client.</SupportText></View><Switch value={manualOnly} onValueChange={setManualOnly} accessibilityLabel="Manual messages only" /></View>
      <ActionButton kind="primary" label={saving ? 'Saving…' : 'Save'} disabled={saving || !form.displayName?.trim()} onPress={() => void save()} />
    </Card>
  </Screen>;
}
