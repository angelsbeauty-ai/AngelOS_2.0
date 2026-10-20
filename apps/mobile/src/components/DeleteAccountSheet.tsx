import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Button } from './ui';
import { dialog } from '../lib/dialog';
import { clearMe, deleteMe } from '../lib/me';
import { supabase } from '../lib/supabase';
import { tokens } from '../design/theme';

/**
 * Delete account (Apple 5.1.1, rereview F21). Typing DELETE and tapping Delete account calls DELETE /me,
 * which removes her own studios (by cascade) and the login. Then she is signed out.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void; workspaceId?: string | null; email?: string | null }) {
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
    <View style={styles.backdrop}><View style={styles.sheet}>
      {sent ? <>
        <View style={[styles.warn, { backgroundColor: 'rgba(0,0,0,0.12)' }]}><CheckCircle size={30} color="#000000" weight="duotone" /></View>
        <Text style={styles.title}>{t('pf.delSent')}</Text>
        <Text style={styles.body}>{t('pf.delSentMsg')}</Text>
                <Text style={[styles.body, { fontFamily: tokens.font.uiSemibold }]}>{t('pf.delSentSub')}</Text>
        <Button label={t('pf.delDone')} onPress={() => void finish()} />
      </> : <>
      <Text style={styles.title}>{t('pf.delTitle')}</Text>
      <Text style={styles.body}>{t('pf.delBody')}</Text>
      <Text style={styles.label}>{t('pf.delType')}</Text>
      <TextInput value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor="#8E8E8E" style={styles.input} accessibilityLabel={t('pf.delType')} />
      <Button label={t('pf.delKeep')} onPress={() => { setText(''); onClose(); }} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ok || busy }} disabled={!ok || busy} onPress={() => void send()} style={[styles.danger, (!ok || busy) && { opacity: 0.4 }]}><Text style={styles.dangerText}>{busy ? t('pf.delBusy') : t('pf.delGo')}</Text></Pressable>
      </>}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { gap: 12, padding: 22, paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFFFF' },
  warn: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,67,44,0.12)' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 24, color: '#151515' },
  body: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 22, color: '#3A3632' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#6C6C70', marginTop: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(42,39,37,0.15)', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 16, color: '#151515' },
  danger: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: tokens.font.uiBold, fontSize: 15, color: '#B3261E' }
});
