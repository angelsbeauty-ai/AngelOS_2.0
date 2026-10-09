import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, EmptyState, ScreenTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Avatar, Banner, Chip, PlatformBadge, UnreadDot } from '../../src/components/MessagingBits';
import { toFriendly } from '../../src/lib/friendly-error';
import { listConnections, listMessageThreads, timeLabel, type ConnectionStatus, type MessageThreadSummary } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

type Filter = 'all' | 'unread' | 'needs_reply' | 'done' | 'archived';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }, { key: 'needs_reply', label: 'Needs reply' }, { key: 'done', label: 'Done' }, { key: 'archived', label: 'Archived' }
];

export default function MessagesScreen() {
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState({ title: '', message: '' });

  const load = useCallback(async (nextFilter: Filter = filter) => {
    try {
      const workspace = await getActiveWorkspace();
      const [rows, conn] = await Promise.all([
        listMessageThreads(workspace.id, nextFilter === 'archived' ? 'archived' : 'active'),
        listConnections(workspace.id).catch(() => [] as ConnectionStatus[])
      ]);
      setThreads(rows); setConnections(conn); setState('ready');
    } catch (error) {
      const friendly = toFriendly(error, { action: 'load', thing: 'messages' });
      setErrorText({ title: friendly.title, message: friendly.message }); setState('error');
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => threads.filter((thread) => {
    if (filter === 'unread') return thread.unread;
    if (filter === 'needs_reply') return thread.needs_reply;
    if (filter === 'done') return thread.status === 'done';
    return true;
  }), [threads, filter]);

  const line = connections.find((item) => item.provider === 'line');
  const unreadCount = threads.filter((thread) => thread.unread).length;

  return <Screen onRefresh={() => load()}>
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 4 }}>
        <ScreenTitle>Messages</ScreenTitle>
        <SupportText>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</SupportText>
      </View>
      <ActionButton kind="primary" label="+ New conversation" onPress={() => router.push('/messages/new' as any)} />
    </View>

    {line && !line.connected ? (
      <Banner>
        <Text style={styles.bannerTitle}>LINE · Not connected yet</Text>
        <SupportText>Paste a client's message with "+ New conversation". AngelOS drafts the reply, you approve it, then copy it into LINE, Instagram or Facebook.</SupportText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/settings/connections' as any)}><Text style={styles.link}>Connect in Settings → Connections</Text></Pressable>
      </Banner>
    ) : null}

    <View style={styles.filters}>
      {FILTERS.map((item) => <Chip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />)}
      <Chip label="Saved replies" onPress={() => router.push('/messages/saved-replies' as any)} />
    </View>

    {state === 'loading' ? <Card><SupportText>Loading messages…</SupportText></Card> : null}
    {state === 'error' ? <ErrorState title={errorText.title} message={errorText.message} onRetry={() => { setState('loading'); void load(); }} /> : null}
    {state === 'ready' && visible.length === 0 ? (
      <Card><EmptyState
        title={filter === 'all' ? 'No conversations yet' : 'Nothing here'}
        message={filter === 'all' ? 'Paste a message a client sent you on LINE, Instagram or Facebook to get an AI reply draft.' : 'Try another filter.'}
        action={filter === 'all' ? { label: '+ New conversation', onPress: () => router.push('/messages/new' as any) } : undefined}
      /></Card>
    ) : null}

    {state === 'ready' ? <View style={styles.list}>
      {visible.map((thread) => {
        const name = thread.client?.display_name ?? thread.contact_display_name ?? 'Unknown sender';
        return <Pressable key={thread.id} accessibilityRole="button" accessibilityLabel={`${name}, ${thread.platform_label}${thread.unread ? ', unread' : ''}`} onPress={() => router.push(`/messages/${thread.id}` as any)} style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Avatar name={name} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.name, thread.unread && styles.nameUnread]}>{name}</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.time}>{timeLabel(thread.last_message_at)}</Text>
            </View>
            <View style={styles.rowMid}>
              <PlatformBadge platform={thread.platform} label={thread.platform_label} />
              {thread.needs_owner ? <Text style={styles.flag}>Needs you</Text> : null}
              {thread.status === 'done' ? <Text style={styles.done}>Done</Text> : thread.needs_reply ? <Text style={styles.flag}>Needs reply</Text> : null}
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.preview}>{thread.last_direction === 'outbound' ? 'You: ' : ''}{thread.last_preview ?? ''}</Text>
          </View>
          <UnreadDot visible={thread.unread} />
        </Pressable>;
      })}
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bannerTitle: { fontFamily: tokens.font.uiBold, fontSize: 15, color: ui.colors.primaryText },
  link: { fontFamily: tokens.font.uiBold, fontSize: 15, color: tokens.color.tide, paddingVertical: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 2, borderRadius: 28, backgroundColor: tokens.color.raised, paddingVertical: 4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.colors.border },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: tokens.font.uiSemibold, fontSize: 16, color: ui.colors.primaryText },
  nameUnread: { fontFamily: tokens.font.uiBold },
  time: { fontFamily: tokens.font.uiMedium, fontSize: 13, color: ui.colors.secondaryText },
  preview: { fontFamily: tokens.font.ui, fontSize: 15, color: ui.colors.secondaryText },
  flag: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: tokens.color.warning },
  done: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: tokens.color.success }
});
