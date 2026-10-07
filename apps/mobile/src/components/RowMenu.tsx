import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { tokens } from '../design/theme';

type RowAction = { id: string; title: string; later?: boolean; destructive?: boolean };
type Props = PropsWithChildren<{ actions: RowAction[]; onAction: (id: string) => void; onPress: () => void; accessibilityHint?: string }>;

export function RowMenu({ children, actions, onAction, onPress, accessibilityHint }: Props) {
  const [open, setOpen] = useState(false);
  function showMenu() {
    if (Platform.OS === 'ios') {
      const enabled = actions.filter((action) => !action.later);
      const later = actions.filter((action) => action.later);
      const options = [...enabled.map((action) => action.title), ...later.map((action) => `${action.title} ﾂｷ later`), 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: enabled.findIndex((action) => action.destructive) }, (index) => {
        if (index < enabled.length) onAction(enabled[index].id);
      });
    } else setOpen(true);
  }
  return <>
    <Pressable accessibilityHint={accessibilityHint} onPress={onPress} onLongPress={showMenu} delayLongPress={350}>{children}</Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}><View style={styles.sheet}>{actions.map((action) => <Pressable key={action.id} disabled={action.later} onPress={() => { setOpen(false); onAction(action.id); }} style={styles.item}><Text style={[styles.itemText, action.later && styles.disabled, action.destructive && styles.destructive]}>{action.title}{action.later ? ' ﾂｷ later' : ''}</Text></Pressable>)}<Pressable onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.itemText}>Cancel</Text></Pressable></View></Pressable>
    </Modal>
  </>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' }, sheet: { padding: 16, gap: 8, backgroundColor: tokens.color.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, backgroundColor: tokens.color.ivorySolid }, cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center' }, itemText: { color: tokens.color.charcoal, fontFamily: tokens.font.uiMedium, fontSize: 16 }, disabled: { color: tokens.color.charcoal3 }, destructive: { color: tokens.color.error } });
void router;

