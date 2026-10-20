import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, TextField, ui } from '../src/components/ui';
import { BrandMark, SilkBackground } from '../src/components/BrandMark';
import { notify } from '../src/lib/dialog';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/api';
import { toFriendly } from '../src/lib/friendly-error';
import { tokens } from '../src/design/theme';
import { useAppearance } from '../src/design/appearance';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { mode } = useAppearance();
  const night = mode === 'night';
  const titleC = night ? '#F4F4F5' : ui.colors.primaryText;
  const subC = night ? '#C7C7CC' : ui.colors.secondaryText;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) { await notify(t('auth.signInFailed'), t('auth.fillBoth')); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { const f = toFriendly(error, { action: 'signin' }); await notify(f.title || t('auth.signInFailed'), f.message); return; }
    try {
      const workspaces = await apiFetch<Array<{ id: string }>>('/workspaces');
      router.replace(workspaces.length ? '/' : '/onboarding');
    } catch { router.replace('/onboarding'); }
  }

  return <SilkBackground><SafeAreaView style={{ flex: 1 }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
      <View style={styles.col}>
        <BrandMark size={96} variant="rose" />
        <Text style={[styles.title, { color: titleC }]}>{t('auth.loginTitle')}</Text>
        <Text style={[styles.sub, { color: subC }]}>{t('auth.loginSub')}</Text>
        <View style={styles.form}>
          <TextField label={t('auth.email')} autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <TextField label={t('auth.password')} secure autoCapitalize="none" autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={() => void signIn()} />
          <Link href="/forgot-password" accessibilityRole="link" style={[styles.forgot, { color: titleC }]}>{t('auth.forgot')}</Link>
          <Button label={busy ? t('auth.working') : t('auth.logIn')} loading={busy} onPress={() => void signIn()} />
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/signup')} style={styles.signup}><Text style={[styles.signupText, { color: titleC }]}>{t('auth.newHereLink')}</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView></SilkBackground>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: tokens.space.screen },
  col: { width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center', gap: 6 },
  title: { fontFamily: tokens.font.display, fontSize: 40, lineHeight: 46, color: ui.colors.primaryText, textAlign: 'center', marginTop: 8 },
  sub: { fontFamily: tokens.font.ui, fontSize: 15, color: ui.colors.secondaryText, marginBottom: 18 },
  form: { width: '100%', gap: 12 },
  forgot: { alignSelf: 'flex-end', color: '#151515', fontFamily: tokens.font.uiSemibold, fontSize: 14 },
  signup: { paddingVertical: 14, minHeight: 44, justifyContent: 'center' },
  signupText: { color: ui.colors.primaryText, fontFamily: tokens.font.uiSemibold, fontSize: 14, textDecorationLine: 'underline' }
});
void Platform;
