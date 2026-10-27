import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { tokens } from '../../src/design/theme';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Field, Tabs } from '../../src/components/Field';
import { ActionButton } from '../../src/components/MessagingBits';
import { BodyText, Button, Card, SectionTitle, SupportText } from '../../src/components/ui';
import { PushedHeader } from '../../src/components/PushedHeader';
import type { Lang } from '../../src/i18n';
import { dialog } from '../../src/lib/dialog';
import { DeleteAccountSheet } from '../../src/components/DeleteAccountSheet';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { clearMe, getMe, updateMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';
import { friendlyText } from '../../src/lib/friendly-error';

const err = (e: unknown) => friendlyText(e, { action: 'save' }).message;

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
    if (error) return dialog.notify(t('common.error'), friendlyText(error, { action: 'save' }).message);
    setPassword('');
    await dialog.notify(t('account.passwordDone'));
  }

  async function signOut() {
    if (!(await dialog.confirm({ title: t('settings.signOutTitle'), message: t('settings.signOutMsg'), confirmText: t('settings.signOut') }))) return;
    clearMe();
    await supabase.auth.signOut();
    router.replace('/login');
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
    <Card>
      <ActionButton kind="secondary" label={t('settings.signOut')} onPress={() => void signOut()} />
      {founder ? null : <Button variant="danger" label={t('pf.deleteRow')} onPress={() => setDelOpen(true)} />}
    </Card>
    {founder ? null : <SupportText>{t('pf.delFoot')}</SupportText>}
    <DeleteAccountSheet visible={delOpen} onClose={() => setDelOpen(false)} workspaceId={wsId} email={email || null} />
  </Screen>;
}
