import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Field, Tabs } from '../../src/components/Field';
import { ActionButton } from '../../src/components/MessagingBits';
import { BodyText, Card, SectionTitle, SupportText } from '../../src/components/ui';
import { PushedHeader } from '../../src/components/PushedHeader';
import type { Lang } from '../../src/i18n';
import { dialog } from '../../src/lib/dialog';
import { DeleteAccountSheet } from '../../src/components/DeleteAccountSheet';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { clearMe, getMe, updateMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function AccountSettings() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [founder, setFounder] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getMe().then((me) => { setName(me.displayName ?? ''); setEmail(me.email); setFounder(me.founder); }).catch(() => undefined); }, []);

  async function saveName() {
    setBusy(true);
    try { await updateMe({ displayName: name.trim() }); await dialog.notify(t('common.saved')); } catch (e) { await dialog.notify(t('common.error'), err(e)); } finally { setBusy(false); }
  }
  async function setLang(lang: Lang) {
    try { await updateMe({ language: lang }); } catch (e) { await dialog.notify(t('common.error'), err(e)); }
  }
  async function changePassword() {
    if (password.length < 8) return dialog.notify(t('account.passwordHint'));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return dialog.notify(t('common.error'), error.message);
    setPassword('');
    await dialog.notify(t('account.passwordDone'));
  }

  const [delOpen, setDelOpen] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);
  useEffect(() => { void getActiveWorkspace().then((w) => setWsId(w?.id ?? null)).catch(() => undefined); }, []);
  return <Screen>
    <PushedHeader title={t('account.title')} />
    {email ? <SupportText>{email}</SupportText> : null}
    <Card><Field label={t('account.name')} value={name} onChangeText={setName} autoComplete="name" /><ActionButton kind="primary" label={t('common.save')} disabled={busy || !name.trim()} onPress={() => void saveName()} /></Card>
    <Card><SectionTitle>{t('account.language')}</SectionTitle><Tabs<Lang> value={i18n.language === 'ja' ? 'ja' : 'en'} options={[{ id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }]} onChange={(l) => void setLang(l)} /></Card>
    <Card><Field label={t('account.password')} hint={t('account.passwordHint')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" /><ActionButton kind="primary" label={t('account.changePassword')} disabled={busy || !password} onPress={() => void changePassword()} /></Card>
    {founder ? null : <Card><SectionTitle>{t('account.danger')}</SectionTitle><BodyText>{t('pf.delBody')}</BodyText><ActionButton label={t('pf.delete')} onPress={() => setDelOpen(true)} /></Card>}
    <DeleteAccountSheet visible={delOpen} onClose={() => setDelOpen(false)} workspaceId={wsId} email={email || null} />
  </Screen>;
}
