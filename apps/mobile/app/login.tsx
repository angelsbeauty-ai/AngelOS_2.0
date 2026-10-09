import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Button, Card, Overline, ScreenTitle, SectionTitle, SupportText, TextField, ui } from '../src/components/ui';
import { notify } from '../src/lib/dialog';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/api';
import { toFriendly } from '../src/lib/friendly-error';
import { authRedirect } from '../src/lib/auth-redirect';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = Boolean(email.trim() && password);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      const f = toFriendly(error, { action: 'signin' });
      await notify(f.title || t('auth.signInFailed'), f.message);
      return;
    }
    try {
      const workspaces = await apiFetch<Array<{ id: string }>>('/workspaces');
      router.replace(workspaces.length ? '/' : '/onboarding');
    } catch {
      router.replace('/onboarding');
    }
  }

  async function signUp() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect('') } });
    setBusy(false);
    if (error) {
      await notify(t('auth.createFailed'), toFriendly(error, { action: 'signin' }).message);
      return;
    }
    await notify(t('auth.created'), t('auth.createdMsg'));
  }

  return <Screen hideAsk><View style={styles.stack}>
    <View style={{ gap: 4 }}><Overline>{t('auth.beta')}</Overline><ScreenTitle>{t('auth.welcome')}</ScreenTitle><SupportText>{t('auth.welcomeSub')}</SupportText></View>
    <Card premium>
      <SectionTitle>{t('auth.signIn')}</SectionTitle>
      <TextField label={t('auth.email')} autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <TextField label={t('auth.password')} secure autoCapitalize="none" autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={() => ready && void signIn()} />
      <Button label={busy ? t('auth.working') : t('auth.signIn')} loading={busy} disabled={!ready} onPress={() => void signIn()} />
      <Link href="/forgot-password" accessibilityRole="link" style={styles.link}>{t('auth.forgot')}</Link>
    </Card>
    <Card><SectionTitle>{t('auth.newHere')}</SectionTitle><SupportText>{t('auth.newHereMsg')}</SupportText><Button variant="secondary" label={t('auth.create')} disabled={busy || !ready} onPress={() => void signUp()} /></Card>
    <Card><SectionTitle>{t('auth.private')}</SectionTitle><SupportText>{t('auth.privateMsg')}</SupportText></Card>
  </View></Screen>;
}

const styles = StyleSheet.create({ stack: { gap: ui.spacing.md }, link: { color: ui.colors.gold, fontFamily: 'Manrope_600SemiBold', fontSize: 15, textAlign: 'center', paddingVertical: 8 } });
