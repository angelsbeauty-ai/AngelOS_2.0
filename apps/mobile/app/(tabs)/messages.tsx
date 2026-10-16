import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'phosphor-react-native/src/icons/SlidersHorizontal';
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
import { Card, EmptyState, ScreenTitle, Skeleton, ui } from '../../src/components/ui';
import { Avatar, PlatformBadge, UnreadDot } from '../../src/components/MessagingBits';
import { toFriendly } from '../../src/lib/friendly-error';
import { listConnections, listMessageThreads, syncMessages, timeLabel, type ConnectionStatus, type MessageThreadSummary } from '../../src/lib/messaging';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens, webGlass } from '../../src/design/theme';

type Seg = 'messages' | 'comments' | 'mentions';
type Plat = 'all' | 'instagram' | 'facebook' | 'line' | 'tiktok';
type Filter = 'unread' | 'unanswered' | 'booked' | 'follow_up' | 'done';
const PLATS: Array<[Plat, string]> = [['all', ''], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['line', 'LINE'], ['tiktok', 'TikTok']];
const PROBLEM = /needs permission|needs reconnect|could not read|meta said|permission|error|expired/i;
const FILTERS: Filter[] = ['unread', 'unanswered', 'booked', 'follow_up', 'done'];

/** Filter rules use only real thread fields (no invented states). */
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

