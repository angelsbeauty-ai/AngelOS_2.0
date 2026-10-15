import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { Button } from '../../src/components/ui';
import { getSocialAccounts, PLATFORM_NAME, type SocialAccount, type SocialPlatform } from '../../src/lib/social';
import { ReconnectError, startReconnect } from '../../src/lib/meta-connect';
import { Funnel } from 'phosphor-react-native/src/icons/Funnel';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { NoStudio } from '../../src/components/NoStudio';
import { Card, EmptyState, ScreenTitle, Skeleton, ui } from '../../src/components/ui';
import { Avatar, PlatformBadge, UnreadDot } from '../../src/components/MessagingBits';
import { toFriendly } from '../../src/lib/friendly-error';
import { listConnections, listMessageThreads, syncMessages, timeLabel, type ConnectionStatus, type MessageThreadSummary } from '../../src/lib/messaging';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, webGlass } from '../../src/design/theme';

type Seg = 'messages' | 'comments' | 'mentions';
type Plat = 'all' | 'instagram' | 'facebook' | 'line' | 'tiktok';
type Filter = 'unread' | 'unanswered' | 'booked' | 'follow_up' | 'touch_up' | 'done';
const PLATS: Array<[Plat, string]> = [['all', ''], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['line', 'LINE'], ['tiktok', 'TikTok']];
const PROBLEM = /needs permission|needs reconnect|could not read|meta said|permission|error|expired/i;
const FILTERS: Filter[] = ['unread', 'unanswered', 'booked', 'follow_up', 'touch_up', 'done'];

/** Filter rules use only real thread fields (no invented states). */
function matches(thread: MessageThreadSummary, f: Filter | null) {
  const tag = `${thread.status} ${thread.intent}`.toLowerCase();
  switch (f) {
    case 'unread': return thread.unread;
    case 'unanswered': return thread.needs_reply;
    case 'booked': return /book/.test(tag);
    case 'follow_up': return /follow/.test(tag);
    case 'touch_up': return /touch/.test(tag);
    case 'done': return thread.status === 'done';
    default: return true;
  }
}

