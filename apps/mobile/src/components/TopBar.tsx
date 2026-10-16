import { Waveform } from 'phosphor-react-native/src/icons/Waveform';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { List } from 'phosphor-react-native/src/icons/List';
import { GlassSurface } from './Glass';
import { colors } from '../design/theme';

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
    <Pressable accessibilityRole="button" accessibilityLabel={t('top.create', { defaultValue: 'Create' })} hitSlop={8} style={styles.btn} onPress={() => setOpen('create')}><Plus size={22} color={ink} weight="bold" /></Pressable>
    <View style={styles.right}>
      {pathname === '/' ? <Pressable accessibilityRole="button" accessibilityLabel={t('home.voice', { defaultValue: 'Talk to your assistant' })} hitSlop={8} style={styles.btn} onPress={() => router.push('/voice' as any)}><Waveform size={22} color={ink} weight="bold" /></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.notifications', { defaultValue: 'Notifications' })} hitSlop={8} style={styles.btn} onPress={() => router.push('/notifications' as any)}><Heart size={22} color={ink} weight="regular" /></Pressable>
      {pathname !== '/' ? <Pressable accessibilityRole="button" accessibilityLabel={t('top.menu', { defaultValue: 'Menu' })} hitSlop={8} style={styles.btn} onPress={() => setOpen('menu')}><List size={22} color={ink} weight="bold" /></Pressable> : null}
    </View>
    {open === 'create' ? <Sheet title={t('top.create', { defaultValue: 'Create' })} onClose={() => setOpen(null)} items={[
      { label: t('top.newMessage', { defaultValue: 'New message' }), href: '/messages/new' },
      { label: t('top.newBooking', { defaultValue: 'New booking' }), href: '/bookings/new' },
      { label: t('top.newPost', { defaultValue: 'New post' }), href: '/content/new' },
      { label: t('top.newStory', { defaultValue: 'New story' }), href: '/content/new?format=story' },
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

const glassBtn = { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' };
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  right: { flexDirection: 'row', gap: 10 },
  btn: glassBtn,
  scrim: { flex: 1, backgroundColor: 'rgba(42,39,37,0.25)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 70, paddingHorizontal: 16 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 24, overflow: 'hidden', paddingVertical: 10, backgroundColor: 'rgba(250,247,243,0.92)' },
  sheetTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: colors.light.secondaryText as string, paddingHorizontal: 20, paddingVertical: 8 },
  row: { paddingHorizontal: 20, paddingVertical: 14 },
  rowText: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: colors.light.primaryText as string },
});
