import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'phosphor-react-native/src/icons/X';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useReducedMotion } from 'react-native-reanimated';
import { ErrorState } from './ErrorState';
import { EmptyState, Skeleton } from './ui';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import { listConversations, type AiConversationSummary } from '../lib/ai';

/** Past assistant chats, kept on the server. Tap one to reopen it. */
export function ChatHistorySheet({ visible, workspaceId, currentId, onClose, onPick }: { visible: boolean; workspaceId: string; currentId: string | null; onClose: () => void; onPick: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const { palette, mode } = useAppearance();
  const rose = mode === 'night' ? tokens.color.roseGoldNight : tokens.color.roseGold;
  const reduceMotion = useReducedMotion();
  const [rows, setRows] = useState<AiConversationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => { setFailed(false); setRows(null); listConversations(workspaceId).then(setRows).catch(() => setFailed(true)); };
  useEffect(() => { if (visible) load(); }, [visible, workspaceId]);
  const when = (iso: string) => { try { return new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }); } catch { return ''; } };
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
    <View style={[styles.page, { backgroundColor: palette.bg }]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{t('aip.pastChats', 'Past chats')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('voice.close', 'Close')} onPress={onClose} style={styles.btn}><X size={22} color={palette.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {failed ? <ErrorState title={t('aip.historyErrorTitle', 'Past chats did not load')} message={t('aip.historyError', 'Check your connection and try again.')} onRetry={load} />
          : rows === null ? <Skeleton rows={4} height={56} />
          : rows.length === 0 ? <EmptyState title={t('aip.historyEmptyTitle', 'No past chats yet')} message={t('aip.historyEmpty', 'Your chats with AngelOS will show here.')} />
          : rows.map((r) => <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: r.id === currentId }} onPress={() => onPick(r.id)} style={[styles.row, { backgroundColor: palette.glass, borderColor: r.id === currentId ? rose : palette.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: palette.muted }]}>{when(r.updatedAt)}</Text>
            </View>
            <CaretRight size={18} color={palette.muted} />
          </Pressable>)}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, minHeight: 60 },
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 20 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 13 }
});
