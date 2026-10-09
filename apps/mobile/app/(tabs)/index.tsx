import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { Screen } from '../../src/components/Screen';
import { Badge, BodyText, Button, Card, EmptyState, ListRow, Overline, ScreenTitle, SectionTitle, StatTile, SupportText, ui } from '../../src/components/ui';
import { getSystemHealth, type SystemHealthOverview } from '../../src/lib/system-health';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirmAppointment, getCalendar, type CalendarAppointment } from '../../src/lib/bookings';
import { listMessageThreads } from '../../src/lib/messaging';
import { getFinanceOverview } from '../../src/lib/finance';
import { listClients } from '../../src/lib/clients';
import { getMe } from '../../src/lib/me';
import { dialog } from '../../src/lib/dialog';
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
  const links: Array<[string, string]> = [['clients', '/clients'], ['messages', '/messages'], ['content', '/content'], ['media', '/media'], ['analytics', '/analytics'], ['finance', '/finance'], ['automations', '/automations'], ['ai', '/ai']];

  return (
    <Screen onRefresh={load}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Overline>{dateStr}</Overline>
          <ScreenTitle>{greeting}</ScreenTitle>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel={t('today.settings')}>
          <Gear size={24} color={ui.colors.gold} weight="duotone" />
        </Pressable>
      </View>

      {nextAppointment ? (
        <Card premium>
          <Overline>{t('today.next')}</Overline>
          <Text style={styles.heroTime}>{formatTime(nextAppointment.start_at, locale)}</Text>
          <Text style={styles.bookingClient}>{nextAppointment.client?.display_name ?? t('today.client')}</Text>
          <SupportText>{nextAppointment.service_name}</SupportText>
          <Badge status={nextAppointment.status} />
          <View style={styles.actions}>
            {nextAppointment.status !== 'confirmed' ? <Button small label={t('today.confirm')} loading={confirming} onPress={() => void confirmNext()} /> : null}
            {nextAppointment.client ? <Button small variant="secondary" label={t('today.message')} onPress={() => router.push('/messages')} /> : null}
            <Button small variant="ghost" label={t('today.viewCalendar')} onPress={() => router.push('/calendar')} />
          </View>
        </Card>
      ) : (
        <Card><EmptyState title={t('today.empty')} message={t('today.emptyMsg')} action={{ label: t('today.newBooking'), onPress: () => router.push('/bookings/new') }} /></Card>
      )}

      <View style={styles.tiles}>
        <StatTile label={t('today.bookings')} value={active.length} onPress={() => router.push('/calendar')} />
        <StatTile label={t('today.unread')} value={unread ?? '—'} onPress={() => router.push('/messages')} />
        <StatTile label={t('today.income')} value={money} onPress={() => router.push('/finance')} />
        <StatTile label={t('today.touchUps')} value={touchUpCount ?? '—'} onPress={() => router.push('/clients')} />
      </View>

      <SuggestionsCard workspaceId={workspaceId} limit={4} />

      {laterAppointments.length > 0 ? (
        <View style={{ gap: ui.spacing.xs }}>
          <SectionTitle>{t('today.later')}</SectionTitle>
          {laterAppointments.map((a) => <ListRow key={a.id} title={a.client?.display_name ?? t('today.client')} subtitle={`${formatTime(a.start_at, locale)} · ${a.service_name}`} trailing={<Badge status={a.status} />} onPress={() => router.push(`/bookings/${a.id}` as any)} />)}
        </View>
      ) : null}

      {health ? (
        <Card>
          <SectionTitle>{t('today.attention')}</SectionTitle>
          <BodyText>{attention > 0 ? t('today.attentionSome', { count: attention }) : t('today.attentionNone')}</BodyText>
          <Button small variant="secondary" label={t('today.review')} onPress={() => router.push('/system-health')} />
        </Card>
      ) : null}

      <View style={styles.quickLinksGrid}>
        {links.map(([key, href]) => (
          <Pressable key={key} accessibilityRole="button" onPress={() => router.push(href as any)} style={styles.quickLink}>
            <Text style={styles.quickLinkText}>{t(`today.links.${key}`)}</Text>
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
  settingsButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,248,245,0.84)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.45)' },
  heroTime: { color: ui.colors.primaryText, fontFamily: 'CormorantGaramond_500Medium', fontSize: 60, lineHeight: 64, fontVariant: ['lining-nums', 'tabular-nums'] },
  bookingClient: { color: ui.colors.primaryText, fontFamily: 'Manrope_600SemiBold', fontSize: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs, marginTop: ui.spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs },
  quickLink: { minHeight: 44, paddingHorizontal: ui.spacing.sm, backgroundColor: '#FFFFFF', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  quickLinkText: { color: ui.colors.primaryText, fontSize: 14, fontWeight: '600' },
});
