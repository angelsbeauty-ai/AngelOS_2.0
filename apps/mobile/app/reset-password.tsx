import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Button, Card, ScreenTitle, SupportText, TextField } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { notify } from '../src/lib/dialog';

/** Collect every way Supabase can hand us a recovery link: ?code= (PKCE), ?token_hash=&type=recovery, #access_token=&refresh_token=. */
async function linkParams(): Promise<URLSearchParams> {
  const merged = new URLSearchParams();
  const take = (raw: string | null | undefined) => { if (!raw) return; new URLSearchParams(raw.replace(/^[?#]/, '')).forEach((v, k) => merged.set(k, v)); };
  if (Platform.OS === 'web' && typeof window !== 'undefined') { take(window.location.search); take(window.location.hash); }
  else { const url = (await Linking.getInitialURL()) ?? ''; take(url.split('#')[1]); take(url.includes('?') ? url.split('?')[1].split('#')[0] : ''); }
  return merged;
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setState('ready'); });
    void (async () => {
      const p = await linkParams();
      const clean = () => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname); };
      let ok = false;
      if (p.get('code')) ok = !(await supabase.auth.exchangeCodeForSession(p.get('code')!)).error;
      else if (p.get('token_hash')) ok = !(await supabase.auth.verifyOtp({ token_hash: p.get('token_hash')!, type: (p.get('type') as 'recovery') || 'recovery' })).error;
      else if (p.get('access_token') && p.get('refresh_token')) ok = !(await supabase.auth.setSession({ access_token: p.get('access_token')!, refresh_token: p.get('refresh_token')! })).error;
      else if (p.get('error_description') || p.get('error')) ok = false;
      else ok = Boolean((await supabase.auth.getSession()).data.session);
      if (ok) clean();
      setState(ok ? 'ready' : 'invalid');
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save() {
    setError('');
    if (password.length < 8) return setError(t('auth.min8'));
    if (password !== repeat) return setError(t('auth.noMatch'));
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    await notify(t('auth.resetOk'), t('auth.resetOkMsg'));
    router.replace('/');
  }

  return <Screen hideAsk>
    <ScreenTitle>{t('auth.chooseNew')}</ScreenTitle>
    <Card>
      {state === 'checking' ? <SupportText>{t('auth.verifying')}</SupportText> : null}
      {state === 'ready' ? <>
        <TextField label={t('auth.newPassword')} secure autoCapitalize="none" autoComplete="new-password" value={password} onChangeText={setPassword} hint={t('account.passwordHint')} />
        <TextField label={t('auth.repeatPassword')} secure autoCapitalize="none" autoComplete="new-password" value={repeat} onChangeText={setRepeat} onSubmitEditing={() => void save()} />
        {error ? <SupportText tone="critical">{error}</SupportText> : null}
        <Button label={t('auth.save')} loading={busy} onPress={() => void save()} />
      </> : null}
      {state === 'invalid' ? <>
        <SupportText tone="critical">{t('auth.linkExpired')}</SupportText>
        <Button variant="secondary" label={t('auth.requestNew')} onPress={() => router.replace('/forgot-password')} />
      </> : null}
    </Card>
  </Screen>;
}
