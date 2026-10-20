import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import { ActionButton } from './MessagingBits';

/** Tools sheet so the chat stays clean. AI draft, notes and paste live here. */
export function ChatTools({
  visible, onClose, night, children
}: {
  visible: boolean;
  onClose: () => void;
  night: boolean;
  children: React.ReactNode;
}) {
  const { palette } = useAppearance();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <Pressable style={[styles.sheet, night && { backgroundColor: '#161618' }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, night && { backgroundColor: palette.border }]} />
          <ScrollView style={styles.body} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF', paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 8 },
  body: { paddingHorizontal: 16 }
});
