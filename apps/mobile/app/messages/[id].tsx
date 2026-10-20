import { useCallback, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChatBar } from '../../src/components/ChatBar';
import { ChatTools } from '../../src/components/ChatTools';
import { PlatformBadge } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import {
  approveReply, createAiReplyDraft, createMessageReply, fillName, getMessageThread, isJapanese,
  listSavedReplies, markThreadRead, timeLabel, translateText, type ClientMessage, type MessageThreadDetail, type SavedReply
} from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { useAppearance } from '../../src/design/appearance';

const APP_NAME: Record<string, string> = { line: 'LINE', instagram: 'Instagram', facebook: 'Messenger', other: 'the app' };

export default function MessageThreadScreen() {
  const { t, i18n } = useTranslation();
  const appLang: 'en' | 'ja' = i18n.language?.startsWith('ja') ? 'ja' : 'en';
  const { palette, mode } = useAppearance();
  const insets = useSafeAreaInsets();
  const night = mode === 'night';
  const scrollRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageThreadDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [translations, setTranslations] = useState<Record<string, { text: string; shown: boolean }>>({});
  const [saved, setSaved] = useState<SavedReply[] | null>(null);
  const [showPlus, setShowPlus] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftHidden, setDraftHidden] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const ws = workspaceId ?? (await getActiveWorkspace()).id;
      setWorkspaceId(ws);
      const next = await getMessageThread(ws, id);
      setDetail(next); setState('ready');
      if (next.thread.unread) void markThreadRead(ws, id).catch(() => undefined);
    } catch { setState('error'); }
  }, [id, workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pendingDraft = useMemo(() => detail?.messages.slice().reverse().find((m) => m.sender_type === 'ai' && m.status === 'pending_approval') ?? null, [detail]);
  const visible = useMemo(() => (detail?.messages ?? []).filter((m) => m.status !== 'cancelled' && !(m.sender_type === 'ai' && m.status === 'pending_approval')), [detail]);

  async function run(label: string, task: () => Promise<unknown>, after = true) {
    if (!workspaceId) return;
    setBusy(label);
    try { await task(); if (after) await load(); }
    catch (error) {
      const friendly = toFriendly(error, { action: 'save' });
      void dialog.notify(friendly.title, error instanceof Error && error.message ? error.message : friendly.message);
    } finally { setBusy(null); }
  }

  if (state === 'error') return <View style={[styles.fill, { backgroundColor: night ? '#050505' : '#F3F3F3', paddingTop: insets.top }]}><Text style={[styles.err, { color: palette.text }]}>Could not open this chat.</Text><Pressable onPress={() => { setState('loading'); void load(); }}><Text style={{ color: palette.text }}>Try again</Text></Pressable></View>;
  if (!detail || !workspaceId) return <View style={[styles.fill, { backgroundColor: night ? '#050505' : '#F3F3F3', paddingTop: insets.top }]}><Text style={[styles.err, { color: palette.muted }]}>Loading…</Text></View>;

  const thread = detail.thread;
  const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
  const firstName = name.split(/[\s\u3000]+/)[0];
  const appName = APP_NAME[thread.platform] ?? 'LINE';
  const live = thread.delivery === 'live';
  const incBg = night ? '#26262A' : '#E4E4E6';
  const incText = night ? '#F4F4F5' : '#151515';
  const outBg = night ? '#E9E9EB' : '#1C1C1E';
  const outText = night ? '#151515' : '#F4F4F5';

  async function send() {
    const text = reply.trim();
    if (!text) return;
    const meaning = isJapanese(text) && appLang === 'en' ? (await translateText(workspaceId!, text, 'en').catch(() => null))?.translation : null;
    const message = meaning ? `You'll send: ${text}\n\nMeans: ${meaning}` : live ? `Send to ${name} on ${appName}?` : `This will be marked ready. Copy it into ${appName} yourself.`;
    const ok = await dialog.confirm({ title: 'Send', message, confirmText: 'Send' });
    if (!ok) return;
    await run('send', async () => {
      if (pendingDraft && text === pendingDraft.body) await approveReply(workspaceId!, pendingDraft.id);
      else await createMessageReply(workspaceId!, thread.id, text, true);
      setReply(''); setDraftOpen(false);
    });
  }

  async function openSaved() {
    setShowPlus(false); setShowSaved(true);
    if (saved === null) {
      try { setSaved((await listSavedReplies(workspaceId!)).replies.filter((r) => (r.status ?? 'approved') === 'approved')); }
      catch { setSaved([]); }
    }
  }
  function insertSaved(item: SavedReply) {
    const useJa = thread.reply_language === 'ja' && item.body_ja;
    setReply(fillName((useJa ? item.body_ja : item.body_en ?? item.body_ja) ?? '', firstName));
    setShowSaved(false);
  }
  function openPhoto() {
    setShowPlus(false);
    router.push({ pathname: '/media/import', params: { clientId: thread.client?.id, role: 'other' } } as any);
  }

  function onLongPress(message: ClientMessage) {
    if (!message.body) return;
    const options = ['Translate', 'Copy', 'Reply', 'Link to client', 'Cancel'];
    const runIndex = (index: number) => {
      if (index === 0) void run(`tr-${message.id}`, async () => {
        const result = await translateText(workspaceId!, message.body, appLang);
        if (result?.translation) setTranslations((prev) => ({ ...prev, [message.id]: { text: result.translation, shown: true } }));
      }, false);
      else if (index === 1) void dialog.notify('Copied', message.body);
      else if (index === 2) setReply((prev) => `> ${message.body}\n${prev}`);
      else if (index === 3 && thread.client) router.push(`/clients/${thread.client.id}` as any);
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4 }, runIndex);
    else Alert.alert('Message', undefined, options.slice(0, 4).map((label, i) => ({ text: label, onPress: () => runIndex(i) })).concat({ text: 'Cancel', style: 'cancel' as const }));
  }

  const showChip = pendingDraft && !draftHidden;

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: night ? '#050505' : '#F3F3F3' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.chevron, { color: palette.text }]}>‹</Text>
        </Pressable>
        <View style={[styles.avatar, night && { backgroundColor: '#2A2A2D' }]}>
          {thread.contact_avatar_url ? <Image source={{ uri: thread.contact_avatar_url }} style={styles.avatarImg} /> : <Text style={[styles.avatarText, night && { color: '#F4F4F5' }]}>{name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{name}</Text>
          <View style={styles.sub}>
            <PlatformBadge platform={thread.platform} label={thread.platform_label} />
            <Text style={[styles.subText, { color: night ? '#9A9A9F' : '#8A8A8E' }]}>{thread.reply_language === 'ja' ? 'Writes in Japanese' : 'Writes in English'}</Text>
          </View>
        </View>
        {thread.client ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open client" onPress={() => router.push(`/clients/${thread.client!.id}` as any)} style={styles.open}>
            <Text style={[styles.openText, { color: palette.text }]}>Open</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {visible.map((message) => {
          const out = message.direction === 'outbound';
          const tr = translations[message.id];
          return (
            <Pressable key={message.id} onLongPress={() => onLongPress(message)} style={[styles.row, out && styles.rowOut]}>
              <View style={[styles.bubble, { backgroundColor: out ? outBg : incBg }]}>
                <Text style={[styles.body, { color: out ? outText : incText }]}>{message.body}</Text>
              </View>
              {tr?.shown ? <Text style={[styles.meaning, { color: night ? '#9A9A9F' : '#6B6B70' }]}>{tr.text}</Text> : null}
              <Text style={[styles.time, { color: night ? '#9A9A9F' : '#8A8A8E' }]}>{timeLabel(message.created_at)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showChip ? (
        <View style={[styles.chip, night && { backgroundColor: '#161618', borderColor: 'rgba(255,255,255,0.10)' }]}>
          <Pressable onPress={() => setDraftOpen((v) => !v)} style={{ flex: 1 }}>
            <Text style={[styles.chipText, { color: palette.text }]}>{draftOpen ? 'Hide draft' : 'AI draft'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close draft" onPress={() => { setDraftHidden(true); setDraftOpen(false); }} hitSlop={8} style={styles.close}>
            <Text style={[styles.closeText, { color: night ? '#9A9A9F' : '#8A8A8E' }]}>×</Text>
          </Pressable>
        </View>
      ) : null}
      {draftOpen && pendingDraft && !draftHidden ? (
        <View style={[styles.draft, night && { backgroundColor: '#161618' }]}>
          <Text style={[styles.draftText, { color: palette.text }]}>{pendingDraft.body}</Text>
          <View style={styles.draftRow}>
            <Pressable onPress={() => { setReply(pendingDraft.body); setDraftOpen(false); }}><Text style={[styles.draftBtn, { color: palette.text }]}>Edit</Text></Pressable>
            <Pressable onPress={() => void run('draft', () => createAiReplyDraft(workspaceId, thread.id))}><Text style={[styles.draftBtn, { color: palette.text }]}>New</Text></Pressable>
          </View>
        </View>
      ) : null}

      <ChatBar value={reply} onChangeText={setReply} placeholder={thread.reply_language === 'ja' ? 'Write in Japanese' : 'Write a message'} onSend={() => void send()} disabled={Boolean(busy)} onPlus={() => setShowPlus(true)} />

      <ChatTools visible={showPlus} onClose={() => setShowPlus(false)} night={night}>
        <Pressable accessibilityRole="button" accessibilityLabel="Saved replies" onPress={() => void openSaved()} style={styles.plusRow}>
          <Text style={[styles.plusTitle, { color: palette.text }]}>Saved replies</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Photo" onPress={openPhoto} style={styles.plusRow}>
          <Text style={[styles.plusTitle, { color: palette.text }]}>Photo</Text>
        </Pressable>
      </ChatTools>

      <ChatTools visible={showSaved} onClose={() => setShowSaved(false)} night={night}>
        {saved === null ? <Text style={{ color: palette.muted }}>Loading…</Text> : null}
        {saved?.length === 0 ? <Text style={{ color: palette.muted }}>No saved replies yet.</Text> : null}
        {saved?.map((item) => <Pressable key={item.id} onPress={() => insertSaved(item)} style={styles.saved}><Text style={[styles.savedTitle, { color: palette.text }]}>{item.title}</Text></Pressable>)}
      </ChatTools>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  chevron: { fontSize: 28, lineHeight: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E4E4E6', justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' },
  avatarImg: { width: 32, height: 32 },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#151515' },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subText: { fontSize: 12, lineHeight: 16 },
  open: { paddingHorizontal: 10, height: 32, justifyContent: 'center' },
  openText: { fontSize: 15, fontWeight: '600' },
  thread: { padding: 12, gap: 8, paddingBottom: 16 },
  row: { alignItems: 'flex-start', gap: 2, maxWidth: '80%' },
  rowOut: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  body: { fontSize: 16, lineHeight: 22 },
  meaning: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  time: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginLeft: 12, marginBottom: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#FFFFFF', gap: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
  close: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 18, lineHeight: 20 },
  draft: { marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 8 },
  draftText: { fontSize: 15, lineHeight: 20 },
  draftRow: { flexDirection: 'row', gap: 12 },
  draftBtn: { fontSize: 14, fontWeight: '600' },
  plusRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  plusTitle: { fontSize: 16, fontWeight: '600' },
  saved: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  savedTitle: { fontSize: 16 },
  err: { fontSize: 16, textAlign: 'center', marginTop: 40 }
});
