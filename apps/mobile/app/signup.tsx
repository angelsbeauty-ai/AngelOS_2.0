import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, TextField, ui } from '../src/components/ui';
import { BrandMark, SilkBackground } from '../src/components/BrandMark';
import { notify } from '../src/lib/dialog';
import { supabase } from '../src/lib/supabase';
import { toFriendly } from '../src/lib/friendly-error';
import { authRedirect } from '../src/lib/auth-redirect';
import { tokens } from '../src/design/theme';

export default function SignupScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signUp() {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('auth.emailInvalid'));
    if (password.length < 8) return setError(t('auth.min8'));
    if (password !== repeat) return setError(t('auth.noMatch'));
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect('') } });
    setBusy(false);
    if (authError) { await notify(t('auth.createFailed'), toFriendly(authError, { action: 'signin' }).message); return; }
    if (data.session) { router.replace('/onboarding'); return; }
    await notify(t('auth.created'), t('auth.createdMsg'));
    router.replace('/login');
  }

  return <SilkBackground><SafeAreaView style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.col}>
        <BrandMark size={72} />
        <Text style={styles.title}>{t('auth.signupTitle')}</Text>
        <Text style={styles.sub}>{t('auth.signupSub')}</Text>
        <View style={styles.form}>
          <TextField label={t('auth.email')} autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextField label={t('auth.password')} secure autoCapitalize="none" autoComplete="new-password" value={password} onChangeText={setPassword} hint={t('auth.min8')} />
          <TextField label={t('auth.confirmPassword')} secure autoCapitalize="none" autoComplete="new-password" value={repeat} onChangeText={setRepeat} error={error || null} onSubmitEditing={() => void signUp()} />
          <Button label={busy ? t('auth.working') : t('auth.create')} loading={busy} onPress={() => void signUp()} />
          <Button variant="ghost" label={t('auth.haveAccount')} onPress={() => router.replace('/login')} />
        </View>
      </View>
    </ScrollView>
  </SafeAreaView></SilkBackground>;
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: tokens.space.screen },
  col: { width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center', gap: 6 },
  title: { fontFamily: tokens.font.display, fontSize: 34, lineHeight: 40, color: ui.colors.primaryText, textAlign: 'center' },
  sub: { fontFamily: tokens.font.ui, fontSize: 14, color: ui.colors.secondaryText, textAlign: 'center', marginBottom: 12 },
  form: { width: '100%', gap: 12 }
});
