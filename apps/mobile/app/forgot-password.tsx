import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '../src/components/Screen';
import { Card, PrimaryActionLabel, ScreenTitle, SupportText, ui } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { toFriendly } from '../src/lib/friendly-error';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function send() {
    setError('');
    const redirectTo = Platform.OS === 'web'
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`
      : Linking.createURL('reset-password');
    
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (authError) {
      const friendly = toFriendly(authError, { action: 'signin' });
      setError(`${friendly.title}: ${friendly.message}`);
      return;
    }
    setMessage("If there's an account for that email, we've sent a link. Open it on this device.");
  }

  return <Screen><ScreenTitle>Forgot password?</ScreenTitle><SupportText>We'll help you get back into AngelOS.</SupportText><Card><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" style={styles.input} /><Pressable disabled={!email.trim()} onPress={() => void send()}><PrimaryActionLabel>Send reset link</PrimaryActionLabel></Pressable>{message ? <SupportText>{message}</SupportText> : null}{error ? <SupportText>{error}</SupportText> : null}</Card><Link href="/login">Back to sign in</Link></Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, padding: ui.spacing.sm, color: ui.colors.primaryText, marginBottom: ui.spacing.sm }
});
