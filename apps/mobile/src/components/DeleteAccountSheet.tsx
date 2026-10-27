import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Button } from './ui';
import { dialog } from '../lib/dialog';
import { clearMe, deleteMe } from '../lib/me';
import { supabase } from '../lib/supabase';
import { D, N, tokens } from '../design/theme';
import { useAppearance } from '../design/appearance';

/**
 * Delete account (Apple 5.1.1, rereview F21). Typing DELETE and tapping Delete account calls DELETE /me,
 * which removes her own studios (by cascade) and the login. Then she is signed out.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void; workspaceId?: string | null; email?: string | null }) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const ok = text.trim() === 'DELETE';

  async function send() {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await deleteMe();
      setText(''); setSent(true);
    } catch (e) { await dialog.notify(t('pf.delFail'), t('pf.delFailBody')); }
    finally { setBusy(false); }
  }

  async function finish() {
    setSent(false); onClose(); clearMe();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    router.replace('/login');
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: night ? N.card : D.surface }]}>
      {sent ? <>
        <View style={[styles.warn, { backgroundColor: night ? N.field : D.fill }]}><CheckCircle size={30} color={palette.text} weight="duotone" /></View>
        <Text style={[styles.title, { color: palette.text }]}>{t('pf.delSent')}</Text>
        <Text style={[styles.body, { color: palette.text }]}>{t('pf.delSentMsg')}</Text>
                <Text style={[styles.body, { color: palette.text, fontFamily: tokens.font.uiSemibold }]}>{t('pf.delSentSub')}</Text>
        <Button label={t('pf.delDone')} onPress={() => void finish()} />
      </> : <>
      <Text style={[styles.title, { color: palette.text }]}>{t('pf.delTitle')}</Text>
      <Text style={[styles.body, { color: palette.text }]}>{t('pf.delBody')}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>{t('pf.delType')}</Text>
      <TextInput value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={palette.muted} style={[styles.input, night && { backgroundColor: N.field, borderColor: N.fieldBorder, color: palette.text }]} accessibilityLabel={t('pf.delType')} />
      <Button label={t('pf.delKeep')} onPress={() => { setText(''); onClose(); }} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ok || busy }} disabled={!ok || busy} onPress={() => void send()} style={[styles.danger, night && styles.dangerFilled, (!ok || busy) && { opacity: 0.4 }]}><Text style={[styles.dangerText, night && { color: tokens.color.onCharcoal }]}>{busy ? t('pf.delBusy') : t('pf.delGo')}</Text></Pressable>
      </>}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { gap: 12, padding: 22, paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFFFF' },
  warn: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,67,44,0.12)' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30 },
  body: { ...tokens.type.subhead, fontFamily: tokens.font.ui },
  label: { ...tokens.type.footnote, fontFamily: tokens.font.uiSemibold, marginTop: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(42,39,37,0.15)', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 16, color: '#151515' },
  danger: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // Night: filled red pill, white text (6.54:1); red text on the dark sheet would be under 3:1.
  dangerFilled: { backgroundColor: tokens.color.error, borderRadius: 22 },
  dangerText: { ...tokens.type.subhead, fontFamily: tokens.font.uiBold, color: tokens.color.error }
});
