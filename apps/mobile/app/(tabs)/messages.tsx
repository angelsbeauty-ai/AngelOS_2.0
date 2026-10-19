import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from '../../src/design/appearance';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'phosphor-icon-native/src/icons/SlidersHorizontal';
import { Button } from '../../src/components/ui';
import { getSocialAccounts, PLATFORM_NAME, type SocialAccount, type SocialPlatform } from '../../src/lib/social';
import { ReconnectError, startReconnect } from '../../src/lib/meta-connect';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { DotsThree } from 'phosphor-react-native/src/icons/DotsThree';
import { ContactAvatar, BrandLogo } from '../../src/components/BrandBadge';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { NoStudio } from '../../src/components/NoStudio';
import { Card, EmptyState, Skeleton, ui, screenHeader } from '../../src/components/ui';
import { toFriendly } from '../../src/lib/friendly-error';
import { listConnections, listMessageThreads, syncMessages, type ConnectionStatus, type MessageThreadSummary } from '../../src/lib/messaging';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';
import { useNightSafe } from '../../src/components/NightSafe';

type Seg = 'messages' | 'comments' | 'mentions';
type Plat = 'all' | 'instagram' | 'facebook' | 'line' | 'tiktok';
type Filter = 'unread' | 'unanswered' | 'booked' | 'follow_up' | 'done';
const PLATS: Array<[Plat, string]> = [['all', ''], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['line', 'LINE'], ['tiktok', 'TikTok']];
const PROBLEM = /needs permission|needs reconnect|could not read|meta said|permission|error|expired/i;
const FILTERS: Filter[] = ['unread', 'unanswered', 'booked', 'follow_up', 'done'];

