import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Card, EmptyState, Skeleton } from '../src/components/ui';
import { getActiveWorkspace } from '../src/lib/workspace';
import { listMessageThreads, timeLabel, type MessageThreadSummary } from '../src/lib/messaging';
import { colors } from '../src/design/theme';

/** Notifications: real data only. Today the API exposes new/unanswered messages; likes, comments and mentions appear once that feed exists. */
export default function Notifications() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MessageThreadSummary[] | null>(null);
  const load = useCallback(async () => {
    try { const ws = await getActiveWorkspace(); const all = await listMessageThreads(ws.id); setItems(all.filter((x) => x.unread || x.needs_reply)); }
    catch { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Screen onRefresh={load}>
    {items === null ? <Skeleton /> : items.length === 0
      ? <EmptyState title={t('notif.empty', { defaultValue: 'No notifications yet' })} message={t('notif.emptyMsg', { defaultValue: 'New messages, likes, comments and mentions will show up here.' })} />
      : <Card>{items.map((x) => <Pressable key={x.id} accessibilityRole="button" style={styles.row} onPress={() => router.push(`/messages/${x.id}` as any)}>
          <View style={{ flex: 1 }}><Text style={styles.name}>{t('notif.newMessage', { defaultValue: 'New message from {{name}}', name: x.contact_display_name ?? '' })}</Text>
          <Text style={styles.sub} numberOfLines={1}>{[x.platform_label, x.last_preview].filter(Boolean).join(' · ')}</Text></View>
          <Text style={styles.sub}>{timeLabel(x.last_message_at)}</Text>
        </Pressable>)}</Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  name: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.light.primaryText as string },
  sub: { fontSize: 13, color: colors.light.secondaryText as string },
});
