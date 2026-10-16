import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { List } from 'phosphor-react-native/src/icons/List';
import { GlassSurface } from './Glass';
import { colors, D } from '../design/theme';
import { CalendarPlus } from 'phosphor-react-native/src/icons/CalendarPlus';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { ImageSquare } from 'phosphor-react-native/src/icons/ImageSquare';
import { PlusCircle } from 'phosphor-react-native/src/icons/PlusCircle';

type MenuItem = Item & { Icon: typeof Plus };
/** final-D2 Home + menu: small white card anchored under the + button. Tapping outside closes it. */
function CreateMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.menuScrim} onPress={onClose} accessibilityLabel="Close">
      <Pressable style={styles.menu} onPress={() => {}}>
        {items.map(({ label, href, Icon }, i) => <Pressable key={href} accessibilityRole="button" style={[styles.menuRow, i > 0 && styles.menuLine]} onPress={() => { onClose(); router.push(href as any); }}>
          <Icon size={20} color={D.text} /><Text style={styles.menuText}>{label}</Text></Pressable>)}
      </Pressable>
    </Pressable>
  </Modal>;
}

type Item = { label: string; href: string };

function Sheet({ title, items, onClose }: { title: string; items: Item[]; onClose: () => void }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close">
      <Pressable style={styles.sheet} onPress={() => {}}>
        <GlassSurface kind="toast" style={StyleSheet.absoluteFill} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {items.map((i) => <Pressable key={i.href} accessibilityRole="button" style={styles.row} onPress={() => { onClose(); router.push(i.href as any); }}><Text style={styles.rowText}>{i.label}</Text></Pressable>)}
      </Pressable>
    </Pressable>
  </Modal>;
}

/** Instagram-style top bar on the main tab screens: + (create) left, heart (notifications) and ☰ (quick settings) right. */
export function TopBar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<null | 'create' | 'menu'>(null);
  const ink = colors.light.primaryText as string;
  const startY = useRef<number | null>(null);
  const pathname = usePathname();
  // Home only: a deliberate swipe down on the top bar opens voice. Pull-to-refresh on the list below is untouched.
  const swipe = pathname === '/' ? { onTouchStart: (e: any) => { startY.current = e.nativeEvent.pageY; }, onTouchEnd: (e: any) => { const s = startY.current; startY.current = null; if (s != null && e.nativeEvent.pageY - s > 70) router.push('/voice' as any); } } : {};
  return <View style={styles.bar} {...swipe}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('top.create', { defaultValue: 'Create' })} hitSlop={8} style={styles.plusRing} onPress={() => setOpen('create')}><View style={styles.plus}><Plus size={22} color="#FFFFFF" weight="bold" /></View></Pressable>
    <View style={styles.right}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.notifications', { defaultValue: 'Notifications' })} hitSlop={8} style={styles.btn} onPress={() => router.push('/notifications' as any)}><Heart size={22} color={ink} weight="regular" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.menu', { defaultValue: 'Menu' })} hitSlop={8} style={styles.btn} onPress={() => setOpen('menu')}><List size={22} color={ink} weight="bold" /></Pressable>
    </View>
    {open === 'create' ? <CreateMenu onClose={() => setOpen(null)} items={[
      { label: t('top.newBooking', { defaultValue: 'New booking' }), href: '/bookings/new', Icon: CalendarPlus },
      { label: t('top.newMessage', { defaultValue: 'New message' }), href: '/messages/new', Icon: ChatCircle },
      { label: t('top.newPost', { defaultValue: 'New post' }), href: '/content/new', Icon: ImageSquare },
      { label: t('top.newStory', { defaultValue: 'New story' }), href: '/content/new?format=story', Icon: PlusCircle },
    ]} /> : null}
    {open === 'menu' ? <Sheet title={t('top.quick', { defaultValue: 'Quick settings' })} onClose={() => setOpen(null)} items={[
      { label: t('nav3.accounts'), href: '/social/accounts' },
      { label: t('nav.assistant'), href: '/ai-settings' },
      { label: t('nav.money'), href: '/finance' },
      { label: t('account.language'), href: '/settings/account' },
      { label: t('top.profileSettings', { defaultValue: 'Profile & settings' }), href: '/settings' },
    ]} /> : null}
  </View>;
}

const glassBtn = { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'transparent' };
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  right: { flexDirection: 'row', gap: 10 },
  btn: glassBtn,
  plusRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: D.accent, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: D.text, alignItems: 'center', justifyContent: 'center' },
  menuScrim: { flex: 1, alignItems: 'flex-start', paddingTop: 64, paddingLeft: 16 },
  menu: { width: 220, borderRadius: 22, backgroundColor: D.surface, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline, shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  menuRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  menuLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: D.hairline },
  menuText: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: D.text },
  scrim: { flex: 1, backgroundColor: 'rgba(42,39,37,0.25)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 70, paddingHorizontal: 16 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 24, overflow: 'hidden', paddingVertical: 10, backgroundColor: D.surface },
  sheetTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: colors.light.secondaryText as string, paddingHorizontal: 20, paddingVertical: 8 },
  row: { paddingHorizontal: 20, paddingVertical: 14 },
  rowText: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: colors.light.primaryText as string },
});
