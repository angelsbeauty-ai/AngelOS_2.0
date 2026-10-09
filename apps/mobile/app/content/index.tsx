import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { getActiveWorkspace } from '../../src/lib/workspace';

export default function SocialHubScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    void (async () => {
      const workspace = await getActiveWorkspace();
      setWorkspaceId(workspace.id);
    })();
  }, []);

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();

  const getDayOfWeek = (date: Date) => date.getDay();
  const firstDayOffset = getDayOfWeek(monthStart);

  const goToMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Pill tone="gold">Content & Social</Pill>
          <ScreenTitle>Social Hub</ScreenTitle>
          <SupportText>Plan and manage your social media posts, campaigns and analytics.</SupportText>
        </View>
        <Link href="/content/new" asChild>
          <Pressable style={styles.newButton}>
            <PrimaryActionLabel>New Post</PrimaryActionLabel>
          </Pressable>
        </Link>
      </View>

      <Card premium>
        <SectionTitle>Month Calendar</SectionTitle>
        <View style={styles.monthHeader}>
          <Pressable onPress={() => goToMonth(-1)} style={styles.monthNav}>
            <Text style={styles.monthNavText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => goToMonth(1)} style={styles.monthNav}>
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendar}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <View key={day} style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}

          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCell} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
            const isToday = 
              date.getDate() === new Date().getDate() &&
              date.getMonth() === new Date().getMonth() &&
              date.getFullYear() === new Date().getFullYear();

            return (
              <Pressable
                key={`day-${i}`}
                style={[styles.dayCell, isToday && styles.today]}
                onPress={() => {
                  // Navigate to create post for this date
                }}
              >
                <Text style={[styles.dayNumber, isToday && styles.todayText]}>{i + 1}</Text>
                <View style={styles.dayDots}>
                  {/* Placeholder for draft/scheduled/posted indicator dots */}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <SectionTitle>Views</SectionTitle>
        <View style={styles.viewGrid}>
          <Link href="/content?view=drafts" asChild>
            <Pressable style={styles.viewButton}>
              <Text style={styles.viewLabel}>Drafts</Text>
            </Pressable>
          </Link>
          <Link href="/content?view=scheduled" asChild>
            <Pressable style={styles.viewButton}>
              <Text style={styles.viewLabel}>Scheduled</Text>
            </Pressable>
          </Link>
          <Link href="/content?view=posted" asChild>
            <Pressable style={styles.viewButton}>
              <Text style={styles.viewLabel}>Posted</Text>
            </Pressable>
          </Link>
          <Link href="/content?view=ideas" asChild>
            <Pressable style={styles.viewButton}>
              <Text style={styles.viewLabel}>Ideas</Text>
            </Pressable>
          </Link>
        </View>
      </Card>

      <Card>
        <SectionTitle>Quick Actions</SectionTitle>
        <View style={styles.actionList}>
          <Link href="/content/before-after" asChild>
            <Pressable style={styles.actionRow}>
              <BodyText>Before & After Composer</BodyText>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
          <Link href="/content/campaigns" asChild>
            <Pressable style={styles.actionRow}>
              <BodyText>Plan Campaign</BodyText>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
          <Link href="/settings/connections" asChild>
            <Pressable style={styles.actionRow}>
              <BodyText>Connect Social Accounts</BodyText>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ui.spacing.sm,
    marginBottom: ui.spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: ui.spacing.xs,
  },
  newButton: {
    width: 120,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ui.spacing.md,
    paddingHorizontal: ui.spacing.sm,
  },
  monthTitle: {
    color: ui.colors.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  monthNav: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: {
    color: ui.colors.gold,
    fontSize: 24,
    fontWeight: '600',
  },
  calendar: {
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'row',
  },
  dayHeader: {
    width: '14.28%',
    paddingVertical: ui.spacing.xs,
    alignItems: 'center',
  },
  dayHeaderText: {
    color: ui.colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 8,
  },
  today: {
    backgroundColor: ui.colors.elevated,
    borderWidth: 2,
    borderColor: ui.colors.gold,
  },
  dayNumber: {
    color: ui.colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  todayText: {
    color: ui.colors.gold,
  },
  dayDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  viewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
  },
  viewButton: {
    flex: 0.48,
    paddingVertical: ui.spacing.sm,
    paddingHorizontal: ui.spacing.sm,
    backgroundColor: ui.colors.elevated,
    borderRadius: ui.radius.control,
    alignItems: 'center',
  },
  viewLabel: {
    color: ui.colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  actionList: {
    gap: ui.spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ui.spacing.xs,
  },
  chevron: {
    color: ui.colors.gold,
    fontSize: 20,
  },
});