/** NAV V1 Messages tab: Meta Business Suite style inbox shell over the existing messaging API. */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const seg = 'messages' as Seg; // Messages only (no Comments/Mentions segment).
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
      setThreads(rows.filter((r) => !(r.channel?.provider === 'manual' || (r.channel?.capabilities as any)?.demo === true))); setConnections(conn); setAccounts(accs); setState('ready');
    } catch (error) {
      if (isNoWorkspace(error)) { setState('nostudio'); return; }
      const friendly = toFriendly(error, { action: 'load', thing: 'messages' });
      setErrorText({ title: friendly.title, message: friendly.message }); setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => threads.filter((th) => (plat === 'all' || th.platform === plat) && matches(th, filter) && (!query.trim() || `${th.client?.display_name ?? ''} ${th.contact_display_name ?? ''} ${th.last_preview ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [threads, plat, filter, query]);
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
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{t('messages.title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.notifications', { defaultValue: 'Notifications' })} hitSlop={6} onPress={() => router.push('/notifications' as any)} style={styles.icon}>
        <Bell size={24} color="#262626" />{threads.some((x) => x.unread) ? <View style={styles.bellDot} /> : null}</Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.filter')} hitSlop={6} onPress={() => setMenuOpen(true)} style={styles.icon}>
        <SlidersHorizontal size={24} color={filter || plat !== 'all' ? ROSE : '#151515'} weight={filter || plat !== 'all' ? 'bold' : 'regular'} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common2.search', { defaultValue: 'Search' })} hitSlop={6} onPress={() => { setSearchOpen(!searchOpen); setQuery(''); }} style={styles.icon}><MagnifyingGlass size={24} color="#262626" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('top.more', { defaultValue: 'More' })} hitSlop={6} onPress={() => setMoreOpen(true)} style={styles.icon}><DotsThree size={26} color="#262626" weight="bold" /></Pressable>
    </View>
    {searchOpen ? <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('common2.search', { defaultValue: 'Search' })} placeholderTextColor="#8E8E8E" style={styles.search} /> : null}
    {filter || plat !== 'all' ? <Pressable onPress={() => { setFilter(null); setPlat('all'); }}><Text style={styles.link}>{[plat !== 'all' ? PLATS.find(([k]) => k === plat)?.[1] : null, filter ? t(`inbox.f.${filter}`) : null].filter(Boolean).join(' · ')} · {t('inbox.clear')}</Text></Pressable> : null}
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

    {state === 'loading' ? <Skeleton rows={4} height={72} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <ErrorState title={errorText.title} message={errorText.message} onRetry={() => { setState('loading'); void load(); }} /> : null}

    {state === 'ready' && seg !== 'messages' ? <Card><EmptyState title={t(`inbox.${seg}Empty`)} message={anyConnected ? t('inbox.notYet') : t('inbox.connectMsg')}
      action={anyConnected ? undefined : { label: t('inbox.connectBtn'), onPress: () => router.push('/content/accounts' as any) }} /></Card> : null}

    {seg === 'messages' && noAccounts ? <Card><EmptyState title={t('inbox.connectTitle')} message={t('inbox.connectMsg')} action={{ label: t('inbox.connectBtn'), onPress: () => router.push('/content/accounts' as any) }} /></Card> : null}
    {seg === 'messages' && state === 'ready' && !noAccounts && !platError && !needs.length && !reErr && visible.length === 0 ? <Card><EmptyState title={plat === 'line' ? t('messages.lineEmpty') : threads.length ? t('messages.nothing') : t('messages.none')} message={plat === 'line' ? t('messages.lineTest') : threads.length ? t('messages.tryFilter') : t('messages.noneMsg')} /></Card> : null}

    {seg === 'messages' && state === 'ready' && visible.length ? <View style={styles.list}>
      {visible.map((thread, idx) => {
        const name = thread.client?.display_name ?? thread.contact_display_name ?? t('messages.unknown');
        const avatarUri = thread.contact_avatar_url ?? null;
        return <Pressable key={thread.id} accessibilityRole="button" accessibilityLabel={`${name}, ${thread.platform_label}${thread.unread ? ', unread' : ''}`} onPress={() => router.push(`/messages/${thread.id}` as any)} style={({ pressed }) => [styles.row, idx === visible.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: '#FBFAF7' }]}>
          <ContactAvatar name={name} uri={avatarUri} platform={thread.platform} size={56} />
          <View style={styles.rowBody}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.name}>{name}</Text>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.preview, !thread.unread && !thread.needs_reply && styles.previewRead]}>{thread.last_direction === 'outbound' ? t('messages.you') : ''}{thread.last_preview ?? ''}</Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.time}>· {rel(thread.last_message_at)}</Text>
            </View>
            {thread.status === 'done' ? <View style={styles.donePill}><Text style={styles.done}>{t('messages.done')}</Text></View> : null}
          </View>
          {thread.unread || thread.needs_reply ? <View accessibilityLabel="Unread" style={styles.unread} /> : <View style={{ width: 8 }} />}
        </Pressable>;
      })}
    </View> : null}
  </Screen>

  <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
    <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}><View style={styles.menu}>
      <Text style={styles.menuHead}>{t('messages.platform', { defaultValue: 'Platform' })}</Text>
      {PLATS.map(([k, name]) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: plat === k }} onPress={() => { setPlat(k); setMenuOpen(false); }} style={styles.mi}>{k !== 'all' ? <BrandLogo platform={k === 'facebook' ? 'messenger' : k} size={20} /> : null}
        <Text style={[styles.miText, plat === k && { color: ROSE }]}>{k === 'all' ? t('messages.all') : name}</Text></Pressable>)}
      <Text style={[styles.menuHead, styles.miSep]}>{t('inbox.filter')}</Text>
      {FILTERS.map((f) => <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }} onPress={() => { setFilter(filter === f ? null : f); setMenuOpen(false); }} style={styles.mi}>
        <Text style={[styles.miText, filter === f && { color: ROSE }]}>{t(`inbox.f.${f}`)}</Text></Pressable>)}
    </View></Pressable>
  </Modal>
  <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
    <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}><View style={styles.menu}>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/messages/new' as any); }}><Text style={styles.miText}>{t('messages.newConv')}</Text></Pressable>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/messages/saved-replies' as any); }}><Text style={styles.miText}>{t('messages.saved')}</Text></Pressable>
      <Pressable style={styles.mi} onPress={() => { setMoreOpen(false); router.push('/content/accounts' as any); }}><Text style={styles.miText}>{t('nav3.accounts')}</Text></Pressable>
    </View></Pressable>
  </Modal></View>;
}

const ROSE = '#151515';
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 },
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30, color: '#151515' },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#8C7A64', borderWidth: 1.5, borderColor: '#FFF' },
  search: { height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#EFECE6', fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#151515' },
  previewRead: { fontFamily: tokens.font.ui, color: '#6B645B' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFECE6', ...(webGlass as object) },
  roundOn: { backgroundColor: ROSE },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: 'rgba(42,39,37,0.06)' },
  segItem: { flex: 1, flexShrink: 0, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: ROSE },
  segText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,48,32,0.17)' },
  chipOn: { backgroundColor: '#151515', borderColor: '#151515' },
  chipText: { fontFamily: tokens.font.uiMedium, fontSize: 15, color: '#151515' },
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 96, paddingRight: 16, backgroundColor: 'rgba(0,0,0,0.2)' },
  errBody: { fontFamily: tokens.font.ui, fontSize: 15, color: '#151515', lineHeight: 21 },
  errText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515', lineHeight: 22 },
  menu: { width: 240, borderRadius: 22, backgroundColor: '#FFFFFF', overflow: 'hidden', ...(webGlass as object) },
  menuHead: { fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, color: '#6B645B', padding: 14, paddingBottom: 6, textTransform: 'uppercase' },
  mi: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,48,32,0.17)' },
  miSep: { borderTopWidth: 6, borderTopColor: 'rgba(42,39,37,0.06)' },
  miText: { fontFamily: tokens.font.uiMedium, fontSize: 16, color: '#151515' },
  bannerTitle: { fontFamily: tokens.font.uiBold, fontSize: 15, color: ui.colors.primaryText },
  link: { fontFamily: tokens.font.uiBold, fontSize: 15, color: tokens.color.tide, paddingVertical: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontSize: 13, color: '#6B645B', paddingHorizontal: 4 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,48,32,0.17)', shadowColor: '#28201A', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 88, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFECE6' },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 16, lineHeight: 21, color: '#151515' },
  nameUnread: { fontFamily: tokens.font.uiBold },
  time: { flexShrink: 0, fontFamily: tokens.font.ui, fontSize: 14, color: '#6B645B' },
  preview: { flexShrink: 1, fontFamily: tokens.font.uiSemibold, fontSize: 14.5, lineHeight: 19, color: '#151515' },
  flag: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: tokens.color.warning },
  donePill: { alignSelf: 'flex-start', height: 20, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#EFECE6', justifyContent: 'center', marginTop: 2 },
  done: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: '#4F4A44' }
});

/** Relative time like Meta Inbox: now, 5m, 1h, 13h, 1d, 3w. */
function rel(iso: string | null) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`; const d = Math.round(h / 24); if (d < 7) return `${d}d`; return `${Math.round(d / 7)}w`;
}
