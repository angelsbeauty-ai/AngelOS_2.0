import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import {
  AppTitle,
  BodyText,
  Card,
  Pill,
  PrimaryActionLabel,
  SecondaryActionLabel,
  SectionTitle,
  SupportText,
  ui
} from '../src/components/ui';
import { getSystemHealth, type SystemHealthOverview } from '../src/lib/system-health';
import { getActiveWorkspace } from '../src/lib/workspace';
import { supabase } from '../src/lib/supabase';

export default function HomeScreen() {
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const signedIn = Boolean(data.session);
      setIsSignedIn(signedIn);
      setSessionReady(true);
      if (signedIn) void loadHealth();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const signedIn = Boolean(session);
      setIsSignedIn(signedIn);
      setSessionReady(true);
      if (signedIn) void loadHealth();
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadHealth() {
    try {
      const workspace = await getActiveWorkspace();
      setHealth(await getSystemHealth(workspace.id));
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

  const attentionCount = health ? health.counts.urgent + health.counts.today + health.counts.later : 0;
  const hasAttention = attentionCount > 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Screen>
      <View style={styles.hero}>
        <Pill tone="gold">Owner Dashboard</Pill>
        <AppTitle>AngelOS</AppTitle>
        <SupportText>{today}</SupportText>
        <SupportText>Your clients, bookings, content and next actions in one place.</SupportText>
      </View>

      {hasAttention ? (
        <Card premium>
          <View style={styles.attentionHeader}>
            <View style={{ flex: 1 }}>
              <SectionTitle>Needs Attention</SectionTitle>
              <SupportText>{attentionCount} item{attentionCount === 1 ? '' : 's'} before AngelOS acts.</SupportText>
            </View>
            <Pill tone={health?.counts.urgent ? 'critical' : 'warning'}>{health?.counts.urgent || 0} urgent</Pill>
          </View>
          <Link href="/system-health" asChild>
            <Pressable>
              <PrimaryActionLabel>Review Attention</PrimaryActionLabel>
            </Pressable>
          </Link>
        </Card>
      ) : (
        <Card>
          <SectionTitle>All clear</SectionTitle>
          <SupportText>Nothing currently needs your attention.</SupportText>
          <Link href="/system-health" asChild>
            <Pressable>
              <SecondaryActionLabel>Check System Health</SecondaryActionLabel>
            </Pressable>
          </Link>
        </Card>
      )}

      <Card premium>
        <View style={styles.cardHeader}>
          <SectionTitle>AngelOS Assistant</SectionTitle>
          <Pill>AI ready</Pill>
        </View>
        <BodyText>Ask what needs attention, draft a reply, prepare content, or review today's schedule.</BodyText>
        <Link href="/ai" asChild>
          <Pressable>
            <PrimaryActionLabel>Ask AngelOS</PrimaryActionLabel>
          </Pressable>
        </Link>
      </Card>

      <View>
        <SectionTitle>Run Today</SectionTitle>
        <View style={styles.actionGrid}>
          <ActionCard href="/calendar" title="Calendar" detail="Bookings and conflicts" />
          <ActionCard href="/clients" title="Clients" detail="Profiles and history" />
          <ActionCard href="/messages" title="Messages" detail="Drafts and handoff" />
          <ActionCard href="/content" title="Content" detail="Approve and publish" />
        </View>
      </View>

      <Card>
        <SectionTitle>More</SectionTitle>
        <View style={styles.moreGrid}>
          <MoreLink href="/media" label="Media" />
          <MoreLink href="/analytics" label="Analytics" />
          <MoreLink href="/finance" label="Finance" />
          <MoreLink href="/automations" label="Automations" />
          <MoreLink href="/subscription" label="Subscription" />
          <MoreLink href="/settings" label="Settings" />
        </View>
      </Card>
    </Screen>
  );
}

function ActionCard({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.actionCard}>
        <Text style={styles.actionTitle}>{title}</Text>
        <SupportText>{detail}</SupportText>
      </Pressable>
    </Link>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={styles.moreLink}>
      {label}
    </Link>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: ui.spacing.xs
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ui.spacing.sm,
    marginBottom: ui.spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ui.spacing.sm
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
    marginTop: ui.spacing.sm
  },
  actionCard: {
    width: '48%',
    padding: ui.spacing.sm,
    borderRadius: ui.radius.card,
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: ui.colors.elevated,
    gap: 4
  },
  actionTitle: {
    color: ui.colors.primaryText,
    fontSize: 17,
    fontWeight: '700'
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.xs
  },
  moreLink: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: ui.spacing.sm,
    borderRadius: ui.radius.pill,
    borderWidth: 1,
    borderColor: ui.colors.border,
    color: ui.colors.primaryText,
    backgroundColor: ui.colors.elevated,
    fontSize: 14,
    fontWeight: '700'
  }
});