/** NAV V1 Messages tab: Meta Business Suite style inbox shell over the existing messaging API. */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const seg = 'messages' as Seg; // Messages only (no Comments/Mentions segment).
  const [plat, setPlat] = useState<Plat>('all');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [errorText, setErrorText] = useState({ title: '', message: '' });
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [reErr, setReErr] = useState<{ provider: SocialPlatform; message: string; kind: string } | null>(null);
  const [reBusy, setReBusy] = useState(false);

  const load = useCallback(async (pull = false) => {
    try {
      const workspace = await getActiveWorkspace();
      if (pull) await syncMessages(workspace.id).catch(() => undefined);
      const [rows, conn, accs] = await Promise.all([
        listMessageThreads(workspace.id, 'active'),
        listConnections(workspace.id).catch(() => [] as ConnectionStatus[]),
        getSocialAccounts(workspace.id).catch(() => [] as SocialAccount[])
      ]);
      setThreads(rows); setConnections(conn); setAccounts(accs); setState('ready');
    } catch (error) {
      if (isNoWorkspace(error)) { setState('nostudio'); return; }
      const friendly = toFriendly(error, { action: 'load', thing: 'messages' });
      setErrorText({ title: friendly.title, message: friendly.message }); setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => threads.filter((th) => (plat === 'all' || th.platform === plat) && matches(th, filter)), [threads, plat, filter]);
  /** A platform-level sync problem (missing permission, expired login). Raw Meta text is never shown. */
  const platError = plat !== 'all' ? connections.find((x) => x.provider === plat && PROBLEM.test(x.detail ?? '')) ?? null : null;
  /** Meta accounts that need a fresh login (e.g. messaging permission not granted). Plain English from the server. */
  const needs = accounts.filter((a) => a.platform !== 'line' && a.state === 'needs_reconnect' && (plat === 'all' || a.platform === plat));
  async function reconnect(provider: SocialPlatform) {
    setReErr(null);
    if (provider === 'line') { setReErr({ provider, kind: 'line', message: platError?.detail || t('messages.lineWebhookOff') }); return; }
    setReBusy(true);
    try {
      const ws = await getActiveWorkspace();
      const r = await startReconnect(ws.id, provider);
      if (r === 'returned') await load(true);
    } catch (e) {
      const kind = e instanceof ReconnectError ? e.kind : 'failed';
      setReErr({ provider, kind, message: kind === 'login_off' ? t('messages.loginOff') : e instanceof Error ? e.message : String(e) });
    } finally { setReBusy(false); }
  }
  const anyConnected = connections.some((c) => c.connected) || accounts.some((a) => a.state !== 'not_connected');
  const noAccounts = state === 'ready' && !anyConnected && threads.length === 0;

  return <View style={{ flex: 1 }}><Screen onRefresh={() => load(true)}>
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}><ScreenTitle>{t('messages.title')}</ScreenTitle></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.filter')} onPress={() => setMenuOpen(true)} style={[styles.round, filter && styles.roundOn]}>
        {filter ? <Funnel size={20} color="#FFF" weight="fill" /> : <SlidersHorizontal size={22} color="#2A2725" weight="bold" />}
      </Pressable>
    </View>


    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {PLATS.map(([k, name]) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: plat === k }} onPress={() => setPlat(k)} style={[styles.chip, plat === k && styles.chipOn]}>
        <Text numberOfLines={1} style={[styles.chipText, plat === k && { color: '#FFF' }]}>{k === 'all' ? t('messages.all') : name}</Text></Pressable>)}
    </ScrollView>
    {reErr ? <Card><View style={{ gap: 12 }}>
      <Text style={styles.errText}>{reErr.kind === 'line' ? t('messages.lineIssue') : t('messages.reconnectFailed')} ({PLATFORM_NAME[reErr.provider]})</Text>
      <Text style={styles.errBody}>{reErr.message}</Text>
      {reErr.kind === 'line' ? <Button label={t('messages.openLine')} onPress={() => router.push('/content/accounts' as any)} />
        : <Button label={reBusy ? '…' : t('messages.retry')} disabled={reBusy} onPress={() => void reconnect(reErr.provider)} />}
    </View></Card> : null}
    {!reErr && needs.map((a) => <Card key={a.platform}><View style={{ gap: 12 }}>
      <Text style={styles.errText}>{t('messages.missingTitle')} ({PLATFORM_NAME[a.platform]})</Text>
      <Text style={styles.errBody}>{a.reason ?? t('messages.needsPerm', { name: PLATFORM_NAME[a.platform] })}</Text>
      <Button label={reBusy ? '…' : t('messages.reconnect')} disabled={reBusy} onPress={() => void reconnect(a.platform)} />
    </View></Card>)}
    {!reErr && platError && !needs.some((a) => a.platform === platError.provider) ? <Card><View style={{ gap: 12 }}>
      <Text style={styles.errText}>{platError.provider === 'line' ? t('messages.lineIssue') : t('messages.needsPerm', { name: PLATS.find(([k]) => k === platError.provider)?.[1] ?? '' })}</Text>
      {platError.provider === 'line' ? <Text style={styles.errBody}>{/use webhook/i.test(platError.detail) ? t('messages.lineWebhookOff') : platError.detail}</Text> : null}
      {platError.provider === 'line' ? <Button label={t('messages.openLine')} onPress={() => router.push('/content/accounts' as any)} />
        : <Button label={reBusy ? '…' : t('messages.reconnect')} disabled={reBusy} onPress={() => void reconnect(platError.provider as SocialPlatform)} />}
    </View></Card> : null}
    {filter ? <Pressable onPress={() => setFilter(null)}><Text style={styles.link}>{t(`inbox.f.${filter}`)} · {t('inbox.clear')}</Text></Pressable> : null}

    {state === 'loading' ? <Skeleton rows={4} height={72} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <ErrorState title={errorText.title} message={errorText.message} onRetry={() => { setState('loading'); void load(); }} /> : null}

    {state === 'ready' && seg !== 'messages' ? <Card><EmptyState title={t(`inbox.${seg}Empty`)} message={anyConnected ? t('inbox.notYet') : t('inbox.connectMsg')}
      action={anyConnected ? undefined : { label: t('inbox.connectBtn'), onPress: () => router.push('/content/accounts' as any) }} /></Card> : null}

    {seg === 'messages' && noAccounts ? <Card><EmptyState title={t('inbox.connectTitle')} message={t('inbox.connectMsg')} action={{ label: t('inbox.connectBtn'), onPress: () => router.push('/content/accounts' as any) }} /></Card> : null}
    {seg === 'messages' && state === 'ready' && !noAccounts && !platError && !needs.length && !reErr && visible.length === 0 ? <Card><EmptyState title={plat === 'line' ? t('messages.lineEmpty') : threads.length ? t('messages.nothing') : t('messages.none')} message={plat === 'line' ? t('messages.lineTest') : threads.length ? t('messages.tryFilter') : t('messages.noneMsg')} /></Card> : null}

    {seg === 'messages' && state === 'ready' && visible.length ? <View style={styles.list}>
      {visible.map((thread) => {
        const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
        return <Pressable key={thread.id} accessibilityRole="button" accessibilityLabel={`${name}, ${thread.platform_label}${thread.unread ? ', unread' : ''}`} onPress={() => router.push(`/messages/${thread.id}` as any)} style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Avatar name={name} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.name, thread.unread && styles.nameUnread]}>{name}</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.time}>{timeLabel(thread.last_message_at)}</Text>
            </View>
            <View style={styles.rowMid}>
              <PlatformBadge platform={thread.platform} label={thread.platform_label} />
              {thread.status === 'done' ? <Text style={styles.done}>{t('messages.done')}</Text> : thread.needs_reply ? <Text style={styles.flag}>{t('messages.needsReply')}</Text> : null}
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.preview}>{thread.last_direction === 'outbound' ? t('messages.you') : ''}{thread.last_preview ?? ''}</Text>
          </View>
          <UnreadDot visible={thread.unread} />
        </Pressable>;
      })}
    </View> : null}
  </Screen>

  <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
    <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}><View style={styles.menu}>
      <Text style={styles.menuHead}>{t('inbox.filter')}</Text>
      {FILTERS.map((f) => <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }} onPress={() => { setFilter(filter === f ? null : f); setMenuOpen(false); }} style={styles.mi}>
        <Text style={[styles.miText, filter === f && { color: ROSE }]}>{t(`inbox.f.${f}`)}</Text></Pressable>)}
      <Pressable style={[styles.mi, styles.miSep]} onPress={() => { setMenuOpen(false); router.push('/messages/new' as any); }}><Text style={styles.miText}>{t('messages.newConv')}</Text></Pressable>
      <Pressable style={styles.mi} onPress={() => { setMenuOpen(false); router.push('/messages/saved-replies' as any); }}><Text style={styles.miText}>{t('messages.saved')}</Text></Pressable>
    </View></Pressable>
  </Modal></View>;
}

