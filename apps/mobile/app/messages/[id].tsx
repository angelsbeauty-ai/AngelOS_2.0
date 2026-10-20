import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useInsets as useSafeAreaInsets } from '../../src/lib/insets';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { importMedia } from '../../src/lib/media';
import { enqueueReply, isOnlineNow, useOnline, useOutbox } from '../../src/lib/offline';
import { useToast } from '../../src/components/Toast';
import { Skeleton } from '../../src/components/ui';
import { ChatBar } from '../../src/components/ChatBar';
import { useDictation } from '../../src/lib/dictation';
import { ChatTools } from '../../src/components/ChatTools';
import { BrandLogo, contactInitials } from '../../src/components/BrandBadge';
import { SwipeReply } from '../../src/components/SwipeReply';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { DotsThree } from 'phosphor-react-native/src/icons/DotsThree';
import { X } from 'phosphor-react-native/src/icons/X';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import {
  approveReply, createAiReplyDraft, createMessageReply, fillName, getMessageThread, isJapanese,
  listSavedReplies, markThreadRead, timeLabel, toggleReaction, translateText, type ClientMessage, type MessageThreadDetail, type SavedReply
} from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { useAppearance } from '../../src/design/appearance';

/** Japanese text uses the system font (Manrope has no kana; web would fall back to a handwriting face). */
const JP_FONT = (text?: string | null) => (text && /[\u3040-\u30ff\u4e00-\u9faf]/.test(text) ? { fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif' : undefined } : null);
const REACTIONS = ['❤️', '👍', '😂', '😮', '🙏', '✨'];
const APP_NAME: Record<string, string> = { line: 'LINE', instagram: 'Instagram', facebook: 'Messenger', other: 'the app' };

export default function MessageThreadScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
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
  const replyRef = useRef(reply); replyRef.current = reply;
  const [translations, setTranslations] = useState<Record<string, { text: string; shown: boolean }>>({});
  const [saved, setSaved] = useState<SavedReply[] | null>(null);
  const [showPlus, setShowPlus] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftHidden, setDraftHidden] = useState(false);
  const [replyTo, setReplyTo] = useState<ClientMessage | null>(null);
  // P05: the reply bar and chips shrink the list; keep the last bubble in view above them.
  const [bottomH, setBottomH] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState<ClientMessage | null>(null);
  const online = useOnline();
  const outbox = useOutbox(id);

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
  // Saved replies power the suggestion chips (real, approved replies only).
  useEffect(() => {
    if (!workspaceId || saved !== null) return;
    listSavedReplies(workspaceId).then((r) => setSaved(r.replies.filter((x) => (x.status ?? 'approved') === 'approved'))).catch(() => setSaved([]));
  }, [workspaceId, saved]);

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

  // Hold the waveform to dictate. Speech only fills the draft; sending is still her tap on send.
  const dictation = useDictation(() => replyRef.current, setReply, appLang) /* M31: dictate in Angel's app language, not the client's */;
  useEffect(() => {
    if (!dictation.error) return;
    toast.show({ title: dictation.error === 'permission' ? t('messages.dictatePerm') : t('messages.dictateFail'), tone: 'error' });
    dictation.clearError();
  }, [dictation.error]);
  if (state === 'error') return <View style={[styles.fill, { backgroundColor: night ? '#050505' : '#F3F3F3', paddingTop: insets.top }]}><Text style={[styles.err, { color: palette.text }]}>{t('messages.openFail')}</Text><Pressable accessibilityRole="button" onPress={() => { setState('loading'); void load(); }} style={styles.retryBig}><Text style={{ color: palette.text, fontWeight: '600' }}>{t('messages.tryAgain')}</Text></Pressable></View>;
  if (!detail || !workspaceId) return <View style={[styles.fill, { backgroundColor: night ? '#050505' : '#F3F3F3', paddingTop: insets.top }]}><View style={{ padding: 16, paddingTop: 70 }}><Skeleton rows={6} height={48} /></View></View>;

  const thread = detail.thread;
  const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
  const firstName = name.split(/[\s\u3000]+/)[0];
  const appName = APP_NAME[thread.platform] ?? 'LINE';
  const live = thread.delivery === 'live';
  const incBg = night ? '#26262A' : '#FFFFFF';
  const incText = night ? '#F4F4F5' : '#151515';
  const outBg = night ? '#E9E9EB' : '#E4E4E6';
  const outText = '#151515';

  async function send() {
    const text = reply.trim();
    if (!text) return;
    const meaning = isJapanese(text) && appLang === 'en' ? (await translateText(workspaceId!, text, 'en').catch(() => null))?.translation : null;
    const message = meaning ? t('messages.confirmMeaning', { text, meaning }) : live ? t('messages.confirmLive', { name, app: appName }) : t('messages.confirmManual', { app: appName });
    const ok = await dialog.confirm({ title: t('messages.send'), message, confirmText: t('messages.send') });
    if (!ok) return;
    if (!(await isOnlineNow())) {
      // Approved while offline: it waits on the phone and goes out on reconnect.
      await enqueueReply({ workspaceId: workspaceId!, threadId: thread.id, body: text, replyToMessageId: replyTo?.id });
      setReply(''); setDraftOpen(false); setReplyTo(null);
      toast.show({ tone: 'info', title: t('messages.queued') });
      return;
    }
    await run('send', async () => {
      if (pendingDraft && text === pendingDraft.body && !replyTo) await approveReply(workspaceId!, pendingDraft.id);
      else await createMessageReply(workspaceId!, thread.id, text, true, replyTo ? { replyToMessageId: replyTo.id } : undefined);
      setReply(''); setDraftOpen(false); setReplyTo(null);
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
  // M20: pick a photo, store it in the studio media library, then send it only after the confirm tap.
  async function openPhoto() {
    setShowPlus(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { void dialog.notify(t('imp.photosPerm'), t('imp.photosPermMsg')); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;
    const a = picked.assets[0];
    const ok = await dialog.confirm({ title: t('messages.sendPhoto'), message: live ? t('messages.confirmLive', { name, app: appName }) : t('messages.photoManual', { app: appName }), confirmText: t('messages.send') });
    if (!ok) return;
    await run('photo', async () => {
      const asset = await importMedia(workspaceId!, { uri: a.uri, filename: a.fileName || `chat_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', sizeBytes: a.fileSize, width: a.width, height: a.height, source: 'phone_photos' }, { clientId: thread.client?.id, role: 'other', marketingPermission: 'private' });
      await createMessageReply(workspaceId!, thread.id, reply.trim(), true, { attachmentAssetId: asset.id, ...(replyTo ? { replyToMessageId: replyTo.id } : {}) });
      setReply(''); setReplyTo(null);
    });
  }
  async function react(message: ClientMessage, emoji: string) {
    setMenuFor(null);
    void Haptics.selectionAsync().catch(() => undefined);
    await run(`react-${message.id}`, () => toggleReaction(workspaceId!, message.id, emoji));
  }

  function onLongPress(message: ClientMessage) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setMenuFor(message);
  }
  function menuAction(kind: 'translate' | 'copy' | 'reply') {
    const message = menuFor; setMenuFor(null);
    if (!message) return;
    if (kind === 'translate') void run(`tr-${message.id}`, async () => {
      const result = await translateText(workspaceId!, message.body, appLang);
      if (result?.translation) setTranslations((prev) => ({ ...prev, [message.id]: { text: result.translation, shown: true } }));
    }, false);
    else if (kind === 'copy') void Clipboard.setStringAsync(message.body).then(() => toast.show({ title: t('common.copied'), tone: 'success' })).catch(() => undefined);
    else setReplyTo(message);
  }

  const showChip = pendingDraft && !draftHidden;
  const win = thread.send_window;
  const quota = win?.lineQuota;
  const quotaLeft = quota && quota.quota != null && quota.used != null ? Math.max(0, quota.quota - quota.used) : null;
  // Locked: Meta refuses after 7 days; LINE has no free reply token and the monthly quota is used up.
  const locked = live && (win?.metaWindow === 'closed' || (thread.platform === 'line' && quotaLeft === 0 && !win?.lineReplyFree));
  const banner = !live ? null
    : win?.metaWindow === 'closed' ? t('messages.windowClosed', { app: appName })
    : win?.metaWindow === 'human_agent' ? t('messages.windowAgent')
    : locked ? t('messages.lineQuotaOut')
    : thread.platform === 'line' && win?.lineReplyFree ? t('messages.lineFreeReply')
    : thread.platform === 'line' && quotaLeft != null && quotaLeft <= 50 ? t('messages.lineQuotaLeft', { count: quotaLeft })
    : null;
  const chips = (saved ?? []).slice(0, 3);
  async function retry(message: ClientMessage) {
    const ok = await dialog.confirm({ title: t('messages.retry'), message: t('messages.confirmLive', { name, app: appName }), confirmText: t('messages.send') });
    if (ok) await run(`retry-${message.id}`, () => approveReply(workspaceId!, message.id));
  }
  function statusLabel(m: ClientMessage) {
    if (m.status === 'sent') return t('messages.stSent');
    if (m.status === 'queued' && m.metadata?.delivery === 'manual') return t('messages.stManual');
    if (m.status === 'queued' || busy === `retry-${m.id}`) return t('messages.stSending');
    return null;
  }

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: night ? '#000000' : '#F3F3F3' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: night ? '#0B0B0C' : '#F3F3F3', borderBottomColor: night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', { defaultValue: 'Back' })} onPress={() => router.back()} style={styles.back}>
            <CaretLeft size={24} color={palette.text} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{name}</Text>
            {thread.platform !== 'other' ? <BrandLogo platform={thread.platform === 'facebook' ? 'messenger' : thread.platform as any} size={18} /> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('messages.aiDraft', { defaultValue: 'AI draft' })} disabled={Boolean(busy)} onPress={() => { setDraftHidden(false); if (pendingDraft) setDraftOpen(true); else void run('draft', async () => { await createAiReplyDraft(workspaceId, thread.id); setDraftOpen(true); }); }} style={styles.back}>
            <Sparkle size={24} color={palette.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('messages.contactInfo')} onPress={() => router.push(`/messages/info/${thread.id}` as any)} style={styles.back}>
            <DotsThree size={26} color={palette.text} weight="bold" />
          </Pressable>
        </View>
      </View>

      {(() => {
        // Day pills are sticky headers; the list is anchored to the bottom like iMessage.
        const items: Array<{ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: ClientMessage; first: boolean }> = [];
        let lastDay = ''; let lastDir = '';
        const dayLabel = (iso: string) => { const d = new Date(iso); const n = new Date(); const y = new Date(Date.now() - 86400000);
          return d.toDateString() === n.toDateString() ? t('messages.today', 'Today') : d.toDateString() === y.toDateString() ? t('messages.yesterday', 'Yesterday') : d.toLocaleDateString(appLang === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
        for (const m of visible) { const day = new Date(m.created_at).toDateString(); if (day !== lastDay) { items.push({ kind: 'day', key: `d-${day}`, label: dayLabel(m.created_at) }); lastDay = day; lastDir = ''; } items.push({ kind: 'msg', m, first: m.direction !== lastDir }); lastDir = m.direction; }
        const initials = contactInitials(name);
        return <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.thread} refreshControl={<RefreshControl refreshing={refreshing} tintColor={palette.muted} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {items.map((x) => {
            if (x.kind === 'day') return <View key={x.key} style={styles.dayWrap} pointerEvents="none"><Text style={[styles.dayPill, { backgroundColor: night ? '#2C2C2E' : '#E4E4E6', color: palette.text }]}>{x.label}</Text></View>;
            const message = x.m; const out = message.direction === 'outbound'; const tr = translations[message.id];
            return <SwipeReply key={message.id} night={night} label={t('messages.reply', { defaultValue: 'Reply' })} onReply={() => setReplyTo(message)}><View style={[styles.line, out && styles.lineOut]}>
              {!out ? (x.first ? <View style={[styles.inAvatar, { backgroundColor: night ? '#3A3A3D' : '#D1D1D6' }]}>{thread.contact_avatar_url ? <Image source={{ uri: thread.contact_avatar_url }} style={styles.inAvatarImg} /> : <Text style={[styles.inAvatarText, { color: palette.text }]}>{initials}</Text>}</View> : <View style={styles.inAvatarGap} />) : null}
              <Pressable onLongPress={() => onLongPress(message)} style={[styles.row, out && styles.rowOut]}>
                <View style={[styles.bubble, { backgroundColor: out ? outBg : incBg }, detail.attachments?.[message.id] && !message.body && { padding: 4 }]}>
                  {message.metadata?.reply_to ? <View style={[styles.inQuote, { borderLeftColor: out ? outText : incText }]}><Text numberOfLines={2} style={[styles.inQuoteText, { color: out ? '#3A3A3D' : night ? '#B8B8BD' : '#6C6C70' }]}>{message.metadata.reply_to.body}</Text></View> : null}
                  {detail.attachments?.[message.id] ? <Image accessibilityLabel={t('messages.photo')} source={{ uri: detail.attachments[message.id] }} style={styles.photo} resizeMode="cover" /> : message.metadata?.attachment ? <Text style={[styles.body, { color: out ? outText : incText }]}>{t('messages.photoUnavailable')}</Text> : null}
                  {message.body ? <Text style={[styles.body, { color: out ? outText : incText }, JP_FONT(message.body)]}>{message.body}</Text> : null}
                </View>
                {detail.reactions?.[message.id]?.length ? <Text accessibilityLabel={t('messages.reactions', { list: detail.reactions[message.id].join(' ') })} style={[styles.reacts, { backgroundColor: night ? '#2C2C2E' : '#FFFFFF' }]}>{detail.reactions[message.id].join(' ')}</Text> : null}
                {tr?.shown ? <Text style={[styles.meaning, { color: night ? '#9A9A9F' : '#6C6C70' }]}>{tr.text}</Text> : null}
                {out && message.status === 'failed' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('messages.retryA11y')} onPress={() => void retry(message)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={styles.failRow}>
                    <Text style={[styles.time, { color: palette.text, fontWeight: '600' }]}>{t('messages.stFailed')} · {t('messages.retry')}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.time, { color: night ? '#9A9A9F' : '#6C6C70' }]}>{timeLabel(message.created_at)}{out && statusLabel(message) ? ` · ${statusLabel(message)}` : ''}</Text>
                )}
              </Pressable>
            </View></SwipeReply>;
          })}
          {outbox.map((q) => <View key={q.key} style={[styles.line, styles.lineOut]}><View style={[styles.row, styles.rowOut]}>
            <View style={[styles.bubble, { backgroundColor: outBg, opacity: 0.6 }]}><Text style={[styles.body, { color: outText }, JP_FONT(q.body)]}>{q.body}</Text></View>
            <Text style={[styles.time, { color: night ? '#9A9A9F' : '#6C6C70' }]}>{t('messages.stWaiting')}</Text>
          </View></View>)}
        </ScrollView>;
      })()}

      {showChip ? (
        <View style={[styles.chip, night && { backgroundColor: '#161618', borderColor: 'rgba(255,255,255,0.10)' }]}>
          <Pressable onPress={() => setDraftOpen((v) => !v)} style={{ flex: 1 }}>
            <Text style={[styles.chipText, { color: palette.text }]}>{draftOpen ? t('messages.hideDraft') : t('messages.aiDraft', { defaultValue: 'AI draft' })}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('messages.closeDraft')} onPress={() => { setDraftHidden(true); setDraftOpen(false); }} hitSlop={8} style={styles.close}>
            <Text style={[styles.closeText, { color: night ? '#9A9A9F' : '#8A8A8E' }]}>×</Text>
          </Pressable>
        </View>
      ) : null}
      {draftOpen && pendingDraft && !draftHidden ? (
        <View style={[styles.draft, night && { backgroundColor: '#161618' }]}>
          <Text style={[styles.draftText, { color: palette.text }, JP_FONT(pendingDraft.body)]}>{pendingDraft.body}</Text>
          {pendingDraft.translated_body && isJapanese(pendingDraft.body) ? <Text style={[styles.meaning, { color: night ? '#9A9A9F' : '#6C6C70', fontSize: 14, lineHeight: 19 }]}>{t('messages.means', { text: pendingDraft.translated_body })}</Text> : null}
          <View style={styles.draftRow}>
            <Pressable accessibilityRole="button" onPress={() => { setReply(pendingDraft.body); setDraftOpen(false); }} style={styles.draftHit}><Text style={[styles.draftBtn, { color: palette.text }]}>{t('messages.useDraft')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void run('draft', () => createAiReplyDraft(workspaceId, thread.id))} style={styles.draftHit}><Text style={[styles.draftBtn, { color: palette.text }]}>{t('messages.newDraft')}</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h !== bottomH) { setBottomH(h); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30); } }}>
      {replyTo ? (
        <View style={[styles.quote, { backgroundColor: night ? '#0B0B0C' : '#EBEBED' }]}>
          <View style={[styles.quoteLine, { backgroundColor: palette.text }]} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.quoteTitle, { color: palette.text }]}>{t('messages.replyingTo', { name: replyTo.direction === 'outbound' ? t('messages.yourself', { defaultValue: 'yourself' }) : name, defaultValue: 'Replying to {{name}}' })}</Text>
            <Text numberOfLines={1} style={[styles.quoteBody, { color: night ? '#9A9A9F' : '#6C6C70' }]}>{replyTo.body}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close', { defaultValue: 'Close' })} onPress={() => setReplyTo(null)} style={styles.back}>
            <X size={20} color={night ? '#9A9A9F' : '#6C6C70'} />
          </Pressable>
        </View>
      ) : null}
      {!replyTo && !reply && !locked && !pendingDraft ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggest} keyboardShouldPersistTaps="handled">
          {(['times', 'price', 'thanks'] as const).map((k) => <Pressable key={k} accessibilityRole="button" accessibilityLabel={t('messages.aiChipA11y', { label: t(`messages.ai_${k}`) })} accessibilityHint={t('messages.aiChipHint')} disabled={Boolean(busy) || !online} onPress={() => { setDraftHidden(false); void run('draft', async () => { await createAiReplyDraft(workspaceId, thread.id, k); setDraftOpen(true); }); }} style={[styles.suggestChip, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }, (Boolean(busy) || !online) && { opacity: 0.5 }]}><Text numberOfLines={1} style={[styles.chipText, { color: palette.text }]}>{busy === 'draft' ? t('messages.aiChipBusy') : `✦ ${t(`messages.ai_${k}`)}`}</Text></Pressable>)}
          {chips.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('messages.useSaved', { title: item.title })} onPress={() => insertSaved(item)} style={[styles.suggestChip, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF', borderColor: night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><Text numberOfLines={1} style={[styles.chipText, { color: palette.text }]}>{item.title}</Text></Pressable>)}
        </ScrollView>
      ) : null}
      {!online ? <Text accessibilityLiveRegion="polite" style={[styles.banner, { color: palette.text, backgroundColor: night ? '#1C1C1E' : '#E4E4E6' }]}>{t('messages.offline')}</Text> : null}
      {banner ? <Text accessibilityRole="text" style={[styles.banner, { color: night ? '#9A9A9F' : '#6C6C70', backgroundColor: night ? '#0B0B0C' : '#EBEBED' }]}>{banner}</Text> : null}
      {dictation.listening ? <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', color: palette.muted, fontSize: 13, paddingTop: 6 }}>{t('messages.dictating')}</Text> : null}
      <ChatBar value={reply} onChangeText={setReply} placeholder={t('messages.placeholder', { defaultValue: 'Message' })} onSend={() => void send()} disabled={Boolean(busy) || locked} onPlus={() => setShowPlus(true)} recording={dictation.listening} onHoldStart={() => void dictation.start()} onHoldEnd={() => dictation.stop()} />
      </View>

      <Modal visible={Boolean(menuFor)} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable accessibilityLabel={t('common.close', { defaultValue: 'Close' })} style={styles.menuBackdrop} onPress={() => setMenuFor(null)}>
          <View style={[styles.menuCard, { backgroundColor: night ? '#1C1C1E' : '#FFFFFF' }]}>
            {detail.reactionsAvailable !== false ? <View style={styles.reactBar} accessibilityRole="toolbar">
              {REACTIONS.map((e) => { const on = Boolean(menuFor && detail.reactions?.[menuFor.id]?.includes(e)); return <Pressable key={e} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t('messages.reactWith', { emoji: e })} onPress={() => menuFor && void react(menuFor, e)} style={[styles.reactBtn, on && { backgroundColor: night ? '#3A3A3D' : '#E4E4E6' }]}><Text style={styles.reactEmoji}>{e}</Text></Pressable>; })}
            </View> : null}
            {(['reply', 'copy', 'translate'] as const).map((k) => <Pressable key={k} accessibilityRole="button" onPress={() => menuAction(k)} style={styles.menuRow}><Text style={[styles.plusTitle, { color: palette.text }]}>{k === 'reply' ? t('messages.reply', { defaultValue: 'Reply' }) : k === 'copy' ? t('common.copy', { defaultValue: 'Copy' }) : t('messages.translate')}</Text></Pressable>)}
          </View>
        </Pressable>
      </Modal>

      <ChatTools visible={showPlus} onClose={() => setShowPlus(false)} night={night}>
        <Pressable accessibilityRole="button"  accessibilityLabel={t('messages.savedReplies')} onPress={() => void openSaved()} style={styles.plusRow}>
          <Text style={[styles.plusTitle, { color: palette.text }]}>{t('messages.savedReplies')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('messages.photo')} onPress={() => void openPhoto()} style={styles.plusRow}>
          <Text style={[styles.plusTitle, { color: palette.text }]}>{t('messages.photo')}</Text>
        </Pressable>
      </ChatTools>

      <ChatTools visible={showSaved} onClose={() => setShowSaved(false)} night={night}>
        {saved === null ? <Text style={{ color: palette.muted }}>{t('messages.loading')}</Text> : null}
        {saved?.length === 0 ? <Text style={{ color: palette.muted }}>{t('messages.noSaved')}</Text> : null}
        {saved?.map((item) => <Pressable key={item.id} onPress={() => insertSaved(item)} style={styles.saved}><Text style={[styles.savedTitle, { color: palette.text }]}>{item.title}</Text></Pressable>)}
      </ChatTools>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingLeft: 44 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingVertical: 6 },
  quoteLine: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  quoteTitle: { fontSize: 14, fontWeight: '600' },
  quoteBody: { fontSize: 14 },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  chevron: { fontSize: 28, lineHeight: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E4E4E6', justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' },
  avatarImg: { width: 32, height: 32 },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#151515' },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subText: { fontSize: 12, lineHeight: 16 },
  open: { paddingHorizontal: 10, height: 32, justifyContent: 'center' },
  openText: { fontSize: 15, fontWeight: '600' },
  thread: { flexGrow: 1, justifyContent: 'flex-end', padding: 12, gap: 8, paddingBottom: 16 },
  dayWrap: { alignItems: 'center', paddingVertical: 6 },
  dayPill: { overflow: 'hidden', fontSize: 13, fontWeight: '500', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineOut: { justifyContent: 'flex-end' },
  inAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inAvatarImg: { width: 32, height: 32 },
  inAvatarText: { fontSize: 12, fontWeight: '600' },
  inAvatarGap: { width: 32 },
  row: { alignItems: 'flex-start', gap: 2, maxWidth: '78%' },
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
  err: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  retryBig: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  failRow: { minHeight: 22, justifyContent: 'center' },
  draftHit: { minHeight: 44, justifyContent: 'center', paddingRight: 8 },
  suggest: { gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  suggestChip: { minHeight: 36, maxWidth: 220, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  inQuote: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 6, opacity: 0.85 },
  inQuoteText: { fontSize: 13, lineHeight: 17 },
  photo: { width: 220, height: 220, borderRadius: 16, marginBottom: 2 },
  reacts: { alignSelf: 'flex-start', overflow: 'hidden', marginTop: -6, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, fontSize: 13 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  menuCard: { borderRadius: 16, paddingVertical: 8, overflow: 'hidden' },
  reactBar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(127,127,127,0.25)' },
  reactBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactEmoji: { fontSize: 24 },
  menuRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20 },
  banner: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 8 }
});
