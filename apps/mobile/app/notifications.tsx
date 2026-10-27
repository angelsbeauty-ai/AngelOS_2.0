import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ImageSquare } from 'phosphor-react-native/src/icons/ImageSquare';
import { BellSimple } from 'phosphor-react-native/src/icons/BellSimple';
import { Screen } from '../src/components/Screen';
import { Button, EmptyState, ScreenTitle, Skeleton, SupportText } from '../src/components/ui';
import { ErrorState } from '../src/components/ErrorState';
import { useAppearance } from '../src/design/appearance';
import { tokens } from '../src/design/theme';
import { getActiveWorkspace } from '../src/lib/workspace';
import { getActivity, getNotificationPrefs, updateNotificationPrefs, type ActivityItem } from '../src/lib/system-health';
import { registerForPush } from '../src/lib/push';
import { toFriendly } from '../src/lib/friendly-error';
import { dialog } from '../src/lib/dialog';

type Prefs = { messages: boolean; bookings: boolean; ai: boolean };
const DEFAULT: Prefs = { messages: true, bookings: true, ai: true };
const PLAT: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', manual: 'LINE' };
type Perm = 'granted' | 'denied' | 'undetermined' | 'web';

/** O05 (h06/N09): Activity list first, then the alert switches, with the push permission asked in context. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { palette, mode } = useAppearance();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState<{ title: string; message: string } | null>(null);
  const [perm, setPerm] = useState<Perm>(Platform.OS === 'web' ? 'web' : 'undetermined');

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id;
      setWorkspaceId(ws);
      const [next, act] = await Promise.all([getNotificationPrefs(ws).catch(() => null), getActivity(ws)]);
      if (next) setPrefs({ messages: next.messages, bookings: next.bookings, ai: next.ai });
      setItems(act.filter((it) => it.kind !== 'booking')); setState('ready'); // AngelOS V1: bookings are hidden
    } catch (error) { const f = toFriendly(error, { action: 'load' }); setErr({ title: f.title, message: f.message }); setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { if (Platform.OS !== 'web') void Notifications.getPermissionsAsync().then((p) => setPerm(p.status as Perm)).catch(() => undefined); }, []);

  async function allow() {
    if (!workspaceId) return;
    if (perm === 'denied') { void Linking.openSettings(); return; }
    const r = await registerForPush(workspaceId);
    setPerm(r === 'saved' ? 'granted' : r === 'denied' ? 'denied' : perm);
  }

  async function toggle(key: keyof Prefs) {
    if (!workspaceId) return;
    const prev = prefs; const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { await updateNotificationPrefs(workspaceId, { [key]: next[key] }); }
    catch (error) { setPrefs(prev); const f = toFriendly(error, { action: 'save' }); void dialog.notify(f.title, f.message); }
  }

  const loc = i18n.language === 'ja' ? 'ja-JP' : 'en-GB';
  const fmt = (iso: string) => {
    const d = new Date(iso); const today = new Date();
    const same = d.toDateString() === today.toDateString();
    return new Intl.DateTimeFormat(loc, same ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' }).format(d);
  };
  const ink = { size: 22, color: palette.icon };
  const line = (it: ActivityItem) => it.kind === 'message' ? { icon: <ChatCircle {...ink} />, title: it.title || t('nt.client'), detail: it.detail || t('nt.photo') }
    : it.kind === 'booking' ? { icon: <CalendarBlank {...ink} />, title: it.status === 'cancelled' ? t('nt.bookingCancelled', { name: it.title }) : t('nt.booking', { name: it.title }), detail: it.detail }
    : { icon: <ImageSquare {...ink} />, title: it.status === 'failed' ? t('nt.postFailed') : t('nt.postPosted'), detail: PLAT[it.title] ?? '' };
  const open = (it: ActivityItem) => router.push((it.kind === 'message' ? `/messages/${it.target}` : it.kind === 'booking' ? `/bookings/${it.target}` : '/content') as any);
  const card = { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss };

  return <Screen onRefresh={load}>
    <ScreenTitle>{t('pf.notifications')}</ScreenTitle>
    {perm !== 'granted' && perm !== 'web' ? <View style={[styles.card, card]}>
      <Text style={[styles.label, { color: palette.text }]}>{t('nt.permTitle')}</Text>
      <SupportText>{perm === 'denied' ? t('nt.permDenied') : t('nt.permBody')}</SupportText>
      <Button small label={perm === 'denied' ? t('nt.openSettings') : t('nt.allow')} onPress={() => void allow()} />
    </View> : null}

    <Text style={[styles.section, { color: palette.muted }]}>{t('nt.activity')}</Text>
    {state === 'loading' ? <Skeleton rows={4} height={64} />
      : state === 'error' && err ? <ErrorState title={err.title} message={err.message} onRetry={() => { setState('loading'); void load(); }} />
      : !items.length ? <EmptyState icon={<BellSimple size={28} color={palette.muted} />} title={t('nt.emptyTitle')} message={t('nt.emptyBody')} />
      : <View style={[styles.list, card]}>{items.map((it, i) => { const l = line(it); return <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={`${l.title}, ${l.detail}, ${fmt(it.at)}`} onPress={() => open(it)} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
          <View style={styles.icon}>{l.icon}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={[styles.label, { color: palette.text }]}>{l.title}</Text>
            {l.detail ? <Text numberOfLines={2} style={[styles.detail, { color: mode === 'night' ? '#C7C7CC' : palette.muted }]}>{l.detail}</Text> : null}
          </View>
          <Text style={[styles.time, { color: palette.muted }]}>{fmt(it.at)}</Text>
        </Pressable>; })}</View>}

    <Text style={[styles.section, { color: palette.muted }]}>{t('nt.alerts')}</Text>
    <View style={[styles.list, card]}>{(['messages', 'bookings', 'ai'] as const).map((key, i) => (
      <View key={key} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.label, { color: palette.text }]}>{t(`nt.${key}`)}</Text>
          <SupportText>{t(`nt.${key}Sub`)}</SupportText>
        </View>
        <Switch accessibilityLabel={t(`nt.${key}`)} value={prefs[key]} onValueChange={() => void toggle(key)} />
      </View>
    ))}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  list: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  section: { fontFamily: tokens.font.uiSemibold, fontSize: 13, marginTop: 8, marginLeft: 4, textTransform: 'uppercase' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16 },
  icon: { width: 32, alignItems: 'center' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  detail: { fontFamily: tokens.font.ui, fontSize: 14 },
  time: { fontFamily: tokens.font.ui, fontSize: 13, fontVariant: ['tabular-nums'] }
});
