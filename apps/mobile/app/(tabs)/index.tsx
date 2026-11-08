import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { NoStudio } from '../../src/components/NoStudio';
import { BusinessSwitcher } from '../../src/components/BusinessSwitcher';
import { ChatBar } from '../../src/components/ChatBar';
import { VoiceOrb } from '../../src/components/VoiceOrb';
import { AnswerCard, type ToolCard } from '../../src/components/AnswerCard';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { useRole } from '../../src/lib/me';
import { supabase } from '../../src/lib/supabase';
import { getHomeSummary, type HomeSummary } from '../../src/lib/home';
import { listContent, type ContentPost } from '../../src/lib/content';
import { approveAiAction, cancelAiAction, createConversation, listAiMessages, listAiTools, sendAiMessage, type AiActionProposal, type AiMessage, type AiTool } from '../../src/lib/ai';
import { useDictation } from '../../src/lib/dictation';
import { useKeyboardOpen } from '../../src/lib/useKeyboardOpen';
import { useInsets } from '../../src/lib/insets';
import { timeJst } from '../../src/lib/jst';
import { tokens } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';
import { usePersistentVoice } from '../../src/components/PersistentVoice';

export const GREEN = '#151515';

/** Tools offered behind the composer + (they only fill the composer; she still sends and approves). */
const V1_TOOL_KEYS = new Set(['create_post_draft', 'draft_client_message', 'block_time', 'propose_memory', 'update_assistant_name']);
const convKey = (ws: string) => `angelos.ai.lastConversation.${ws}`;
const ORB = 88;

type FactsState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; sum: HomeSummary; failed: ContentPost | null };
type ChatState = 'loading' | 'ready' | 'error';

