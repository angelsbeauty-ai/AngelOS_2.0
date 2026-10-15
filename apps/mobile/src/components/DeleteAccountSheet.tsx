import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { Button } from './ui';
import { dialog } from '../lib/dialog';
import { submitBetaFeedback } from '../lib/beta';
import { tokens } from '../design/theme';

/**
 * P4 delete-account check. Non-destructive by design: it sends a deletion REQUEST through the existing
 * feedback endpoint (category 'support'); nothing is deleted from the app. The team confirms by email first.
 */
export function DeleteAccountSheet({ visible, onClose, workspaceId, email }: { visible: boolean; onClose: () => void; workspaceId: string | null; email: string | null }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = text.trim() === 'DELETE';

  async function send() {
    if (!ok) return;
    if (!workspaceId) { onClose(); await dialog.notify(t('pf.delTitle'), t('pf.delNoStudio')); router.push('/help'); return; }
    setBusy(true);
    try {
      await submitBetaFeedback(workspaceId, { category: 'support', message: `Account deletion request from ${email ?? 'this account'} (typed DELETE in the app). Please confirm by email before removing anything.`, permissionToContact: true });
      onClose(); setText('');
      await dialog.notify(t('pf.delSent'), t('pf.delSentMsg'));
    } catch (e) { await dialog.notify(t('pf.delFail'), e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.warn}><Warning size={30} color="#A8432C" weight="duotone" /></View>
      <Text style={styles.title}>{t('pf.delTitle')}</Text>
      <Text style={styles.body}>{t('pf.delBody')}</Text>
      <Text style={styles.label}>{t('pf.delType')}</Text>
      <TextInput value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor="#A69C94" style={styles.input} accessibilityLabel={t('pf.delType')} />
      <Button label={t('pf.delKeep')} onPress={() => { setText(''); onClose(); }} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ok || busy }} disabled={!ok || busy} onPress={() => void send()} style={[styles.danger, (!ok || busy) && { opacity: 0.4 }]}><Text style={styles.dangerText}>{t('pf.delGo')}</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { gap: 12, padding: 22, paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#F5F2EE' },
  warn: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,67,44,0.12)' },
  title: { fontFamily: tokens.font.display, fontSize: 28, color: '#2A2725', textAlign: 'center' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#625B56', textAlign: 'center' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#625B56', marginTop: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(42,39,37,0.15)', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 16, color: '#2A2725' },
  danger: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: tokens.font.uiBold, fontSize: 15, color: '#A8432C' }
});
