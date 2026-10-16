import { Waveform } from 'phosphor-react-native/src/icons/Waveform';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { NotePencil } from 'phosphor-react-native/src/icons/NotePencil';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare';
import { Copy } from 'phosphor-react-native/src/icons/Copy';
import { SpeakerHigh } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { ThumbsUp } from 'phosphor-react-native/src/icons/ThumbsUp';
import { ThumbsDown } from 'phosphor-react-native/src/icons/ThumbsDown';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dialog } from '../src/lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { ContactAvatar } from '../src/components/BrandBadge';
import { getHomeSummary, type HomeSummary } from '../src/lib/home';
import { getMe } from '../src/lib/me';
import { D, tokens } from '../src/design/theme';
import {
  approveAiAction,
  cancelAiAction,
  createConversation,
  getAssistantProfile,
  listAiTools,
  type AiTool,
  sendAiMessage,
  type AiActionProposal,
  type AiMessage,
  type AiScreenContext
} from '../src/lib/ai';
import { getActiveWorkspace } from '../src/lib/workspace';

export default function AiScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ screen?: string; entityType?: string; entityId?: string; entityLabel?: string }>();
  const screenContext: AiScreenContext = {
    screen: params.screen ?? 'ai',
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel
  };
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState('AngelOS');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [action, setAction] = useState<AiActionProposal | null>(null);
  const [busy, setBusy] = useState(true);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [alerts, setAlerts] = useState<HomeSummary['messages']['alerts'] | null>(null);
  const [approvals, setApprovals] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(true);
  const [showAllTools, setShowAllTools] = useState(false);
  const [rated, setRated] = useState<Record<string, 'up' | 'down'>>({});
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /** Dictation into the composer where the browser supports it; otherwise open voice. */
  function dictate() {
    const g: any = globalThis as any; const SR = g.SpeechRecognition ?? g.webkitSpeechRecognition;
    if (Platform.OS !== 'web' || !SR) { router.push('/voice' as any); return; }
    const r = new SR(); r.lang = i18n.language === 'ja' ? 'ja-JP' : 'en-US'; r.interimResults = false;
    r.onresult = (e: any) => setComposer((c) => `${c}${c ? ' ' : ''}${e.results?.[0]?.[0]?.transcript ?? ''}`);
    r.onend = () => setListening(false); setListening(true); r.start();
  }

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    try {
      const workspace = await getActiveWorkspace();
      setWorkspaceId(workspace.id);
      const [{ profile }, conversation] = await Promise.all([
        getAssistantProfile(workspace.id),
        createConversation(workspace.id, screenContext)
      ]);
      setAssistantName(profile.display_name);
      void listAiTools(workspace.id).then((r) => setTools(r.tools)).catch(() => undefined);
      void getHomeSummary(workspace.id, 'day').then((h) => { setAlerts(h.messages.alerts.filter((x) => x.needsReply || x.unread)); setApprovals(h.assistant.pendingApprovals); }).catch(() => setAlerts([]));
      void getMe().then((m: any) => setOwner(((m?.displayName ?? '') as string).trim().split(/\s+/)[0] || null)).catch(() => undefined);
      setConversationId(conversation.id);
      setMessages([
        {
          id: 'welcome',
          author_type: 'assistant',
          content: `Tell me what you're trying to get done. You don't need to know the perfect question. I'll help you figure out the next useful step.`,
          metadata: {},
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      void dialog.notify('AI setup needs attention', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function send(again?: string) {
    const text = (again ?? composer).trim();
    if (!text || !workspaceId || !conversationId || busy) return;
    if (!again) setComposer('');
    setBusy(true);
    const optimistic: AiMessage = {
      id: `local-${Date.now()}`,
      author_type: 'user',
      content: text,
      metadata: {},
      created_at: new Date().toISOString()
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await sendAiMessage(workspaceId, conversationId, text, screenContext);
      setMessages((current) => [...current, result.message]);
      setAction(result.action); setActionOpen(true);
    } catch (error) {
      void dialog.notify('Could not reach your assistant', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function resolveAction(approved: boolean) {
    if (!workspaceId || !action) return;
    setBusy(true);
    try {
      if (approved) {
        const done = await approveAiAction(workspaceId, action.id);
        const result = done?.result ?? {};
        if (result.threadId) setTimeout(() => router.push(`/messages/${result.threadId}` as any), 400);
        else if (result.contentPostId) setTimeout(() => router.push(`/content/${result.contentPostId}` as any), 400);
        if (action.action_key === 'update_assistant_name') {
          const nextName = String(action.input.displayName ?? 'AngelOS');
          setAssistantName(nextName);
        }
      } else {
        await cancelAiAction(workspaceId, action.id);
      }
      setMessages((current) => [
        ...current,
        {
          id: `action-${Date.now()}`,
          author_type: 'system_action',
          content: approved ? (action.kind === 'draft' ? 'Done. The draft is ready for you to check. Nothing was sent or posted.' : 'Done and checked.') : 'Cancelled. Nothing changed.',
          metadata: { actionId: action.id },
          created_at: new Date().toISOString()
        }
      ]);
      setAction(null);
    } catch (error) {
      void dialog.notify('Action needs attention', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.author_type === 'assistant')?.id;
  const lastUser = [...messages].reverse().find((m) => m.author_type === 'user')?.content;
  const tasks: Task[] = [
    ...(action ? [{ key: 'action', title: action.summary ?? action.action_key, sub: t('aip.waitingApproval', 'Waiting for your approval'), icon: 'check' as const, onPress: () => setActionOpen(!actionOpen) }] : []),
    ...(alerts ?? []).slice(0, 3).map((x) => ({ key: x.id, title: t('aip.replyTo', { defaultValue: 'Reply to {{name}}', name: x.name }), sub: x.preview ?? '', name: x.name, platform: x.platform.toLowerCase(), onPress: () => router.push(`/messages/${x.id}` as any) })),
    ...(approvals ? [{ key: 'approvals', title: t('aip.approveN', { defaultValue: 'Approve {{n}} drafts', n: approvals }), sub: t('aip.draftsReady', 'Drafts are ready'), icon: 'check' as const, onPress: () => router.push('/suggestions' as any) }] : []),
  ];
  const chips = showAllTools ? tools : tools.slice(0, 3);

  return (
    <View style={styles.page}><SafeAreaView style={{ flex: 1 }}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common2.back', { defaultValue: 'Back' })} hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.navBtn}><CaretLeft size={24} color={D.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('aip.s1')} onPress={() => router.push('/ai-settings' as any)} style={styles.navTitle}>
          <Text style={styles.navLabel} numberOfLines={1}>{t('aip.assistant', 'Assistant')}</Text><CaretDown size={12} color={D.text} weight="bold" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('aip.newChat', 'New chat')} hitSlop={8} disabled={busy} onPress={() => { setMessages([]); setAction(null); setBusy(true); void initialize(); }} style={styles.navBtn}><NotePencil size={24} color={D.text} /></Pressable>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {screenContext.entityLabel ? <Text style={styles.note}>{t('aip.workingWith', { defaultValue: 'Working with: {{name}}', name: screenContext.entityLabel })}</Text> : null}
        {messages.map((message) => message.author_type === 'user'
          ? <View key={message.id} style={styles.mine}><Text style={styles.body}>{message.content}</Text></View>
          : message.author_type === 'system_action' ? <Text key={message.id} style={styles.note}>{message.content}</Text>
          : <View key={message.id} style={styles.reply}>
            <View style={styles.spark}><Sparkle size={16} color="#FFFFFF" weight="fill" /></View>
            <View style={{ flex: 1, gap: 12 }}>
              <Text style={styles.body}>{message.id === 'welcome' && tasks.length ? t('aip.tasksIntro', { defaultValue: '{{n}} things are waiting for you, {{name}}:', n: tasks.length, name: owner ?? '' }).replace(', :', ':') : message.content}</Text>
              {message.id === lastAssistant && tasks.length ? <View style={{ gap: 10 }}>{tasks.map((x) => <View key={x.key}>
                <Pressable accessibilityRole="button" onPress={x.onPress} style={styles.task}>
                  {x.name ? <ContactAvatar name={x.name} platform={x.platform} size={36} /> : <View style={styles.taskIcon}><CheckSquare size={20} color={D.text} /></View>}
                  <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={1} style={styles.taskTitle}>{x.title}</Text>{x.sub ? <Text numberOfLines={1} style={styles.taskSub}>{x.sub}</Text> : null}</View>
                  <CaretRight size={16} color={D.text} weight="bold" />
                </Pressable>
                {x.key === 'action' && actionOpen && action ? <View style={styles.approve}>
                  <Text style={styles.taskSub}>{action.kind === 'draft' ? t('aip.draftOnly', 'Approve makes a draft only. Nothing is sent or posted until you approve it again.') : t('aip.nothingChanges', 'Nothing changes until you tap Approve.')}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable disabled={busy} onPress={() => void resolveAction(true)} style={[styles.pillBtn, { backgroundColor: D.text }]}><Text style={[styles.pillText, { color: '#FFFFFF' }]}>{t('aip.s2')}</Text></Pressable>
                    <Pressable disabled={busy} onPress={() => void resolveAction(false)} style={[styles.pillBtn, { backgroundColor: D.fill }]}><Text style={styles.pillText}>{t('aip.s3')}</Text></Pressable>
                  </View>
                </View> : null}
              </View>)}</View> : null}
              {message.id === lastAssistant && message.id !== 'welcome' ? <>
                <Text style={styles.note}>{t('aip.nothingSent', 'Nothing is sent until you approve it.')}</Text>
                <View style={styles.acts}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('aip.copy', 'Copy')} hitSlop={6} onPress={() => { try { (globalThis as any).navigator?.clipboard?.writeText?.(message.content); } catch { /* ignore */ } }}><Copy size={18} color={D.muted} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('home.voice', 'Talk to your assistant')} hitSlop={6} onPress={() => router.push('/voice' as any)}><SpeakerHigh size={18} color={D.muted} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('aip.good', 'Good answer')} accessibilityState={{ selected: rated[message.id] === 'up' }} hitSlop={6} onPress={() => setRated({ ...rated, [message.id]: 'up' })}><ThumbsUp size={18} color={D.muted} weight={rated[message.id] === 'up' ? 'fill' : 'regular'} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('aip.bad', 'Not helpful')} accessibilityState={{ selected: rated[message.id] === 'down' }} hitSlop={6} onPress={() => setRated({ ...rated, [message.id]: 'down' })}><ThumbsDown size={18} color={D.muted} weight={rated[message.id] === 'down' ? 'fill' : 'regular'} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('aip.retry', 'Try again')} hitSlop={6} disabled={busy || !lastUser} onPress={() => lastUser && void send(lastUser)}><ArrowsClockwise size={18} color={D.muted} /></Pressable>
                </View>
              </> : null}
            </View>
          </View>)}
        {busy && messages.length ? <Text style={styles.note}>…</Text> : null}
      </ScrollView>
      <View style={styles.bottom}>
        {chips.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {chips.map((tool) => <Pressable key={tool.key} accessibilityRole="button" onPress={() => setComposer(tool.example)} style={styles.chip}><Sparkle size={12} color={D.text} weight="fill" /><Text style={styles.chipText}>{tool.label}</Text></Pressable>)}
        </ScrollView> : null}
        <View style={styles.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('aip.more', 'More actions')} hitSlop={6} onPress={() => setShowAllTools(!showAllTools)}><Plus size={22} color={D.text} /></Pressable>
          <TextInput placeholder={t('aip.ask', 'Ask anything')} placeholderTextColor={D.faint} value={composer} onChangeText={setComposer} onSubmitEditing={() => void send()} returnKeyType="send" style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('aip.dictate', 'Dictate')} hitSlop={6} onPress={dictate}><Microphone size={22} color={listening ? D.accentDeep : D.text} /></Pressable>
          {composer.trim() ? <Pressable disabled={busy} onPress={() => void send()} style={[styles.voiceBtn, busy && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel={busy ? 'Working' : 'Send'}><ArrowUp size={20} color="#FFFFFF" weight="bold" /></Pressable>
            : <Pressable accessibilityRole="button" accessibilityLabel={t('home.voice', 'Talk to your assistant')} onPress={() => router.push('/voice' as any)} style={styles.voiceBtn}><Waveform size={22} color="#FFFFFF" weight="bold" /></Pressable>}
        </View>
      </View>
    </SafeAreaView></View>
  );
}

type Task = { key: string; title: string; sub: string; name?: string; platform?: string; icon?: 'check'; onPress: () => void };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: D.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, height: 56 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 },
  navLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: D.text },
  thread: { padding: 16, gap: 20, paddingBottom: 24 },
  mine: { alignSelf: 'flex-end', maxWidth: '75%', backgroundColor: D.fill, paddingHorizontal: 16, paddingVertical: 12, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 6, borderBottomLeftRadius: 22 },
  reply: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  spark: { width: 28, height: 28, borderRadius: 14, backgroundColor: D.text, alignItems: 'center', justifyContent: 'center' },
  body: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22, color: D.text },
  note: { fontFamily: tokens.font.ui, fontSize: 13, lineHeight: 18, color: D.muted },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: D.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline, shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  taskIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.fill, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: D.text },
  taskSub: { fontFamily: tokens.font.ui, fontSize: 13, color: D.muted },
  approve: { gap: 10, padding: 12 },
  pillBtn: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: D.text },
  acts: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  bottom: { paddingBottom: Platform.OS === 'web' ? 76 : 72, gap: 10 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: D.accentTint, borderWidth: StyleSheet.hairlineWidth, borderColor: D.accentDeep },
  chipText: { fontFamily: tokens.font.uiMedium, fontSize: 13, color: D.text },
  composer: { marginHorizontal: 16, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 6, borderRadius: 999, backgroundColor: D.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: D.hairline },
  input: { flex: 1, fontFamily: tokens.font.ui, fontSize: 16, color: D.text, height: 44, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  voiceBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: D.text, alignItems: 'center', justifyContent: 'center' },
});
