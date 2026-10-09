import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Button, Card, Header, SupportText, TextField, ui } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { toFriendly } from '../src/lib/friendly-error';
import { authRedirect } from '../src/lib/auth-redirect';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(''); setBusy(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('reset-password') });
    setBusy(false);
    if (authError) {
      const friendly = toFriendly(authError, { action: 'signin' });
      setError(`${friendly.title}: ${friendly.message}`);
      return;
    }
    setMessage(t('auth.linkSent'));
  }

  return <Screen hideAsk>
    <Header title={t('auth.forgotTitle')} subtitle={t('auth.forgotSub')} />
    <Card>
      <TextField label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button label={t('auth.sendLink')} loading={busy} disabled={!email.trim()} onPress={() => void send()} />
      {message ? <SupportText tone="success">{message}</SupportText> : null}
      {error ? <SupportText tone="critical">{error}</SupportText> : null}
    </Card>
    <Link href="/login" style={styles.link}>{t('auth.backToSignIn')}</Link>
  </Screen>;
}

const styles = StyleSheet.create({ link: { color: ui.colors.gold, fontFamily: 'Manrope_600SemiBold', fontSize: 15, textAlign: 'center', paddingVertical: 8 } });
