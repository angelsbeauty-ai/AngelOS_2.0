import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ContactAvatar } from '../../../src/components/BrandBadge';
import { Screen } from '../../../src/components/Screen';
import { ErrorState } from '../../../src/components/ErrorState';
import { Skeleton } from '../../../src/components/ui';
import { dialog } from '../../../src/lib/dialog';
import { toFriendly, friendlyText } from '../../../src/lib/friendly-error';
import { getMessageThread, PLATFORM_OPEN_URL, updateThread, type MessageThreadDetail } from '../../../src/lib/messaging';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import { useAppearance } from '../../../src/design/appearance';
import { chat, tokens } from '../../../src/design/theme';

/** M15 Contact info: who this is, where they write from, and the per-chat settings. Real data only. */
export default function ContactInfoScreen() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ws, setWs] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageThreadDetail | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try { const w = (await getActiveWorkspace()).id; setWs(w); setDetail(await getMessageThread(w, id!)); setFailed(false); }
    catch { setFailed(true); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function set(patch: { pinned?: boolean; muted?: boolean; deleted?: boolean }) {
    if (!ws || !detail) return;
    const before = detail;
    setDetail({ ...detail, thread: { ...detail.thread, ...patch } as any });
    try { await updateThread(ws, detail.thread.id, patch); if (patch.deleted) router.replace('/messages' as any); }
    catch (e) { setDetail(before); const f = friendlyText(e, { action: 'save' }); void dialog.notify(f.title, f.message); }
  }

  if (failed) return <Screen><ErrorState title={t('messages.openFail')} message={t('messages.commentsFailMsg')} onRetry={() => void load()} /></Screen>;
  if (!detail) return <Screen><Stack.Screen options={{ title: t('messages.contactInfo') }} /><Skeleton rows={4} /></Screen>;

  const th = detail.thread;
  const name = th.client?.display_name ?? th.contact_display_name ?? t('messages.unknown');
  const photos = Object.entries(detail.attachments ?? {});
  const firstAt = detail.messages[0]?.created_at;
  const openUrl = PLATFORM_OPEN_URL[th.platform] ?? '';
  const rowBg = night ? chat.night.card : chat.day.card;
  const sep = night ? chat.night.hair : chat.day.hair;
  const muted = palette.muted;
  const Row = ({ label, value, onPress, right }: { label: string; value?: string | null; onPress?: () => void; right?: React.ReactNode }) => (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={[styles.row, { borderBottomColor: sep }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      {right ?? <Text numberOfLines={1} style={[styles.value, { color: muted }]}>{value ?? t('common.unavailable', { defaultValue: 'Unavailable' })}</Text>}
    </Pressable>
  );

  return <Screen>
    <Stack.Screen options={{ title: t('messages.contactInfo') }} />
    <View style={styles.head}>
      <ContactAvatar name={name} uri={th.contact_avatar_url ?? null} platform={th.platform} size={88} />
      <Text accessibilityRole="header" style={[styles.name, { color: palette.text }]}>{name}</Text>
      <Text style={[styles.sub, { color: muted }]}>{th.platform_label}</Text>
    </View>

    <View style={[styles.group, { backgroundColor: rowBg }]}>
      <Row label={t('messages.client')} value={th.client ? th.client.display_name : t('messages.notLinked')} onPress={th.client ? () => router.push(`/clients/${th.client!.id}` as any) : undefined} />
      <Row label={t('messages.language')} value={th.reply_language === 'ja' ? '日本語' : 'English'} />
      <Row label={t('messages.firstMessage')} value={firstAt ? new Date(firstAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
      <Row label={t('messages.messageCount')} value={String(detail.messages.filter((m) => m.status !== 'cancelled').length)} />
      {openUrl ? <Row label={t('messages.openIn', { app: th.platform_label })} value="" onPress={() => void Linking.openURL(openUrl)} /> : null}
    </View>

    <View style={[styles.group, { backgroundColor: rowBg }]}>
      <Row label={t('messages.pin')} right={<Switch accessibilityLabel={t('messages.pin')} value={Boolean(th.pinned)} onValueChange={(v) => void set({ pinned: v })} />} />
      <Row label={t('messages.mute')} right={<Switch accessibilityLabel={t('messages.mute')} value={Boolean(th.muted)} onValueChange={(v) => void set({ muted: v })} />} />
    </View>

    {photos.length ? <>
      <Text style={[styles.section, { color: muted }]}>{t('messages.sharedPhotos')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {photos.map(([mid, uri]) => <Image key={mid} accessibilityLabel={t('messages.photo')} source={{ uri }} style={styles.photo} />)}
      </ScrollView>
    </> : null}

    <View style={[styles.group, { backgroundColor: rowBg }]}>
      <Pressable accessibilityRole="button" onPress={async () => { if (await dialog.confirm({ title: t('messages.deleteChat'), message: t('messages.deleteMsg'), confirmText: t('messages.deleteChat') })) void set({ deleted: true }); }} style={[styles.row, { borderBottomWidth: 0 }]}>
        <Text style={[styles.label, { color: palette.text, fontFamily: tokens.font.uiSemibold }]}>{t('messages.deleteChat')}</Text>
      </Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  name: { ...tokens.type.title2, textAlign: 'center' },
  sub: { ...tokens.type.subhead },
  group: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { ...tokens.type.body, flexShrink: 0 },
  value: { ...tokens.type.body, flexShrink: 1, textAlign: 'right' },
  section: { ...tokens.type.footnote, marginHorizontal: 32, marginBottom: 6, textTransform: 'uppercase' },
  photos: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  photo: { width: 96, height: 96, borderRadius: 10 }
});
