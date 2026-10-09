import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Field, Tabs } from '../../src/components/Field';
import { ActionButton } from '../../src/components/MessagingBits';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import type { Lang } from '../../src/i18n';
import { dialog } from '../../src/lib/dialog';
import { clearMe, deleteMe, getMe, updateMe } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function AccountSettings() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [founder, setFounder] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
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
  async function deleteAccount() {
    if (typed !== 'DELETE') return;
    const ok = await dialog.confirm({ title: t('account.danger'), message: t('account.dangerText'), confirmText: t('account.deleteBtn'), destructive: true });
    if (!ok) return;
    setBusy(true);
    try { await deleteMe(); clearMe(); await supabase.auth.signOut(); await dialog.notify(t('account.deleted')); router.replace('/login'); }
    catch (e) { await dialog.notify(t('common.error'), err(e)); } finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>{t('account.title')}</ScreenTitle>
    {email ? <SupportText>{email}</SupportText> : null}
    <Card><Field label={t('account.name')} value={name} onChangeText={setName} autoComplete="name" /><ActionButton kind="primary" label={t('common.save')} disabled={busy || !name.trim()} onPress={() => void saveName()} /></Card>
    <Card><SectionTitle>{t('account.language')}</SectionTitle><Tabs<Lang> value={i18n.language === 'ja' ? 'ja' : 'en'} options={[{ id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }]} onChange={(l) => void setLang(l)} /></Card>
    <Card><Field label={t('account.password')} hint={t('account.passwordHint')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" /><ActionButton label={t('account.changePassword')} disabled={busy || !password} onPress={() => void changePassword()} /></Card>
    {founder ? null : <Card><SectionTitle>{t('account.danger')}</SectionTitle><BodyText>{t('account.dangerText')}</BodyText><Field label="DELETE" value={typed} onChangeText={setTyped} autoCapitalize="characters" /><ActionButton label={t('account.deleteBtn')} disabled={busy || typed !== 'DELETE'} onPress={() => void deleteAccount()} /></Card>}
  </Screen>;
}