/** Locked mixed Home (2026-11-08): today's facts strip + the assistant conversation, live voice and a pinned composer. */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const insets = useInsets();
  const keyboardOpen = useKeyboardOpen();
  const role = useRole();
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [ws, setWs] = useState<string | null>(null);
  const [noStudio, setNoStudio] = useState(false);
  const [facts, setFacts] = useState<FactsState>({ state: 'loading' });
  const [chat, setChat] = useState<ChatState>('loading');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [assistantName] = useState('AngelOS');
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [action, setAction] = useState<AiActionProposal | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const persist = usePersistentVoice();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keepScroll = useRef<number | null>(null);
  const orbRef = useRef<View>(null);
  const wsRef = useRef<string | null>(null);
  const composerRef = useRef(''); composerRef.current = composer;
  const dictation = useDictation(() => composerRef.current, setComposer, i18n.language?.startsWith('ja') ? 'ja' : 'en');

  /** Facts only: pull-down and Try again never touch the chat or the typed text. */
  const loadFacts = useCallback(async (id: string) => {
    setFacts((f) => (f.state === 'ready' ? f : { state: 'loading' }));
    try {
      const [sum, posts] = await Promise.all([getHomeSummary(id, 'day'), listContent(id).catch(() => [] as ContentPost[])]);
      if (wsRef.current !== id) return; // a business change happened meanwhile; never mix studios
      const failed = (posts ?? []).find((p) => p.status === 'failed' || (p.variants ?? []).some((v: any) => v.status === 'failed')) ?? null;
      setFacts({ state: 'ready', sum, failed });
    } catch { if (wsRef.current === id) setFacts({ state: 'error' }); }
  }, []);

  const loadChat = useCallback(async (id: string) => {
    setChat('loading');
    try {
      const saved = await AsyncStorage.getItem(convKey(id)).catch(() => null);
      let past: AiMessage[] = [];
      let conv = saved;
      if (saved) past = (await listAiMessages(id, saved).catch(() => null)) ?? [];
      if (!saved || !past.length) { conv = (await createConversation(id, { screen: 'home' })).id; void AsyncStorage.setItem(convKey(id), conv).catch(() => undefined); past = []; }
      if (wsRef.current !== id) return;
      setConversationId(conv); setMessages(past); setChat('ready');
    } catch { if (wsRef.current === id) setChat('error'); }
  }, []);

  const load = useCallback(async () => {
    try {
      const w = await getActiveWorkspace();
      const changed = wsRef.current !== w.id;
      wsRef.current = w.id; setWs(w.id); setNoStudio(false);
      if (changed) {
        // Another business: its own facts and conversation only. The typed draft stays hers.
        setMessages([]); setAction(null); setConversationId(null); setFacts({ state: 'loading' }); setSendError(null);
        void listAiTools(w.id).then((r) => setTools(r.tools.filter((x) => V1_TOOL_KEYS.has(x.key)))).catch(() => setTools([]));
        await Promise.all([loadFacts(w.id), loadChat(w.id)]);
      } else await loadFacts(w.id);
    } catch (e) { if (isNoWorkspace(e)) setNoStudio(true); else setFacts({ state: 'error' }); }
  }, [loadFacts, loadChat]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setSignedIn(Boolean(data.session)); setSessionReady(true); if (data.session) void load(); });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => { if (!mounted) return; setSignedIn(Boolean(s)); setSessionReady(true); });
    return () => { mounted = false; l.subscription.unsubscribe(); };
  }, [load]);
  useEffect(() => { if (role === 'student') router.replace('/profile' as any); }, [role]);

  /** Sending only asks the assistant. Anything it proposes comes back as a card that needs Approve. */
  async function send(again?: string) {
    const text = (again ?? composer).trim();
    if (!text || !ws || !conversationId || busy) return;
    const id = ws;
    setBusy(true); setSendError(null);
    const mine: AiMessage = { id: `local-${Date.now()}`, author_type: 'user', content: text, metadata: {}, created_at: new Date().toISOString() };
    if (!again) setMessages((m) => [...m, mine]);
    try {
      const r = await sendAiMessage(id, conversationId, text, { screen: 'home' });
      if (wsRef.current !== id) return;
      if (!again) setComposer((c) => (c.trim() === text ? '' : c));
      setMessages((m) => [...m, r.message]); setAction(r.action);
    } catch {
      // Keep her words in the composer so Retry or Edit never loses them.
      if (!again) { setMessages((m) => m.filter((x) => x.id !== mine.id)); setComposer(text); }
      setSendError(text);
    } finally { setBusy(false); }
  }

  async function resolve(approved: boolean) {
    if (!ws || !action) return;
    setActionBusy(true);
    try {
      if (approved) await approveAiAction(ws, action.id); else await cancelAiAction(ws, action.id);
      setMessages((m) => [...m, { id: `action-${action.id}`, author_type: 'system_action', metadata: {}, created_at: new Date().toISOString(),
        content: approved ? (action.kind === 'draft' ? t('home2.doneDraft', 'Approved. The draft is ready for you to check. Nothing was sent or posted.') : t('home2.doneChange', 'Approved and saved.')) : t('home2.notNow', 'Not now. Nothing changed.') }]);
      setAction(null);
    } catch { setMessages((m) => [...m, { id: `action-err-${Date.now()}`, author_type: 'system_action', metadata: {}, created_at: new Date().toISOString(), content: t('home2.actionErr', 'That could not be saved. Nothing changed. Try again.') }]); }
    finally { setActionBusy(false); }
  }
  function edit() {
    if (!action) return;
    const lastMine = [...messages].reverse().find((m) => m.author_type === 'user');
    setComposer(lastMine?.content ?? action.summary ?? '');
    if (ws) void cancelAiAction(ws, action.id).catch(() => undefined);
    setAction(null);
  }

  const openVoice = useCallback(() => { keepScroll.current = scrollY.current; void persist.startOrExpand({ screen: 'home' }); }, [persist]);
  useEffect(() => {
    if (persist.presentation === 'overlay' || keepScroll.current == null) return;
    const y = keepScroll.current;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      const node = Platform.OS !== 'web' && orbRef.current ? findNodeHandle(orbRef.current) : null;
      if (node && persist.presentation === 'hidden') AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [persist.presentation]);

  // A new answer, card or error scrolls into view (voice open/close never triggers this, so Home keeps its scroll).
  useEffect(() => {
    if (!messages.length && !sendError && !action) return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, sendError, action]);

  async function refresh() {
    if (!ws) return;
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (!sessionReady) return <View style={[styles.fill, { backgroundColor: palette.bg }]} />;
  if (!signedIn) return <Redirect href="/login" />;

  const tabH = 49 + Math.max(insets.bottom, 34);
  const now = new Date();
  const jaUi = i18n.language === 'ja';
  const part = (o: Intl.DateTimeFormatOptions) => now.toLocaleDateString(jaUi ? 'ja-JP' : 'en-GB', { ...o, timeZone: 'Asia/Tokyo' });
  const dateLine = `${jaUi ? part({ month: 'long', day: 'numeric', weekday: 'long' }) : `${part({ weekday: 'long' })}, ${part({ day: 'numeric', month: 'long' })}`} · JST`;
  const sum = facts.state === 'ready' ? facts.sum : null;
  const pendingApprovals = sum?.assistant.pendingApprovals ?? 0;
  const chatEmpty = chat === 'ready' && messages.length === 0;
  const prompts = [t('home2.p1', 'What’s on today?'), t('home2.p2', 'Any unread I should see?'), t('home2.p3', 'What needs me?')];
  const text = palette.text, muted = palette.muted;
  const card = { backgroundColor: palette.glass, borderColor: palette.border };

  return <View style={[styles.fill, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
    {/* Header: business picker, New booking, Notifications */}
    <View style={styles.header}>
      <View style={{ flexShrink: 1 }}><BusinessSwitcher onChanged={() => void load()} /></View>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('nav.newBooking', 'New booking')} onPress={() => router.push('/bookings/new' as any)} style={styles.hit}><Plus size={24} color={text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={pendingApprovals ? t('home2.bellN', { defaultValue: 'Notifications, {{n}} new', n: pendingApprovals }) : t('top.notifications', 'Notifications')} onPress={() => router.push('/notifications' as any)} style={styles.hit}>
        <Bell size={24} color={text} />{pendingApprovals ? <View style={[styles.dot, { backgroundColor: text, borderColor: palette.bg }]} /> : null}
      </Pressable>
    </View>
    {noStudio ? <View style={{ padding: 16 }}><NoStudio /></View> : <>
      {/* Pinned Today strip */}
      <View style={styles.todayRow}>
        <Text accessibilityRole="header" style={[styles.today, { color: text }]}>{t('home.today', 'Today')}</Text>
        <Text style={[styles.date, { color: muted }]}>{dateLine}</Text>
      </View>
      <View style={[styles.strip, card]}>
        {facts.state === 'loading' ? [0, 1, 2].map((i) => <View key={i} accessible accessibilityLabel={i === 0 ? t('home2.loadingToday', 'Loading today') : undefined} style={[styles.cell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }]}>
          <Bone w="60%" h={14} /><Bone w="72%" h={20} /><Bone w="82%" h={10} /><Bone w="56%" h={10} />
        </View>)
        : facts.state === 'error' ? <View style={styles.errRow} accessibilityLiveRegion="polite">
          <View style={{ flex: 1, gap: 4 }}><Text style={[styles.errTitle, { color: text }]}>{t('home2.factsErr', 'Today couldn’t load')}</Text><Text style={[styles.small, { color: muted }]}>{t('home2.stillWorks', 'Your assistant still works.')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('home2.tryAgain', 'Try again')} onPress={() => ws && void loadFacts(ws)} style={[styles.retry, { borderColor: palette.border, backgroundColor: palette.bg }]}><ArrowsClockwise size={18} color={text} /><Text style={[styles.retryText, { color: text }]}>{t('home2.tryAgain', 'Try again')}</Text></Pressable>
        </View>
        : <Facts sum={facts.sum} failed={facts.failed} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEventThrottle={64} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={muted} /> : undefined}>
          <View style={styles.assistantRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.overline, { color: muted }]}>{t('home2.yourAssistant', 'Your assistant')}</Text>
              <Text accessibilityRole="header" style={[styles.name, { color: text }]}>{assistantName}</Text>
              <Text style={[styles.sub, { color: muted }]}>{t('home2.chatOrTalk', 'Chat or talk, right here.')}</Text>
            </View>
            <Pressable ref={orbRef} accessibilityRole="button" accessibilityLabel={t('home2.talkLive', 'Talk live')} accessibilityHint="Talk live. Minimize keeps voice on. End stops voice." onPress={openVoice} style={styles.orbHit}>
              <View style={styles.orbBox}><View style={{ transform: [{ scale: ORB / 300 }] }}><VoiceOrb size={260} /></View></View>
              <Text style={[styles.talk, { color: muted }]}>{t('home2.talkLive', 'Talk live')}</Text>
            </Pressable>
          </View>

          {chat === 'loading' ? <View accessible accessibilityLabel={t('home2.loadingChat', 'Loading your conversation')} style={{ gap: 14 }}>
            <View style={{ alignSelf: 'flex-end', width: '50%' }}><Bone w="100%" h={44} r={22} /></View>
            <Bone w="76%" h={16} /><Bone w="94%" h={16} /><Bone w="88%" h={16} /><Bone w="68%" h={16} />
            <Text style={[styles.small, { color: muted }]}>{t('home2.loadingConv', 'Loading your conversation…')}</Text>
          </View> : null}
          {chat === 'error' ? <View style={[styles.chatErr, card]} accessibilityLiveRegion="polite">
            <Text style={[styles.errTitle, { color: text }]}>{t('home2.chatErr', 'Your conversation couldn’t load')}</Text>
            <Text style={[styles.small, { color: muted }]}>{t('home2.chatErrSub', 'Your typed text is kept.')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home2.retryChat', 'Retry')} onPress={() => ws && void loadChat(ws)} style={[styles.retry, { borderColor: palette.border, backgroundColor: palette.bg, alignSelf: 'flex-start' }]}><ArrowsClockwise size={18} color={text} /><Text style={[styles.retryText, { color: text }]}>{t('home2.retryChat', 'Retry')}</Text></Pressable>
          </View> : null}

          {chatEmpty ? <View style={{ gap: 12 }}>
            <Text style={[styles.help, { color: text }]}>{facts.state === 'error' ? t('home2.hereToHelp', 'I’m here to help.') : t('home2.howHelp', 'How can I help today?')}</Text>
            <Text style={[styles.helpSub, { color: muted }]}>{facts.state === 'error' ? t('home2.factsMissing', 'Today’s facts haven’t loaded. You can still ask me a question.') : t('home2.askOrTap', 'Ask about your studio, or tap the orb to talk.')}</Text>
            <View style={{ gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
              {/* Chips only fill the composer for review; they never run anything. */}
              {prompts.map((p) => <Pressable key={p} accessibilityRole="button" accessibilityHint={t('home2.chipHint', 'Puts this in the message box')} onPress={() => setComposer(p)} style={[styles.chip, card]}><Text style={[styles.chipText, { color: text }]}>{p}</Text></Pressable>)}
            </View>
          </View> : null}

          {chat === 'ready' ? messages.map((m) => m.author_type === 'user'
            ? <View key={m.id} style={[styles.mine, { backgroundColor: night ? '#2C2C2E' : '#151515' }]}><Text style={[styles.mineText, { color: '#FFFFFF' }]}>{m.content}</Text></View>
            : m.author_type === 'system_action' ? <Text key={m.id} style={[styles.small, { color: muted }]}>{m.content}</Text>
            : <View key={m.id} style={{ gap: 10 }}>
              <Text style={[styles.overline, { color: muted }]}>{assistantName.toUpperCase()}</Text>
              <Text selectable style={[styles.reply, { color: text }]}>{m.content}</Text>
              {Array.isArray((m.metadata as any)?.cards) ? (m.metadata as any).cards.map((c: ToolCard, i: number) => <AnswerCard key={i} card={c} />) : null}
            </View>) : null}
          {busy ? <ActivityIndicator accessibilityLabel={t('home2.thinking', 'Your assistant is answering')} color={muted} style={{ alignSelf: 'flex-start' }} /> : null}
          {sendError && !busy ? <View style={[styles.chatErr, card]} accessibilityLiveRegion="polite">
            <Text style={[styles.errTitle, { color: text }]}>{t('home2.sendErr', 'Your assistant couldn’t answer')}</Text>
            <Text style={[styles.small, { color: muted }]}>{t('home2.sendErrSub', 'Your message is still in the box. Nothing was sent anywhere.')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home2.retryChat', 'Retry')} onPress={() => void send()} style={[styles.retry, { borderColor: palette.border, backgroundColor: palette.bg, alignSelf: 'flex-start' }]}><ArrowsClockwise size={18} color={text} /><Text style={[styles.retryText, { color: text }]}>{t('home2.retryChat', 'Retry')}</Text></Pressable>
          </View> : null}
          {action ? <View style={[styles.chatErr, card]}>
            <Text style={[styles.small, { color: muted }]}>{action.kind === 'draft' ? t('home2.draftOnly', 'Draft only. Nothing is sent or posted until you approve it.') : t('home2.nothingChanges', 'Nothing changes until you tap Approve.')}</Text>
            <Text style={[styles.reply, { color: text }]}>{action.summary ?? action.action_key}</Text>
            <View style={styles.actRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home2.edit', 'Edit')} disabled={actionBusy} onPress={edit} style={styles.actBtn}><Text style={[styles.retryText, { color: text }]}>{t('home2.edit', 'Edit')}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home2.notNowBtn', 'Not now')} disabled={actionBusy} onPress={() => void resolve(false)} style={styles.actBtn}><Text style={[styles.retryText, { color: text }]}>{t('home2.notNowBtn', 'Not now')}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home2.approve', 'Approve')} disabled={actionBusy} onPress={() => void resolve(true)} style={[styles.actBtn, { backgroundColor: text }]}><Text style={[styles.retryText, { color: palette.bg }]}>{t('home2.approve', 'Approve')}</Text></Pressable>
            </View>
          </View> : null}
        </ScrollView>

        {/* Pinned composer: + (assistant tools), Ask AngelOS, hold-to-dictate mic, tap waveform for live voice. */}
        <View style={{ backgroundColor: palette.bg, paddingBottom: keyboardOpen ? 8 : tabH }}>
          {toolsOpen && tools.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tools}>
            {tools.map((x) => <Pressable key={x.key} accessibilityRole="button" onPress={() => { setComposer(t(`aip.toolEx_${x.key}`, x.example)); setToolsOpen(false); }} style={[styles.chip, card]}><Text style={[styles.chipText, { color: text }]}>{t(`aip.tool_${x.key}`, x.label)}</Text></Pressable>)}
          </ScrollView> : null}
          <ChatBar value={composer} onChangeText={(v) => { setComposer(v); if (sendError) setSendError(null); }} placeholder={t('aip.askAngelos', 'Ask AngelOS')} onSend={() => void send()} disabled={busy || chat !== 'ready'}
            onPlus={() => setToolsOpen((o) => !o)} plusLabel={t('home2.tools', 'Assistant tools')} onVoice={openVoice} recording={dictation.listening} onHoldStart={() => void dictation.start()} onHoldEnd={() => dictation.stop()} bottomInset={2} />
          <Text style={[styles.note, { color: muted }]}>{t('home2.approvalNote', 'Nothing is sent or posted without your approval.')}</Text>
        </View>
      </KeyboardAvoidingView>
    </>}
    {/* Home live voice: Home-scoped (not a client chat). Every dismissal returns to this same Home; draft and scroll stay. */}
  </View>;
}

function Facts({ sum, failed }: { sum: HomeSummary; failed: ContentPost | null }) {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  const s = sum.schedule;
  const live = s.items.filter((it) => it.status !== 'cancelled');
  const next = s.next ?? live.find((it) => new Date(it.end_at).getTime() > Date.now()) ?? null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const unread = sum.messages.unread;
  const approvals = sum.assistant.pendingApprovals;
  const needs = failed
    ? { value: t('home2.failedPost', '1 failed post'), lines: [t('home2.failedSub1', 'Scheduled post'), t('home2.failedSub2', 'Review needed')], go: () => router.push(`/content/${failed.id}` as any) }
    : approvals
      ? { value: t('home2.toApprove', { defaultValue: '{{n}} to approve', n: approvals }), lines: [t('home2.draftsReady', 'Drafts are ready')], go: () => router.push('/suggestions' as any) }
      : null;
  const cells = [
    { title: t('home2.bookings', 'Bookings'), value: live.length ? t('home2.nToday', { defaultValue: '{{n}} today', n: live.length }) : t('home2.noBookings', 'No bookings'),
      lines: live.length && next ? [`${t('home2.next', 'Next')} · ${timeJst(next.start_at)} JST`, next.service ?? next.client ?? ''] : [t('home2.todayOpen', 'Today is open')],
      go: () => router.push({ pathname: '/calendar', params: { day: today } } as any) },
    { title: t('home2.messages', 'Messages'), value: unread ? t('home2.nUnread', { defaultValue: '{{n}} unread', n: unread }) : t('home2.noUnread', 'No unread'),
      lines: unread ? [t('home2.waiting', 'Waiting for your reply')] : [t('home2.caughtUp', 'All caught up')], go: () => router.push('/messages' as any) },
    { title: t('home2.needsYou', 'Needs you'), value: needs?.value ?? t('home2.allClear', 'All clear'), lines: needs?.lines ?? [t('home2.nothingWaiting', 'Nothing waiting')], go: needs?.go ?? null }
  ];
  return <>{cells.map((c, i) => {
    const body = <>
      <Text style={[styles.cellTitle, { color: palette.muted }]}>{c.title}</Text>
      <Text style={[styles.cellValue, { color: palette.text }]}>{c.value}</Text>
      {c.lines.filter(Boolean).map((l, j) => <Text key={j} style={[styles.cellLine, { color: palette.muted }]}>{l}</Text>)}
    </>;
    const style = [styles.cell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }];
    // "All clear" is status text, not a dead button.
    return c.go ? <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.value}. ${c.lines.join('. ')}`} onPress={c.go} style={({ pressed }) => [...style, pressed && { backgroundColor: palette.fill }]}>{body}</Pressable>
      : <View key={i} accessible accessibilityLabel={`${c.title}, ${c.value}`} style={style}>{body}</View>;
  })}</>;
}

function Bone({ w, h, r = 6 }: { w: number | `${number}%`; h: number; r?: number }) {
  const { mode } = useAppearance();
  return <View style={{ width: w, height: h, borderRadius: r, backgroundColor: mode === 'night' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, gap: 4 },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 8, gap: 8 },
  today: { fontFamily: tokens.font.uiBold, fontSize: 20, lineHeight: 26 },
  date: { fontFamily: tokens.font.ui, fontSize: 12, lineHeight: 16 },
  strip: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', minHeight: 100 },
  cell: { flex: 1, minHeight: 100, paddingHorizontal: 10, paddingVertical: 12, gap: 4 },
  cellTitle: { fontFamily: tokens.font.uiMedium, fontSize: 13, lineHeight: 17 },
  cellValue: { fontFamily: tokens.font.uiBold, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  cellLine: { fontFamily: tokens.font.ui, fontSize: 11.5, lineHeight: 15 },
  errRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  errTitle: { fontFamily: tokens.font.uiBold, fontSize: 16, lineHeight: 21 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  retryText: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  chat: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 16 },
  assistantRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overline: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  name: { fontFamily: tokens.font.uiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  sub: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 19 },
  orbHit: { alignItems: 'center', minWidth: 96, minHeight: 44, gap: 4 },
  orbBox: { width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  talk: { fontFamily: tokens.font.ui, fontSize: 12 },
  help: { fontFamily: tokens.font.uiBold, fontSize: 22, lineHeight: 28 },
  helpSub: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  chipText: { fontFamily: tokens.font.uiMedium, fontSize: 15 },
  mine: { alignSelf: 'flex-end', maxWidth: '82%', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
  mineText: { fontFamily: tokens.font.uiMedium, fontSize: 16, lineHeight: 21 },
  reply: { fontFamily: tokens.font.ui, fontSize: 17, lineHeight: 24 },
  small: { fontFamily: tokens.font.ui, fontSize: 13.5, lineHeight: 19 },
  chatErr: { gap: 8, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  actRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  actBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tools: { gap: 8, paddingHorizontal: 16, paddingTop: 6 },
  note: { fontFamily: tokens.font.ui, fontSize: 11, lineHeight: 14, textAlign: 'center', paddingBottom: 6 }
});
