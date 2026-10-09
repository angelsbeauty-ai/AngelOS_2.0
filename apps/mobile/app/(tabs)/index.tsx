import { Link, Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gear } from 'phosphor-react-native';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { getSystemHealth, type SystemHealthOverview } from '../../src/lib/system-health';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { getCalendar, type CalendarAppointment } from '../../src/lib/bookings';
import { supabase } from '../../src/lib/supabase';
import { SuggestionsCard } from '../../src/components/SuggestionsCard';

export default function TodayScreen() {
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [nextAppointment, setNextAppointment] = useState<CalendarAppointment | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

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
      const [healthData, calendarData] = await Promise.all([
        getSystemHealth(workspace.id),
        getCalendar(workspace.id, startOfToday().toISOString(), endOfToday().toISOString()),
      ]);
      setHealth(healthData);
      setAppointments(calendarData.appointments);
      const next = calendarData.appointments
        .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show')
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
      setNextAppointment(next || null);
    } catch {
      setHealth(null);
    }
  }

  if (!sessionReady) {
    return <Screen><SupportText>Loading AngelOS...</SupportText></Screen>;
  }
  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const laterAppointments = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show' && a !== nextAppointment
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <SupportText>{dateStr}</SupportText>
          <ScreenTitle>Today</ScreenTitle>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          accessibilityLabel="Settings"
        >
          <Gear size={24} color={ui.colors.gold} weight="duotone" />
        </Pressable>
      </View>

      <SuggestionsCard workspaceId={workspaceId} limit={4} />

      {health && (
        <Card>
          <SectionTitle>Needs Attention</SectionTitle>
          <BodyText>
            {health.counts.urgent + health.counts.today + health.counts.later > 0
              ? `${health.counts.urgent + health.counts.today + health.counts.later} item${health.counts.urgent + health.counts.today + health.counts.later === 1 ? '' : 's'} need review.`
              : 'Nothing currently needs your attention.'}
          </BodyText>
          <Link href="/system-health" asChild>
            <Pressable style={styles.actionLink}>
              <Text style={styles.actionText}>Review →</Text>
            </Pressable>
          </Link>
        </Card>
      )}

      {nextAppointment && (
        <Card premium>
          <SectionTitle>Next Booking</SectionTitle>
          <View style={styles.bookingCard}>
            <Text style={styles.bookingTime}>{formatTime(nextAppointment.start_at)}</Text>
            <Text style={styles.bookingClient}>{nextAppointment.client?.display_name ?? 'Client'}</Text>
            <SupportText>{nextAppointment.service_name}</SupportText>
            <Pill tone="gold">{nextAppointment.status.replaceAll('_', ' ')}</Pill>
          </View>
          <Link href="/calendar" asChild>
            <Pressable style={styles.actionLink}>
              <Text style={styles.actionText}>View Calendar →</Text>
            </Pressable>
          </Link>
        </Card>
      )}

      <Card>
        <SectionTitle>Today's Numbers</SectionTitle>
        <View style={styles.numbersGrid}>
          <View style={styles.numberItem}>
            <Text style={styles.numberValue}>{appointments.length}</Text>
            <SupportText>Appointment{appointments.length === 1 ? '' : 's'}</SupportText>
          </View>
          <View style={styles.numberItem}>
            <Text style={styles.numberValue}>{new Set(appointments.map((a) => a.client?.id)).size}</Text>
            <SupportText>Client{new Set(appointments.map((a) => a.client?.id)).size === 1 ? '' : 's'}</SupportText>
          </View>
        </View>
      </Card>

      {laterAppointments.length > 0 && (
        <Card>
          <SectionTitle>Later Today</SectionTitle>
          <View style={styles.laterList}>
            {laterAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.laterItem}>
                <Text style={styles.laterTime}>{formatTime(appointment.start_at)}</Text>
                <View style={styles.laterContent}>
                  <Text style={styles.laterClient}>{appointment.client?.display_name ?? 'Client'}</Text>
                  <SupportText>{appointment.service_name}</SupportText>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <SectionTitle>Quick Links</SectionTitle>
        <View style={styles.quickLinksGrid}>
          <Link href="/clients" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Clients</Text>
            </Pressable>
          </Link>
          <Link href="/messages" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Messages</Text>
            </Pressable>
          </Link>
          <Link href="/content" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Content</Text>
            </Pressable>
          </Link>
          <Link href="/media" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Media</Text>
            </Pressable>
          </Link>
          <Link href="/analytics" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Analytics</Text>
            </Pressable>
          </Link>
          <Link href="/finance" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Finance</Text>
            </Pressable>
          </Link>
          <Link href="/automations" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Automations</Text>
            </Pressable>
          </Link>
          <Link href="/ai" asChild>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>Ask AI</Text>
            </Pressable>
          </Link>
        </View>
      </Card>
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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: ui.spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: ui.spacing.xs,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ui.colors.elevated,
  },
  actionLink: {
    marginTop: ui.spacing.sm,
  },
  actionText: {
    color: ui.colors.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  bookingCard: {
    gap: ui.spacing.xs,
    marginVertical: ui.spacing.sm,
  },
  bookingTime: {
    color: ui.colors.primaryText,
    fontSize: 24,
    fontWeight: '600',
  },
  bookingClient: {
    color: ui.colors.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  numbersGrid: {
    flexDirection: 'row',
    gap: ui.spacing.md,
    marginVertical: ui.spacing.sm,
  },
  numberItem: {
    flex: 1,
    gap: ui.spacing.xs,
  },
  numberValue: {
    color: ui.colors.gold,
    fontSize: 28,
    fontWeight: '600',
  },
  laterList: {
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  laterItem: {
    flexDirection: 'row',
    gap: ui.spacing.sm,
    alignItems: 'center',
    paddingVertical: ui.spacing.xs,
  },
  laterTime: {
    color: ui.colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
    minWidth: 50,
  },
  laterContent: {
    flex: 1,
    gap: 2,
  },
  laterClient: {
    color: ui.colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
    marginVertical: ui.spacing.sm,
  },
  quickLink: {
    flex: 0.45,
    paddingVertical: ui.spacing.sm,
    paddingHorizontal: ui.spacing.sm,
    backgroundColor: ui.colors.elevated,
    borderRadius: ui.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: {
    color: ui.colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
});
