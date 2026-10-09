import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Image as ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { ChartLine } from 'phosphor-react-native/src/icons/ChartLine';
import { CurrencyJpy } from 'phosphor-react-native/src/icons/CurrencyJpy';
import { BellRinging } from 'phosphor-react-native/src/icons/BellRinging';
import { Robot } from 'phosphor-react-native/src/icons/Robot';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle';
import { Screen } from '../../src/components/Screen';
import { Badge, BodyText, Button, Card, ListRow, Overline, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { getSystemHealth, type SystemHealthOverview } from '../../src/lib/system-health';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirmAppointment, getCalendar, type CalendarAppointment } from '../../src/lib/bookings';
import { listMessageThreads } from '../../src/lib/messaging';
import { getFinanceOverview } from '../../src/lib/finance';
import { listClients } from '../../src/lib/clients';
import { getMe } from '../../src/lib/me';
import { dialog } from '../../src/lib/dialog';
import { label } from '../../src/lib/labels';
import { toFriendly } from '../../src/lib/friendly-error';
import { supabase } from '../../src/lib/supabase';
import { SuggestionsCard } from '../../src/components/SuggestionsCard';

export default function TodayScreen() {
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [nextAppointment, setNextAppointment] = useState<CalendarAppointment | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const { t, i18n } = useTranslation();
  const [unread, setUnread] = useState<number | null>(null);
  const [weekIncome, setWeekIncome] = useState<{ amount: number; currency: string } | null>(null);
  const [touchUpCount, setTouchUpCount] = useState<number | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [me2Name, setMe2Name] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const signedIn = Boolean(data.session);
      setIsSignedIn(signedIn);
      setSessionReady(true);
      if (signedIn) {
        void load();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const signedIn = Boolean(session);
      setIsSignedIn(signedIn);
      setSessionReady(true);
      if (signedIn) {
        void load();
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function load() {
    try {
      const workspace = await getActiveWorkspace();
      setWorkspaceId(workspace.id);
      const [healthData, calendarData, threads, week, touchUps, me] = await Promise.all([
        getSystemHealth(workspace.id).catch(() => null),
        getCalendar(workspace.id, startOfToday().toISOString(), endOfToday().toISOString()),
        listMessageThreads(workspace.id).catch(() => null),
        getFinanceOverview(workspace.id, 7).catch(() => null),
        listClients(workspace.id, '', 'touch_up').catch(() => null),
        getMe().catch(() => null),
      ]);
      setHealth(healthData);
      setAppointments(calendarData.appointments);
      setUnread(threads ? threads.filter((th) => th.needs_owner || th.needs_reply).length : null);
      setWeekIncome(week ? { amount: week.actualIncome, currency: week.entries[0]?.currency ?? 'JPY' } : null);
      setTouchUpCount(touchUps ? touchUps.length : null);
      setMe2Name(me?.displayName ?? null);
      setFirstName((me?.displayName ?? '').trim().split(/\s+/)[0] || null);
      const next = calendarData.appointments
        .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show')
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
      setNextAppointment(next || null);
    } catch {
      setHealth(null);
    }
  }

  async function confirmNext() {
    if (!workspaceId || !nextAppointment) return;
    setConfirming(true);
    try { await confirmAppointment(workspaceId, nextAppointment.id); await load(); }
    catch (e) { const f = toFriendly(e, { action: 'save', thing: 'booking' }); void dialog.notify(t('today.confirmFail'), f.message); }
    finally { setConfirming(false); }
  }

  if (!sessionReady) {
    return <Screen><SupportText>{t('today.loading')}</SupportText></Screen>;
  }
  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = now.getHours();
  const greetKey = hour < 12 ? 'today.greeting' : hour < 18 ? 'today.greetingAfternoon' : 'today.greetingEvening';
  const greeting = firstName ? t(greetKey, { name: firstName }) : t('today.greetingNoName');
  const active = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show');
  const laterAppointments = active.filter((a) => a.id !== nextAppointment?.id);
  const attention = health ? health.counts.urgent + health.counts.today + health.counts.later : 0;
  const money = weekIncome ? formatYen(weekIncome.amount, weekIncome.currency, locale) : '—';
  const links: Array<[string, string, any]> = [['clients', '/clients', Users], ['messages', '/messages', ChatCircle], ['content', '/content', Sparkle], ['media', '/media', ImageIcon], ['analytics', '/analytics', ChartLine], ['finance', '/finance', CurrencyJpy], ['automations', '/automations', BellRinging], ['ai', '/ai', Robot]];
  const minsAway = nextAppointment ? Math.round((new Date(nextAppointment.start_at).getTime() - Date.now()) / 60000) : 0;
  const initials = (me2Name ?? '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'A';
  const openItems = (health?.attention ?? []).filter((x) => x.status === 'open').slice(0, 4);
  const subtitle = (active.length ? t('today.sub', { count: active.length }) : t('today.subNone')) + (unread ? t('today.subMsgs', { count: unread }) : '');

  return (
    <Screen onRefresh={load}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Overline>{dateStr}</Overline>
          <ScreenTitle>{greeting}</ScreenTitle>
          <SupportText>{subtitle}</SupportText>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel={t('today.settings')}>
          <Text style={styles.initials}>{initials}</Text>
        </Pressable>
      </View>

      {nextAppointment ? (
        <Card premium>
          <View style={styles.heroTop}>
            <Overline>{minsAway > 0 && minsAway < 600 ? t('today.nextIn', { min: minsAway }) : t('today.nextNow')}</Overline>
            <Badge status={nextAppointment.status} label={label(t, 'st', nextAppointment.status)} />
          </View>
          <View style={styles.heroTimeRow}>
            <Text style={styles.heroTime}>{formatTime(nextAppointment.start_at, locale)}</Text>
            <SupportText>{t('today.until', { time: formatTime(nextAppointment.end_at, locale) })}</SupportText>
          </View>
          <Text style={styles.bookingClient}>{nextAppointment.client?.display_name ?? t('today.client')}</Text>
          <SupportText>{nextAppointment.service_name}</SupportText>
          <View style={styles.actions}>
            <Button small label={t('today.open')} onPress={() => router.push(`/bookings/${nextAppointment.id}` as any)} />
            {nextAppointment.status !== 'confirmed' ? <Button small variant="secondary" label={t('today.confirm')} loading={confirming} onPress={() => void confirmNext()} /> : null}
            {nextAppointment.client ? <Button small variant="ghost" label={t('today.message')} onPress={() => router.push({ pathname: '/messages/new', params: { clientId: nextAppointment.client!.id } } as any)} /> : null}
          </View>
        </Card>
      ) : (
        <Card premium>
          <Overline>{t('today.next')}</Overline>
          <Text style={styles.bookingClient}>{t('today.empty')}</Text>
          <SupportText>{t('today.emptyMsg')}</SupportText>
          <View style={styles.actions}><Button small label={t('today.newBooking')} onPress={() => router.push('/bookings/new')} /></View>
        </Card>
      )}

      <Card>
        <View style={styles.strip}>
          <Pressable style={styles.stripCell} onPress={() => router.push('/calendar')}><Text style={styles.stripValue}>{active.length}</Text><SupportText>{t('today.bookings')}</SupportText></Pressable>
          <View style={styles.stripDivider} />
          <Pressable style={styles.stripCell} onPress={() => router.push('/messages')}><Text style={styles.stripValue}>{unread ?? '—'}</Text><SupportText>{t('today.toReply')}</SupportText></Pressable>
          <View style={styles.stripDivider} />
          <Pressable style={styles.stripCell} onPress={() => router.push('/finance')}><Text style={styles.stripValue} numberOfLines={1} adjustsFontSizeToFit>{money}</Text><SupportText>{t('today.thisWeek')}</SupportText></Pressable>
        </View>
        {touchUpCount ? <Pressable onPress={() => router.push('/clients')}><SupportText tone="warning">{t('today.touchUps')}: {touchUpCount}</SupportText></Pressable> : null}
      </Card>

      {laterAppointments.length > 0 ? (
        <View style={{ gap: ui.spacing.xs }}>
          <SectionTitle>{t('today.laterTitle')}</SectionTitle>
          {laterAppointments.map((a) => <ListRow key={a.id} leading={<Text style={styles.laterTime}>{formatTime(a.start_at, locale)}</Text>} title={a.client?.display_name ?? t('today.client')} subtitle={a.service_name} trailing={<Badge status={a.status} label={label(t, 'st', a.status)} />} onPress={() => router.push(`/bookings/${a.id}` as any)} />)}
        </View>
      ) : null}

      <View style={{ gap: ui.spacing.xs }}>
        <SectionTitle>{t('today.needs')}</SectionTitle>
        {openItems.length ? openItems.map((it) => (
          <ListRow key={it.id} leading={<WarningCircle size={28} color={it.severity === 'urgent' ? ui.colors.critical : ui.colors.warning} weight="duotone" />} title={it.title} subtitle={it.summary} trailing={<Badge status={it.severity === 'urgent' ? 'cancelled' : 'request'} label={t(`today.sev.${it.severity}`)} />} onPress={() => router.push((it.action_path && it.action_path.startsWith('/') ? it.action_path : '/system-health') as any)} />
        )) : (
          <Card><View style={styles.okRow}><CheckCircle size={32} color={ui.colors.success} weight="duotone" /><View style={{ flex: 1 }}><BodyText>{t('today.needsEmpty')}</BodyText><SupportText>{t('today.needsEmptyMsg')}</SupportText></View></View></Card>
        )}
      </View>

      <SuggestionsCard workspaceId={workspaceId} limit={4} />

      <SectionTitle>{t('today.quick')}</SectionTitle>
      <View style={styles.quickLinksGrid}>
        {links.map(([key, href, Icon]) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(`links2.${key}`)} onPress={() => router.push(href as any)} style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}>
            <View style={styles.quickIcon}><Icon size={26} color={ui.colors.primaryText} weight="duotone" /></View>
            <Text style={styles.quickLinkText} numberOfLines={2}>{t(`links2.${key}`)}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
}

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function formatYen(value: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value); } catch { return `${currency} ${Math.round(value)}`; }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.spacing.sm },
  headerContent: { flex: 1, gap: 4 },
  settingsButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.softGold },
  initials: { color: ui.colors.primaryText, fontFamily: 'Manrope_700Bold', fontSize: 15 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: ui.spacing.xs },
  heroTime: { color: ui.colors.primaryText, fontFamily: 'CormorantGaramond_500Medium', fontSize: 60, lineHeight: 64, fontVariant: ['lining-nums', 'tabular-nums'] },
  bookingClient: { color: ui.colors.primaryText, fontFamily: 'Manrope_600SemiBold', fontSize: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs, marginTop: ui.spacing.xs },
  strip: { flexDirection: 'row', alignItems: 'center' },
  stripCell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  stripValue: { color: ui.colors.primaryText, fontFamily: 'CormorantGaramond_500Medium', fontSize: 34, lineHeight: 38, fontVariant: ['lining-nums', 'tabular-nums'] },
  stripDivider: { width: 1, alignSelf: 'stretch', backgroundColor: ui.colors.border },
  laterTime: { width: 56, color: ui.colors.primaryText, fontFamily: 'Manrope_700Bold', fontSize: 15 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: ui.spacing.sm },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: ui.spacing.sm, marginHorizontal: -4 },
  quickLink: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  quickIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.elevated, borderWidth: 1, borderColor: ui.colors.border },
  quickLinkText: { color: ui.colors.primaryText, fontFamily: 'Manrope_600SemiBold', fontSize: 12, textAlign: 'center' },
});
