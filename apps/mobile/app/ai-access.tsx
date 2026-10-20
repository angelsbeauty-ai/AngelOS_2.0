import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { User } from 'phosphor-react-native/src/icons/User';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Image as ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Money } from 'phosphor-react-native/src/icons/Money';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';
import { ErrorState } from '../src/components/ErrorState';
import { Skeleton } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { getDataAccess, setDataAccess, type DataArea } from '../src/lib/ai';
import { getActiveWorkspace } from '../src/lib/workspace';
import { toFriendly } from '../src/lib/friendly-error';

const ROWS: Array<[DataArea, ComponentType<any>, string, string]> = [
  ['bookings', CalendarBlank, 'Bookings & calendar', 'Days off, hours'],
  ['clients', User, 'Clients', 'Notes, treatments, forms'],
  ['messages', ChatCircle, 'Messages', 'LINE, Instagram, Messenger, comments'],
  ['posts', ImageIcon, 'Posts & media', 'Drafts, scheduled, library'],
  ['analytics', ListBullets, 'Analytics', 'Reach, followers, by platform'],
  ['money', Money, 'Money', 'Paid, owed, expenses'],
  ['services', Star, 'Services & prices', ''],
  ['campaigns', Flag, 'Campaigns & tasks', '']
];

/** X01: What AngelOS can see. Read switches for text and voice; only this studio's data. */
export default function AiAccessScreen() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [ws, setWs] = useState<string | null>(null);
  const [on, setOn] = useState<Record<string, boolean> | null>(null);
  const [err, setErr] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const w = await getActiveWorkspace(); setWs(w.id);
      const r = await getDataAccess(w.id);
      setOn(Object.fromEntries(r.areas.map((a) => [a.area, a.enabled]))); setErr(null);
    } catch (e) { const f = toFriendly(e, { action: 'load' }); setErr({ title: f.title, message: f.message }); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggle(area: DataArea, value: boolean) {
    if (!ws || !on) return;
    const before = on; setOn({ ...on, [area]: value });
    try { await setDataAccess(ws, area, value); }
    catch (e) { setOn(before); const f = toFriendly(e, { action: 'save' }); toast.show({ tone: 'error', title: f.title, message: e instanceof Error ? e.message : f.message }); }
  }

  const card = night ? '#161618' : '#FFFFFF';
  return <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.head}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')} onPress={() => router.back()} style={styles.hit}><CaretLeft size={24} color={palette.text} /></Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{t('aiAccess.title', 'What AngelOS can see')}</Text>
      <View style={styles.hit} />
    </View>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={[styles.intro, { color: palette.muted }]}>{t('aiAccess.intro', "AngelOS reads these to answer you in chat and voice. Only your studio's data. Never other accounts.")}</Text>
      {err ? <ErrorState title={err.title} message={err.message} onRetry={() => void load()} /> : !on ? <Skeleton rows={4} height={56} /> :
        <View style={[styles.card, { backgroundColor: card, borderColor: palette.border }]}>
          {ROWS.map(([area, Icon, title, sub], i) => <View key={area} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
            <Icon size={20} color={palette.text} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{t(`aiAccess.${area}`, title)}</Text>
              {sub ? <Text style={[styles.rowSub, { color: palette.muted }]}>{t(`aiAccess.${area}Sub`, sub)}</Text> : null}
            </View>
            <Switch accessibilityLabel={t(`aiAccess.${area}`, title)} value={on[area] !== false} onValueChange={(v) => void toggle(area, v)}
              trackColor={{ false: night ? '#3A3A3D' : '#D1D1D6', true: night ? '#F4F4F5' : '#151515' }} thumbColor={night ? '#151515' : '#FFFFFF'} ios_backgroundColor={night ? '#3A3A3D' : '#D1D1D6'} />
          </View>)}
        </View>}
      <View style={[styles.card, styles.lock, { backgroundColor: card, borderColor: palette.border }]}>
        <LockSimple size={14} color={palette.text} />
        <Text style={[styles.rowSub, { color: palette.text, flex: 1 }]}><Text style={{ fontFamily: tokens.font.uiBold }}>{t('aiAccess.never', 'It never sends or posts on its own.')}</Text> {t('aiAccess.approve', 'Replies, posts and changes always wait for you to tap Approve.')}</Text>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  head: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  intro: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
  rowTitle: { fontFamily: tokens.font.uiMedium, fontSize: 17 },
  rowSub: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20 },
  lock: { flexDirection: 'row', gap: 10, padding: 16, alignItems: 'flex-start' }
});
