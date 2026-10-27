import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Card, SupportText, TextField } from '../../src/components/ui';
import { PushedHeader } from '../../src/components/PushedHeader';
import { getMe, updateMe } from '../../src/lib/me';
import { getActiveWorkspace, updateWorkspace } from '../../src/lib/workspace';
import { supabase } from '../../src/lib/supabase';
import { dialog } from '../../src/lib/dialog';
import { useAppearance } from '../../src/design/appearance';
import { friendlyText } from '../../src/lib/friendly-error';

/** P3 Edit profile: name (/me), studio name (workspace), email (Supabase sends a confirmation email). */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { mode } = useAppearance();
  const [orig, setOrig] = useState({ name: '', studio: '', email: '' });
  const [form, setForm] = useState({ name: '', studio: '', email: '' });
  const [wsId, setWsId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  useEffect(() => { void (async () => {
    const me = await getMe(true); const w = await getActiveWorkspace().catch(() => null);
    const o = { name: me.displayName ?? '', studio: w?.name ?? '', email: me.email ?? '' }; setOrig(o); setForm(o); setWsId(w?.id ?? null);
  })().catch(() => undefined); }, []);

  const changed = form.name !== orig.name || form.studio !== orig.studio || form.email !== orig.email;
  async function save() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('pf.required');
    if (wsId && !form.studio.trim()) e.studio = t('pf.required');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = t('pf.emailBad');
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (form.name !== orig.name) await updateMe({ displayName: form.name.trim() });
      if (wsId && form.studio !== orig.studio) await updateWorkspace(wsId, { name: form.studio.trim() });
      if (form.email.trim() !== orig.email) { const r = await supabase.auth.updateUser({ email: form.email.trim() }); if (r.error) throw r.error; setNote(t('pf.checkInbox')); setOrig({ ...form }); return; }
      router.back();
    } catch (err) { void dialog.notify(t('pf.saveFail'), friendlyText(err, { action: 'save' }).message); }
    finally { setBusy(false); }
  }

  return <Screen hideAsk>
    <Stack.Screen options={{ headerShown: false }} />
    <PushedHeader title={t('pf.editTitle')} right={<Pressable accessibilityRole="button" accessibilityLabel={t('pf.save')} onPress={() => { if (changed && !busy) void save(); }} hitSlop={8} style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: mode === 'night' ? '#F4F4F5' : '#151515', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, fontWeight: '700', color: mode === 'night' ? '#151515' : '#FFFFFF' }}>{t('pf.save')}</Text></Pressable>} />
    <Card>
      <TextField label={t('pf.name')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder={t('pf.namePh', 'Your name')} autoComplete="name" hint={orig.name ? undefined : t('pf.nameHint', 'This is how AngelOS greets you.')} error={errors.name} />
      {wsId ? <TextField label={t('pf.studio')} value={form.studio} onChangeText={(studio) => setForm({ ...form, studio })} error={errors.studio} /> : null}
      <TextField label={t('pf.email')} value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" keyboardType="email-address" hint={t('pf.emailHint')} error={errors.email} />
    </Card>
    {note ? <SupportText tone="success">{note}</SupportText> : null}
    <View />
  </Screen>;
}