function matches(thread: MessageThreadSummary, f: Filter | null) {
  const tag = `${thread.status} ${thread.intent}`.toLowerCase();
  switch (f) {
    case 'unread': return thread.unread;
    case 'unanswered': return thread.needs_reply;
    case 'booked': return /book/.test(tag);
    case 'follow_up': return /follow/.test(tag);
    case 'done': return thread.status === 'done';
    default: return true;
  }
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const safe = useNightSafe();
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const seg = 'messages' as Seg;
  const [plat, setPlat] = useState<Plat>('all');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
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
      setThreads(rows.filter((r) => !(r.channel?.provider === 'manual' || (r.channel?.capabilities as any)?.demo === true)));
      setConnections(conn); setAccounts(accs); setState('ready');
    } catch (error) {
      if (isNoWorkspace(error)) { setState('nostudio'); return; }
      const friendly = toFriendly(error, { action: 'load', thing: 'messages' });
      setErrorText({ title: friendly.title, message: friendly.message }); setState('error');
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => threads.filter((th) => (plat === 'all' || th.platform === plat) && matches(th, filter) && (!query.trim() || `${th.client?.display_name ?? ''} ${th.contact_display_name ?? ''} ${th.last_preview ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [threads, plat, filter, query]);
  const platError = plat !== 'all' ? connections.find((x) => x.provider === plat && PROBLEM.test(x.detail ?? '')) ?? null : null;
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
    <View style={screenHeader.row}>
      <Text accessibilityRole="header" numberOfLines={1} style={[screenHeader.title, { color: palette.text }]}>{t('messages.title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.notifications', { defaultValue: 'Notifications' })} hitSlop={6} onPress={() => router.push('/notifications' as any)} style={styles.icon}>
        <Bell size={24} color={palette.icon} />{threads.some((x) => x.unread) ? <View style={styles.bellDot} /> : null}</Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.filter')} hitSlop={6} onPress={() => setMenuOpen(true)} style={styles.icon}>
        <SlidersHorizontal size={24} color={palette.icon} weight={filter || plat !== 'all' ? 'bold' : 'regular'} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common2.search', { defaultValue: 'Search' })} hitSlop={6} onPress={() => { setSearchOpen(!searchOpen); setQuery(''); }} style={styles.icon}><MagnifyingGlass size={24} color={palette.icon} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.more', { defaultValue: 'More' })} hitSlop={6} onPress={() => setMoreOpen(true)} style={styles.icon}><DotsThree size={26} color={palette.icon} weight="bold" /></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={styles.tabsWrap} contentContainerStyle={styles.chips}>
      {PLATS.map(([k, name]) => { const on = plat === k; return <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={k === 'all' ? t('messages.all') : name} onPress={() => setPlat(k)} style={[styles.chip, styles.tab, safe.chip, on && styles.chipOn, on && mode === 'night' && { backgroundColor: '#F4F4F5', borderColor: '#F4F4F5' }]}>
        {k !== 'all' ? <BrandLogo platform={k === 'facebook' ? 'messenger' : k} size={18} /> : null}
        <Text numberOfLines={1} style={[styles.chipText, safe.chipText, on && { color: mode === 'night' ? '#151515' : '#FFFFFF' }]}>{k === 'all' ? t('messages.all') : name}</Text></Pressable>; })}
    </ScrollView>
    {searchOpen ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('common2.search', { defaultValue: 'Search' })} placeholderTextColor={palette.muted} style={safe.search} /> : null}
    {filter ? <Pressable onPress={() => setFilter(null)}><Text style={[styles.link, { color: palette.text }]}>{t(`inbox.f.${filter}`)} · {t('inbox.clear')}</Text></Pressable> : null}
    {reErr ? <Card><View style={{ gap: 12 }}>
      <Text style={safe.errText}>{reErr.kind === 'line' ? t('messages.lineIssue') : t('messages.reconnectFailed')} ({PLATFORM_NAME[reErr.provider]})</Text>
      <Text style={safe.errBody}>{reErr.message}</Text>
      {reErr.kind === 'line' ? <Button label={t('messages.openLine')} onPress={() => router.push('/content/accounts' as any)} />
        : <Button label={reBusy ? '…' : t('messages.retry')} disabled={reBusy} onPress={() => void reconnect(reErr.provider)} />}
    </View></Card> : null}
    {!reErr && needs.map((a) => <Card key={a.platform}><View style={{ gap: 12 }}>
      <Text style={safe.errText}>{t('messages.missingTitle')} ({PLATFORM_NAME[a.platform]})</Text>
      <Text style={safe.errBody}>{a.reason ?? t('messages.needsPerm', { name: PLATFORM_NAME[a.platform] })}</Text>
      <Button label={reBusy ? '…' : t('messages.reconnect')} disabled={reBusy} onPress={() => void reconnect(a.platform)} />
    </View></Card>)}
    {!reErr && platError && !needs.some((a) => a.platform === platError.provider) ? <Card><View style={{ gap: 12 }}>
      <Text style={safe.errText}>{platError.provider === 'line' ? t('messages.lineIssue') : t('messages.needsPerm', { name: PLATS.find(([k]) => k === platError.provider)?.[1] ?? '' })}</Text>
      {platError.provider === 'line' ? <Text style={safe.errBody}>{/use webhook/i.test(platError.detail) ? t('messages.lineWebhookOff') : platError.detail}</Text> : null}
      {platError.provider === 'line' ? <Button label={t('messages.openLine')} onPress={() => router.push('/content/accounts' as any)} />
        : <Button label={reBusy ? '…' : t('messages.reconnect')} disabled={reBusy} onPress={() => void reconnect(platError.provider as SocialPlatform)} />}
    </View></Card> : null}

    {state === 'loading' ? <Skeleton rows={4} height={72} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <ErrorState title={errorText.title} message={errorText.message} onRetry={() => { setState('loading'); void load(); }} /> : null}

    {seg === 'messages' && noAccounts ? <EmptyState title={t('inbox.connectTitle')} message={t('inbox.connectMsg')} action={{ label: t('inbox.connectBtn'), onPress: () => router.push('/content/accounts' as any) }} /> : null}
    {seg === 'messages' && state === 'ready' && !noAccounts && !platError && !needs.length && !reErr && visible.length === 0 ? <EmptyState title={plat === 'line' ? t('messages.lineEmpty') : threads.length ? t('messages.nothing') : t('messages.none')} message={plat === 'line' ? t('messages.lineTest') : threads.length ? t('messages.tryFilter') : t('messages.noneMsg')} /> : null}

    {seg === 'messages' && state === 'ready' && visible.length ? <View style={[styles.list, mode === 'night' && { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss }]}>
      {visible.map((thread, idx) => {
        const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
        const avatarUri = thread.contact_avatar_url ?? null;
        return <Pressable key={thread.id} accessibilityRole="button" accessibilityLabel={`${name}, ${thread.platform_label}${thread.unread ? ', unread' : ''}`} onPress={() => router.push(`/messages/${thread.id}` as any)} style={({ pressed }) => [styles.row, mode === 'night' && { borderBottomColor: 'rgba(255,255,255,0.08)' }, idx === visible.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: mode === 'night' ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}>
          <ContactAvatar name={name} uri={avatarUri} platform={thread.platform} size={56} />
          <View style={styles.rowBody}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.name, { color: palette.text }]}>{name}</Text>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.preview, { color: palette.text }, !thread.unread && !thread.needs_reply && styles.previewRead, !thread.unread && !thread.needs_reply && { color: palette.muted }]}>{thread.last_direction === 'outbound' ? t('messages.you') : ''}{thread.last_preview ?? ''}</Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.time, { color: palette.muted }]}>· {rel(thread.last_message_at)}</Text>
            </View>
            {thread.status === 'done' ? <View style={styles.donePill}><Text style={styles.done}>{t('messages.done')}</Text></View> : null}
          </View>
          {thread.unread || thread.needs_reply ? <View accessibilityLabel="Unread" style={[styles.unread, { backgroundColor: palette.text }]} /> : <View style={{ width: 8 }} />}
        </Pressable>;
      })}
    </View> : null}
  </Screen>

  <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
    <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}><View style={safe.menu}>
      <Text style={safe.menuHead}>{t('messages.platform', { defaultValue: 'Platform' })}</Text>
      {PLATS.map(([k, name]) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: plat === k }} onPress={() => { setPlat(k); setMenuOpen(false); }} style={styles.mi}>{k !== 'all' ? <BrandLogo platform={k === 'facebook' ? 'messenger' : k} size={20} /> : null}
        <Text style={[safe.menuText, plat === k && { fontFamily: tokens.font.uiSemibold }]}>{k === 'all' ? t('messages.all') : name}</Text></Pressable>)}
      <Text style={[safe.menuHead, styles.miSep]}>{t('inbox.filter')}</Text>
      {FILTERS.map((f) => <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }} onPress={() => { setFilter(filter === f ? null : f); setMenuOpen(false); }} style={styles.mi}>
        <Text style={[safe.menuText, filter === f && { fontFamily: tokens.font.uiSemibold }]}>{t(`inbox.f.${f}`)}</Text></Pressable>)}
    </View></Pressable>
  </Modal>
  <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
    <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}><View style={safe.menu}>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/messages/new' as any); }}><Text style={safe.menuText}>{t('messages.newConv')}</Text></Pressable>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/messages/saved-replies' as any); }}><Text style={safe.menuText}>{t('messages.saved')}</Text></Pressable>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/content/accounts' as any); }}><Text style={safe.menuText}>{t('nav3.accounts')}</Text></Pressable>
    </View></Pressable>
  </Modal></View>;
}

function rel(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  tabsWrap: { marginHorizontal: -tokens.space.screen, flexGrow: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#8C7A64', borderWidth: 1.5, borderColor: '#FFF' },
  unread: { width: 8, height: 8, borderRadius: 4 },
  previewRead: { fontFamily: tokens.font.ui },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: tokens.space.screen },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED' },
  chipOn: { backgroundColor: '#151515', borderColor: '#151515' },
  chipText: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#151515' },
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 96, paddingRight: 16, backgroundColor: 'rgba(0,0,0,0.2)' },
  mi: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  miSep: { borderTopWidth: 6, borderTopColor: 'rgba(42,39,37,0.06)' },
  link: { fontFamily: tokens.font.uiBold, fontSize: 15, paddingVertical: 6 },
  list: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEDED' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  preview: { flex: 1, fontFamily: tokens.font.ui, fontSize: 14 },
  time: { fontFamily: tokens.font.ui, fontSize: 13 },
  donePill: { alignSelf: 'flex-start', marginTop: 2 },
  done: { fontFamily: tokens.font.uiMedium, fontSize: 12, color: '#8C7A64' }
});