const ROSE = '#8C5547';
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)', ...(webGlass as object) },
  roundOn: { backgroundColor: ROSE },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: 'rgba(42,39,37,0.06)' },
  segItem: { flex: 1, flexShrink: 0, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: ROSE },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#2A2725' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.10)' },
  chipOn: { backgroundColor: '#2A2725', borderColor: '#2A2725' },
  chipText: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#2A2725' },
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 96, paddingRight: 16, backgroundColor: 'rgba(0,0,0,0.2)' },
  errBody: { fontFamily: tokens.font.ui, fontSize: 15, color: '#4A443F', lineHeight: 21 },
  errText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#2A2725', lineHeight: 22 },
  menu: { width: 240, borderRadius: 22, backgroundColor: 'rgba(250,248,245,0.97)', overflow: 'hidden', ...(webGlass as object) },
  menuHead: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, color: '#625B56', padding: 14, paddingBottom: 6, textTransform: 'uppercase' },
  mi: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(42,39,37,0.10)' },
  miSep: { borderTopWidth: 6, borderTopColor: 'rgba(42,39,37,0.06)' },
  miText: { fontFamily: tokens.font.uiMedium, fontSize: 16, color: '#2A2725' },
  bannerTitle: { fontFamily: tokens.font.uiBold, fontSize: 15, color: ui.colors.primaryText },
  link: { fontFamily: tokens.font.uiBold, fontSize: 15, color: tokens.color.tide, paddingVertical: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontSize: 13, color: '#6B6460', paddingHorizontal: 4 },
  list: { gap: 2, borderRadius: 28, backgroundColor: tokens.color.raised, paddingVertical: 4, paddingHorizontal: 4, ...(webGlass as object) },
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
