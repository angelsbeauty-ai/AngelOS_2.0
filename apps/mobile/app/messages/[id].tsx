import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, ScreenTitle, SectionTitle, SupportText, screenHeader } from '../../src/components/ui';
import { ActionButton, Avatar, Banner, BilingualBlock, PlatformBadge } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import {
  addInboundMessage, addThreadInternalNote, approveReply, copyAndOpen, createAiReplyDraft, createMessageReply, fillName,
  getMessageThread, isJapanese, listSavedReplies, markReplySent, markThreadRead, timeLabel, translateClientMessage, translateText,
  updateThread, type ClientMessage, type MessageThreadDetail, type SavedReply
} from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';

const APP_NAME: Record<string, string> = { line: 'LINE', instagram: 'Instagram', facebook: 'Messenger', other: 'the app' };

/** LINE live send stays off. META_MESSAGING_SEND_ENABLED is not flipped here. */
const LINE_SEND_OFF = true;

function photoUrl(message: ClientMessage): string | null {
  const m = message.metadata ?? {};
  return m.image_url || m.media_url || m.photo_url || m.attachment_url || (Array.isArray(m.attachments) && m.attachments[0]?.url) || null;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, t: (k: string) => string) {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return t('msgd.today');
  if (diff === 1) return t('msgd.yesterday');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessageThreadScreen() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const scrollRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageThreadDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftMeaning, setDraftMeaning] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyMeaning, setReplyMeaning] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [note, setNote] = useState('');
  const [savedReplies, setSavedReplies] = useState<SavedReply[] | null>(null);
  const [showSaved, setShowSaved] = useState(false);

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
  const visibleMessages = useMemo(() => (detail?.messages ?? []).filter((m) => m.status !== 'cancelled' && !(m.sender_type === 'ai' && m.status === 'pending_approval')), [detail]);

  async function run(label: string, task: () => Promise<unknown>, after = true) {
    if (!workspaceId) return;
    setBusy(label);
    try { await task(); if (after) await load(); }
    catch (error) {
      const friendly = toFriendly(error, { action: 'save' });
      void dialog.notify(friendly.title, error instanceof Error && error.message ? error.message : friendly.message);
    } finally { setBusy(null); }
  }

  if (state === 'error') return <Screen><ScreenTitle>{t('nav.conversation')}</ScreenTitle><ErrorState title={t('msgd.s12')} message={t('msgd.s13')} onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!detail || !workspaceId) return <Screen><ScreenTitle>{t('nav.conversation')}</ScreenTitle><Card><SupportText>{t('msgd.s0')}</SupportText><SupportText>{t('msgd.s33')}</SupportText></Card></Screen>;

  const thread = detail.thread;
  const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
  const firstName = name.split(/[\s\u3000]+/)[0];
  const appName = APP_NAME[thread.platform] ?? 'LINE';
  const lineOff = thread.platform === 'line' && LINE_SEND_OFF;
  const manual = thread.delivery === 'manual' || lineOff;
  const draftBody = draftText ?? pendingDraft?.body ?? '';
  const draftIsJa = isJapanese(draftBody);
  const draftEdited = pendingDraft ? draftBody !== pendingDraft.body : false;
  const draftEnglish = draftEdited ? draftMeaning : pendingDraft?.translated_body ?? null;
  const replyIsJa = isJapanese(reply);
  const wrongLanguage = (text: string) => text.trim() && (thread.reply_language === 'ja') !== isJapanese(text);
  const cardBg = night ? 'rgba(18,18,20,0.66)' : 'rgba(255,255,255,0.80)';
  const fieldBg = night ? palette.fill : 'rgba(255,255,255,0.80)';
  const fieldBorder = night ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.06)';

  async function approveDraft() {
    if (!pendingDraft) return;
    const message = lineOff ? t('msgd.confirmLineOff') : manual ? t('msgd.confirmManual', { app: appName }) : t('msgd.confirmSend', { name, app: appName });
    const ok = await dialog.confirm({ title: t('msgd.s31'), message, confirmText: t('msgd.s32') });
    if (!ok) return;
    await run('approve', async () => {
      const result = await approveReply(workspaceId!, pendingDraft.id, draftEdited ? draftBody : undefined);
      setDraftText(null); setDraftMeaning(null);
      if (result.delivery === 'manual' || lineOff) void dialog.notify(t('msgd.approvedTitle'), t('msgd.approvedMsg', { app: appName, name }));
    });
  }

  async function approveOwnReply() {
    const message = lineOff ? t('msgd.confirmLineOff') : manual ? t('msgd.confirmManual', { app: appName }) : t('msgd.confirmSend', { name, app: appName });
    const ok = await dialog.confirm({ title: t('msgd.s31'), message, confirmText: t('msgd.s32') });
    if (!ok) return;
    await run('reply', async () => { await createMessageReply(workspaceId!, thread.id, reply.trim(), true); setReply(''); setReplyMeaning(null); });
  }

  async function openSaved() {
    setShowSaved((value) => !value);
    if (savedReplies === null) {
      try { setSavedReplies((await listSavedReplies(workspaceId!)).replies.filter((item) => (item.status ?? 'approved') === 'approved')); }
      catch { setSavedReplies([]); }
    }
  }

  function insertSaved(item: SavedReply) {
    const useJa = thread.reply_language === 'ja' && item.body_ja;
    const text = fillName((useJa ? item.body_ja : item.body_en ?? item.body_ja) ?? '', firstName);
    setReply(text);
    setReplyMeaning(useJa ? fillName(item.body_en ?? '', firstName) || null : null);
    setShowSaved(false);
  }

  let lastDay = '';
  const rows: Array<{ key: string; kind: 'day' | 'msg'; label?: string; message?: ClientMessage }> = [];
  for (const message of visibleMessages) {
    const key = dayKey(message.created_at);
    if (key !== lastDay) { rows.push({ key: `day-${key}`, kind: 'day', label: dayLabel(message.created_at, t) }); lastDay = key; }
    rows.push({ key: message.id, kind: 'msg', message });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: night ? '#050505' : '#F3F3F3' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <View style={[styles.top, { borderBottomColor: fieldBorder }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', { defaultValue: 'Back' })} onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={[styles.backChevron, { color: palette.text }]}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={[screenHeader.title, { color: palette.text, fontSize: 28, lineHeight: 36 }]}>{name}</Text>
          <View style={styles.inline}>
            <PlatformBadge platform={thread.platform} label={thread.platform_label} />
            <SupportText>{thread.reply_language === 'ja' ? t('msgd.writesJa') : t('msgd.writesEn')}</SupportText>
          </View>
        </View>
        {thread.client ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('msgd.openClient')} onPress={() => router.push(`/clients/${thread.client!.id}` as any)} style={styles.clientLink}>
            <Text style={[styles.clientLinkText, { color: palette.text }]}>{t('msgd.openClient')}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        <View style={styles.actions}>
          {thread.status === 'done'
            ? <ActionButton label={t('msgd.s14')} onPress={() => void run('status', () => updateThread(workspaceId, thread.id, { status: 'needs_reply' }))} />
            : <ActionButton label={t('msgd.s15')} onPress={() => void run('status', () => updateThread(workspaceId, thread.id, { status: 'done' }))} />}
          <ActionButton label={thread.archived ? t('msgd.unarchive') : t('msgd.archive')} onPress={() => void run('archive', async () => { await updateThread(workspaceId, thread.id, { archived: !thread.archived }); if (!thread.archived) router.back(); }, thread.archived)} />
          {thread.client ? <ActionButton label={t('msgd.s16')} onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: thread.client!.id } } as any)} /> : null}
          <ActionButton kind="quiet" label={t('msgd.s17')} onPress={() => router.push({ pathname: '/ai', params: { screen: 'messages', entityType: 'message_thread', entityId: thread.id, entityLabel: name } } as any)} />
        </View>
        {thread.needs_owner ? <Banner tone="warning"><SupportText tone="warning">{t('msgd.s1')}</SupportText></Banner> : null}
        {lineOff ? <Banner><SupportText>{t('msgd.confirmLineOff')}</SupportText></Banner> : null}

        <View style={styles.bubbles}>
          {rows.map((row) => row.kind === 'day'
            ? <Text key={row.key} style={[styles.day, { color: palette.muted }]}>{row.label}</Text>
            : <Bubble key={row.key} message={row.message!} appName={appName} manual={manual} busy={busy} night={night} paletteText={palette.text} paletteMuted={palette.muted}
                onTranslate={() => void run(`tr-${row.message!.id}`, () => translateClientMessage(workspaceId, row.message!.id, 'en'))}
                onCopy={() => void copyAndOpen(row.message!.body, thread.platform).then((result) => { if (result === 'failed') void dialog.notify(t('msgd.copyFailTitle'), t('msgd.copyFailMsg')); })}
                onMarkSent={() => void run(`sent-${row.message!.id}`, () => markReplySent(workspaceId, row.message!.id))} />)}
        </View>

        {manual ? <Card>
          <SectionTitle>{t('msgd.didWrite', { name: firstName })}</SectionTitle>
          <TextInput accessibilityLabel={t('msgd.s18')} value={pasted} onChangeText={setPasted} placeholder={t('msgd.s19')} placeholderTextColor={palette.muted} multiline style={[styles.input, styles.small, { backgroundColor: fieldBg, borderColor: fieldBorder, color: palette.text }]} />
          <ActionButton label={t('msgd.s20')} disabled={!pasted.trim() || Boolean(busy)} onPress={() => void run('paste', async () => { await addInboundMessage(workspaceId, thread.id, pasted.trim()); setPasted(''); })} />
        </Card> : null}

        <Card>
          <SectionTitle>{t('msgd.s2')}</SectionTitle>
          {pendingDraft ? <>
            {pendingDraft.metadata?.mixed_language_warning ? <SupportText tone="warning">{t('msgd.s3')}</SupportText> : null}
            {draftIsJa ? <BilingualBlock ja={draftBody} en={draftEnglish} /> : null}
            <TextInput accessibilityLabel={t('msgd.s21')} value={draftBody} onChangeText={(text) => { setDraftText(text); setDraftMeaning(null); }} multiline style={[styles.input, styles.medium, { backgroundColor: fieldBg, borderColor: fieldBorder, color: palette.text }]} />
            {draftIsJa && draftEdited && !draftMeaning ? <ActionButton label={t('msgd.s22')} onPress={() => void run('meaning', async () => setDraftMeaning((await translateText(workspaceId, draftBody, 'en')).translation), false)} /> : null}
            <SupportText>{t('msgd.s4')}</SupportText>
            <View style={styles.inline}>
              <ActionButton kind="primary" label={busy === 'approve' ? t('msgd.approving') : t('msgd.approve')} disabled={Boolean(busy) || !draftBody.trim() || (draftIsJa && !draftEnglish)} onPress={() => void approveDraft()} />
              <ActionButton label={t('msgd.s23')} disabled={Boolean(busy)} onPress={() => void run('draft', async () => { setDraftText(null); await createAiReplyDraft(workspaceId, thread.id); })} />
            </View>
          </> : <>
            <SupportText>{thread.reply_language === 'ja' ? t('msgd.aiWritesJa') : t('msgd.aiWritesEn')}</SupportText>
            <ActionButton kind="primary" label={busy === 'draft' ? t('msgd.writing') : t('msgd.draftAi')} disabled={Boolean(busy)} onPress={() => void run('draft', () => createAiReplyDraft(workspaceId, thread.id))} />
          </>}
        </Card>

        <Card>
          <SectionTitle>{t('msgd.s9')}</SectionTitle>
          <SupportText>{t('msgd.s10')}</SupportText>
          {detail.internalNotes.map((item) => <View key={item.id} style={styles.note}><Text style={[styles.noteText, { color: palette.text }]}>{item.content}</Text><SupportText>{timeLabel(item.created_at)}</SupportText></View>)}
          <TextInput accessibilityLabel={t('msgd.s26')} value={note} onChangeText={setNote} placeholder={t('msgd.s27')} placeholderTextColor={palette.muted} multiline style={[styles.input, styles.small, { backgroundColor: fieldBg, borderColor: fieldBorder, color: palette.text }]} />
          <ActionButton label={t('msgd.s28')} disabled={!note.trim() || Boolean(busy)} onPress={() => void run('note', async () => { await addThreadInternalNote(workspaceId, thread.id, note.trim()); setNote(''); })} />
        </Card>
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: cardBg, borderTopColor: fieldBorder }]}>
        <ActionButton label={showSaved ? t('msgd.hideSaved') : t('msgd.savedReplies')} onPress={() => void openSaved()} />
        {showSaved ? <View style={{ gap: 6 }}>
          {savedReplies === null ? <SupportText>{t('msgd.s6')}</SupportText> : null}
          {savedReplies?.length === 0 ? <SupportText>{t('msgd.s7')}</SupportText> : null}
          {savedReplies?.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('mnew.choose', { name: item.title })} onPress={() => insertSaved(item)} style={styles.savedRow}><Text style={[styles.savedTitle, { color: palette.text }]}>{item.title}</Text><SupportText>{thread.reply_language === 'ja' && item.body_ja ? '日本語' : 'English'}</SupportText></Pressable>)}
        </View> : null}
        <TextInput accessibilityLabel={t('msgd.s24')} value={reply} onChangeText={(text) => { setReply(text); setReplyMeaning(null); }} placeholder={thread.reply_language === 'ja' ? t('msgd.replyJa') : t('msgd.replyEn')} placeholderTextColor={palette.muted} multiline style={[styles.input, styles.composerInput, { backgroundColor: fieldBg, borderColor: fieldBorder, color: palette.text }]} />
        {replyIsJa ? <BilingualBlock ja={reply} en={replyMeaning} /> : null}
        {replyIsJa && !replyMeaning ? <ActionButton label={t('msgd.s25')} onPress={() => void run('meaning', async () => setReplyMeaning((await translateText(workspaceId, reply, 'en')).translation), false)} /> : null}
        {wrongLanguage(reply) ? <SupportText tone="warning">{thread.reply_language === 'ja' ? t('msgd.sameLangJa', { name: firstName }) : t('msgd.sameLangEn', { name: firstName })}</SupportText> : null}
        {/\[[^\]\n]{1,40}\]/.test(reply) ? <SupportText tone="warning">{t('msgd.s8')}</SupportText> : null}
        <ActionButton kind="primary" label={busy === 'reply' ? t('msgd.approving') : t('msgd.approveMine')} disabled={Boolean(busy) || !reply.trim() || (replyIsJa && !replyMeaning)} onPress={() => void approveOwnReply()} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, appName, manual, busy, night, paletteText, paletteMuted, onTranslate, onCopy, onMarkSent }: { message: ClientMessage; appName: string; manual: boolean; busy: string | null; night: boolean; paletteText: string; paletteMuted: string; onTranslate: () => void; onCopy: () => void; onMarkSent: () => void }) {
  const { t } = useTranslation();
  const inbound = message.direction === 'inbound';
  const ready = message.status === 'queued' && (message.metadata?.delivery === 'manual' || manual);
  const failed = message.status === 'failed' || (manual && message.direction === 'outbound' && message.status !== 'sent');
  const ja = isJapanese(message.body);
  const photo = photoUrl(message);
  const statusLabel = !inbound
    ? (message.status === 'sent' ? (message.metadata?.sent_by === 'owner_manual' ? t('msgd.sentByYou') : t('msgd.sent')) : ready ? t('msgd.readySend') : failed ? t('msgd.notSent') : message.status)
    : '';
  return <View style={[styles.bubbleWrap, inbound ? styles.left : styles.right]}>
    <View style={[styles.bubble, inbound ? (night ? styles.inBubbleNight : styles.inBubble) : styles.outBubble]}>
      {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel={t('msgd.s11')} /> : null}
      {message.body ? <Text style={[styles.bubbleText, inbound ? { color: paletteText } : styles.outText]}>{message.body}</Text> : null}
      {message.translated_body ? <View style={styles.translation}><Text style={[styles.translationLabel, { color: inbound ? paletteMuted : '#E5E5E7' }]}>{t('msgd.s11')}</Text><Text style={[styles.bubbleText, inbound ? { color: paletteText } : styles.outText]}>{message.translated_body}</Text></View> : null}
    </View>
    <View style={[styles.meta, inbound ? styles.left : styles.right]}>
      <Text style={[styles.metaText, { color: paletteMuted }]}>{timeLabel(message.created_at)}{statusLabel ? ` · ${statusLabel}` : ''}</Text>
      {ja && !message.translated_body ? <Pressable accessibilityRole="button" accessibilityLabel={t('msgd.s29')} onPress={onTranslate} disabled={Boolean(busy)}><Text style={[styles.metaLink, { color: paletteMuted }]}>{busy === `tr-${message.id}` ? t('msgd.translating') : t('msgd.translate')}</Text></Pressable> : null}
    </View>
    {ready && manual ? <View style={[styles.inline, styles.right]}>
      <ActionButton kind="primary" label={t('msgd.copyOpen', { app: appName })} onPress={onCopy} />
      <ActionButton label={t('msgd.s30')} disabled={Boolean(busy)} onPress={onMarkSent} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
  clientLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  clientLinkText: { fontFamily: tokens.font.uiSemibold, fontSize: 14 },
  thread: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bubbles: { gap: 10 },
  day: { alignSelf: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 0.4, marginVertical: 4 },
  bubbleWrap: { maxWidth: '88%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubble: { padding: 12, borderRadius: 20, gap: 8 },
  inBubble: { backgroundColor: 'rgba(255,255,255,0.80)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderBottomLeftRadius: 6 },
  inBubbleNight: { backgroundColor: 'rgba(18,18,20,0.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', borderBottomLeftRadius: 6 },
  outBubble: { backgroundColor: '#151515', borderBottomRightRadius: 6 },
  bubbleText: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22 },
  outText: { color: '#F4F4F5' },
  photo: { width: 180, height: 180, borderRadius: 14 },
  translation: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(127,127,127,0.3)', paddingTop: 8 },
  translationLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 12 },
  meta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metaText: { fontFamily: tokens.font.uiMedium, fontSize: 12 },
  metaLink: { fontFamily: tokens.font.uiBold, fontSize: 12, paddingVertical: 4 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: tokens.font.ui, textAlignVertical: 'top' },
  small: { minHeight: 72 },
  medium: { minHeight: 96 },
  composerInput: { minHeight: 48, maxHeight: 120 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 8 },
  savedRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(127,127,127,0.2)', gap: 2 },
  savedTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  note: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(127,127,127,0.2)' },
  noteText: { fontFamily: tokens.font.ui, fontSize: 15 }
});
