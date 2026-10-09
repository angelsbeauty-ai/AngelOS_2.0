import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, SectionTitle, SupportText, ui } from '../../src/components/ui';
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

const APP_NAME: Record<string, string> = { line: 'LINE', instagram: 'Instagram', facebook: 'Messenger', other: 'the app' };

export default function MessageThreadScreen() {
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

  if (state === 'error') return <Screen><ErrorState title="We couldn't load this conversation" message="Check your connection and try again. Nothing has been lost." onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!detail || !workspaceId) return <Screen><Card><SupportText>Loading conversation…</SupportText></Card></Screen>;

  const thread = detail.thread;
  const name = thread.client?.display_name ?? thread.contact_display_name ?? 'Conversation';
  const firstName = name.split(/[\s\u3000]+/)[0];
  const appName = APP_NAME[thread.platform] ?? 'LINE';
  const manual = thread.delivery === 'manual';
  const draftBody = draftText ?? pendingDraft?.body ?? '';
  const draftIsJa = isJapanese(draftBody);
  const draftEdited = pendingDraft ? draftBody !== pendingDraft.body : false;
  const draftEnglish = draftEdited ? draftMeaning : pendingDraft?.translated_body ?? null;
  const replyIsJa = isJapanese(reply);
  const wrongLanguage = (text: string) => text.trim() && (thread.reply_language === 'ja') !== isJapanese(text);

  async function approveDraft() {
    if (!pendingDraft) return;
    const ok = await dialog.confirm({ title: 'Approve this reply?', message: manual ? `It will be ready to copy into ${appName}. AngelOS does not send it for you.` : `AngelOS will send it to ${name} on ${appName}.`, confirmText: 'Approve' });
    if (!ok) return;
    await run('approve', async () => {
      const result = await approveReply(workspaceId!, pendingDraft.id, draftEdited ? draftBody : undefined);
      setDraftText(null); setDraftMeaning(null);
      if (result.delivery === 'manual') void dialog.notify('Approved · Ready to send', `Tap "Copy & open ${appName}" on the reply, paste it to ${name}, then tap "I sent it".`);
    });
  }

  async function approveOwnReply() {
    const ok = await dialog.confirm({ title: 'Approve this reply?', message: manual ? `It will be ready to copy into ${appName}.` : `AngelOS will send it to ${name} on ${appName}.`, confirmText: 'Approve' });
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

  return <Screen>
    <View style={styles.head}>
      <Avatar name={name} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>{name}</Text>
        <View style={styles.inline}><PlatformBadge platform={thread.platform} label={thread.platform_label} /><SupportText>{thread.reply_language === 'ja' ? 'Writes in 日本語' : 'Writes in English'}</SupportText></View>
      </View>
    </View>
    <View style={styles.actions}>
      {thread.status === 'done'
        ? <ActionButton label="Reopen" onPress={() => void run('status', () => updateThread(workspaceId, thread.id, { status: 'needs_reply' }))} />
        : <ActionButton label="Mark done" onPress={() => void run('status', () => updateThread(workspaceId, thread.id, { status: 'done' }))} />}
      <ActionButton label={thread.archived ? 'Unarchive' : 'Archive'} onPress={() => void run('archive', async () => { await updateThread(workspaceId, thread.id, { archived: !thread.archived }); if (!thread.archived) router.back(); }, thread.archived)} />
      {thread.client ? <ActionButton label="Book this person" onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: thread.client!.id } } as any)} /> : null}
      <ActionButton kind="quiet" label="Ask AI" onPress={() => router.push({ pathname: '/ai', params: { screen: 'messages', entityType: 'message_thread', entityId: thread.id, entityLabel: name } } as any)} />
    </View>
    {thread.needs_owner ? <Banner tone="warning"><SupportText tone="warning">This one needs you personally (complaint, health or unclear sender). Read carefully before replying.</SupportText></Banner> : null}

    <View style={styles.bubbles}>
      {visibleMessages.map((message) => <Bubble key={message.id} message={message} appName={appName} manual={manual} busy={busy}
        onTranslate={() => void run(`tr-${message.id}`, () => translateClientMessage(workspaceId, message.id, 'en'))}
        onCopy={() => void copyAndOpen(message.body, thread.platform).then((result) => { if (result === 'failed') void dialog.notify('Could not copy', 'Select the text and copy it yourself.'); })}
        onMarkSent={() => void run(`sent-${message.id}`, () => markReplySent(workspaceId, message.id))} />)}
    </View>

    {manual ? <Card>
      <SectionTitle>Did {firstName} write again?</SectionTitle>
      <TextInput accessibilityLabel="Paste the client's next message" value={pasted} onChangeText={setPasted} placeholder="Paste their next message" placeholderTextColor={ui.colors.secondaryText} multiline style={[styles.input, styles.small]} />
      <ActionButton label="Add their message" disabled={!pasted.trim() || Boolean(busy)} onPress={() => void run('paste', async () => { await addInboundMessage(workspaceId, thread.id, pasted.trim()); setPasted(''); })} />
    </Card> : null}

    <Card premium>
      <SectionTitle>AI reply draft</SectionTitle>
      {pendingDraft ? <>
        {pendingDraft.metadata?.mixed_language_warning ? <SupportText tone="warning">This draft mixes English and Japanese. Please fix it before approving.</SupportText> : null}
        {draftIsJa ? <BilingualBlock ja={draftBody} en={draftEnglish} /> : null}
        <TextInput accessibilityLabel="Edit the AI draft" value={draftBody} onChangeText={(text) => { setDraftText(text); setDraftMeaning(null); }} multiline style={[styles.input, styles.medium]} />
        {draftIsJa && draftEdited && !draftMeaning ? <ActionButton label="Update English meaning" onPress={() => void run('meaning', async () => setDraftMeaning((await translateText(workspaceId, draftBody, 'en')).translation), false)} /> : null}
        <SupportText>Nothing is sent until you tap Approve.</SupportText>
        <View style={styles.inline}>
          <ActionButton kind="primary" label={busy === 'approve' ? 'Approving…' : 'Approve'} disabled={Boolean(busy) || !draftBody.trim() || (draftIsJa && !draftEnglish)} onPress={() => void approveDraft()} />
          <ActionButton label="New draft" disabled={Boolean(busy)} onPress={() => void run('draft', async () => { setDraftText(null); await createAiReplyDraft(workspaceId, thread.id); })} />
        </View>
      </> : <>
        <SupportText>AngelOS writes a reply in {thread.reply_language === 'ja' ? 'friendly Japanese, with the English meaning next to it' : 'English'}. You check it, edit it, then approve.</SupportText>
        <ActionButton kind="primary" label={busy === 'draft' ? 'Writing…' : 'Draft reply with AI'} disabled={Boolean(busy)} onPress={() => void run('draft', () => createAiReplyDraft(workspaceId, thread.id))} />
      </>}
    </Card>

    <Card>
      <SectionTitle>Write your own reply</SectionTitle>
      <ActionButton label={showSaved ? 'Hide saved replies' : 'Saved replies'} onPress={() => void openSaved()} />
      {showSaved ? <View style={{ gap: 6 }}>
        {savedReplies === null ? <SupportText>Loading…</SupportText> : null}
        {savedReplies?.length === 0 ? <SupportText>No saved replies yet. Add them in Messages → Saved replies.</SupportText> : null}
        {savedReplies?.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Insert ${item.title}`} onPress={() => insertSaved(item)} style={styles.savedRow}><Text style={styles.savedTitle}>{item.title}</Text><SupportText>{thread.reply_language === 'ja' && item.body_ja ? '日本語' : 'English'}</SupportText></Pressable>)}
      </View> : null}
      <TextInput accessibilityLabel="Your reply" value={reply} onChangeText={(text) => { setReply(text); setReplyMeaning(null); }} placeholder={thread.reply_language === 'ja' ? 'Reply in Japanese (use a saved reply)' : 'Write your reply'} placeholderTextColor={ui.colors.secondaryText} multiline style={[styles.input, styles.medium]} />
      {replyIsJa ? <BilingualBlock ja={reply} en={replyMeaning} /> : null}
      {replyIsJa && !replyMeaning ? <ActionButton label="Show English meaning" onPress={() => void run('meaning', async () => setReplyMeaning((await translateText(workspaceId, reply, 'en')).translation), false)} /> : null}
      {wrongLanguage(reply) ? <SupportText tone="warning">{firstName} writes in {thread.reply_language === 'ja' ? 'Japanese' : 'English'}. Reply in the same language.</SupportText> : null}
      {/\[[^\]\n]{1,40}\]/.test(reply) ? <SupportText tone="warning">Fill in the [brackets] before approving.</SupportText> : null}
      <ActionButton kind="primary" label={busy === 'reply' ? 'Approving…' : 'Approve my reply'} disabled={Boolean(busy) || !reply.trim() || (replyIsJa && !replyMeaning)} onPress={() => void approveOwnReply()} />
    </Card>

    <Card>
      <SectionTitle>Private notes</SectionTitle>
      <SupportText>Only you see these. Never sent to the client.</SupportText>
      {detail.internalNotes.map((item) => <View key={item.id} style={styles.note}><Text style={styles.noteText}>{item.content}</Text><SupportText>{timeLabel(item.created_at)}</SupportText></View>)}
      <TextInput accessibilityLabel="Add a private note" value={note} onChangeText={setNote} placeholder="Add a note" placeholderTextColor={ui.colors.secondaryText} multiline style={[styles.input, styles.small]} />
      <ActionButton label="Save note" disabled={!note.trim() || Boolean(busy)} onPress={() => void run('note', async () => { await addThreadInternalNote(workspaceId, thread.id, note.trim()); setNote(''); })} />
    </Card>
  </Screen>;
}

function Bubble({ message, appName, manual, busy, onTranslate, onCopy, onMarkSent }: { message: ClientMessage; appName: string; manual: boolean; busy: string | null; onTranslate: () => void; onCopy: () => void; onMarkSent: () => void }) {
  const inbound = message.direction === 'inbound';
  const ready = message.status === 'queued' && message.metadata?.delivery === 'manual';
  const ja = isJapanese(message.body);
  return <View style={[styles.bubbleWrap, inbound ? styles.left : styles.right]}>
    <View style={[styles.bubble, inbound ? styles.inBubble : styles.outBubble]}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.bubbleText, !inbound && styles.outText]}>{message.body}</Text>
      {message.translated_body ? <View style={styles.translation}><Text style={[styles.translationLabel, !inbound && styles.outMuted]}>English meaning</Text><Text style={[styles.bubbleText, !inbound && styles.outText]}>{message.translated_body}</Text></View> : null}
    </View>
    <View style={[styles.meta, inbound ? styles.left : styles.right]}>
      <Text style={styles.metaText}>{timeLabel(message.created_at)}{!inbound ? ` · ${message.status === 'sent' ? (message.metadata?.sent_by === 'owner_manual' ? 'Sent by you' : 'Sent') : ready ? 'Approved · Ready to send' : message.status === 'failed' ? 'Not sent' : message.status}` : ''}</Text>
      {ja && !message.translated_body ? <Pressable accessibilityRole="button" accessibilityLabel="Translate to English" onPress={onTranslate} disabled={Boolean(busy)}><Text style={styles.metaLink}>{busy === `tr-${message.id}` ? 'Translating…' : 'Translate'}</Text></Pressable> : null}
    </View>
    {ready && manual ? <View style={[styles.inline, styles.right]}>
      <ActionButton kind="primary" label={`Copy & open ${appName}`} onPress={onCopy} />
      <ActionButton label="I sent it" disabled={Boolean(busy)} onPress={onMarkSent} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: tokens.font.display, fontSize: 32, lineHeight: 36, color: ui.colors.primaryText },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bubbles: { gap: 12 },
  bubbleWrap: { maxWidth: '88%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubble: { padding: 12, borderRadius: 20, gap: 8 },
  inBubble: { backgroundColor: tokens.color.raised, borderWidth: 1, borderColor: ui.colors.border, borderBottomLeftRadius: 6 },
  outBubble: { backgroundColor: tokens.color.charcoal, borderBottomRightRadius: 6 },
  bubbleText: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22, color: ui.colors.primaryText },
  outText: { color: tokens.color.onCharcoal },
  translation: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border, paddingTop: 8 },
  translationLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: ui.colors.secondaryText },
  outMuted: { color: 'rgba(250,248,245,0.7)' },
  meta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metaText: { fontFamily: tokens.font.uiMedium, fontSize: 12, color: ui.colors.secondaryText },
  metaLink: { fontFamily: tokens.font.uiBold, fontSize: 12, color: tokens.color.tide, paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: tokens.font.ui, textAlignVertical: 'top' },
  small: { minHeight: 72 },
  medium: { minHeight: 110 },
  savedRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.colors.border, gap: 2 },
  savedTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText },
  note: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.colors.border },
  noteText: { fontFamily: tokens.font.ui, fontSize: 15, color: ui.colors.primaryText }
});
