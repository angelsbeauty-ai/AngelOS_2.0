import { SuggestionsCard } from '../../src/components/SuggestionsCard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { contentPostDate, listContent, type ContentPost } from '../../src/lib/content';
import { toFriendly } from '../../src/lib/friendly-error';
import { getActiveWorkspace } from '../../src/lib/workspace';

type HubView = 'drafts' | 'scheduled' | 'posted' | 'ideas';

const STATUS_GROUP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: ui.colors.secondaryText },
  prepared: { label: 'Draft', color: ui.colors.secondaryText },
  approved: { label: 'Approved', color: ui.colors.gold },
  scheduled: { label: 'Scheduled', color: ui.colors.warning },
  publishing: { label: 'Posting', color: ui.colors.warning },
  published: { label: 'Posted', color: ui.colors.success },
  analyzed: { label: 'Posted', color: ui.colors.success },
  failed: { label: 'Failed', color: ui.colors.critical },
};
const VIEW_STATUSES: Record<Exclude<HubView, 'ideas'>, string[]> = {
  drafts: ['draft', 'prepared', 'approved'],
  scheduled: ['scheduled', 'publishing'],
  posted: ['published', 'analyzed'],
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function statusInfo(status: string) { return STATUS_GROUP[status] ?? { label: status, color: ui.colors.secondaryText }; }
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', line: 'LINE', manual: 'Manual' };

export default function SocialHubScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const activeView = (['drafts', 'scheduled', 'posted', 'ideas'] as const).find((value) => value === params.view) ?? null;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>(() => dayKey(new Date()));

  const load = useCallback(async () => {
    try {
      const workspace = await getActiveWorkspace();
      setPosts(await listContent(workspace.id));
      setState('ready');
    } catch (error) {
      const friendly = toFriendly(error, { action: 'load', thing: 'posts' });
      setErrorText(`${friendly.title}. ${friendly.message}`);
      setState('error');
    }
  }, []);

  // Reload whenever the screen regains focus, e.g. after saving a draft in the composer.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentPost[]>();
    for (const post of posts) {
      if (post.status === 'archived') continue;
      const date = contentPostDate(post);
      if (!date) continue;
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const firstDayOffset = monthStart.getDay();
  const todayKey = dayKey(new Date());

  const goToMonth = (offset: number) => {
    setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const listedPosts = activeView && activeView !== 'ideas'
    ? posts.filter((post) => VIEW_STATUSES[activeView].includes(post.status))
    : postsByDay.get(selectedDay) ?? [];
  const [selYear, selMonth, selDate] = selectedDay.split('-').map(Number);
  const selectedLabel = new Date(selYear, selMonth - 1, selDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });

  return (
    <Screen onRefresh={() => load()}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Pill tone="gold">Content & Social</Pill>
          <ScreenTitle>Social Hub</ScreenTitle>
          <SupportText>Plan and manage your social media posts, campaigns and analytics.</SupportText>
        </View>
        <Link href="/content/new" asChild>
          <Pressable style={styles.newButton} accessibilityRole="button" accessibilityLabel="New post">
            <PrimaryActionLabel>New Post</PrimaryActionLabel>
          </Pressable>
        </Link>
      </View>

      <Card premium>
        <SectionTitle>Month Calendar</SectionTitle>
        <View style={styles.monthHeader}>
          <Pressable onPress={() => goToMonth(-1)} style={styles.monthNav} accessibilityRole="button" accessibilityLabel="Previous month">
            <Text style={styles.monthNavText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => goToMonth(1)} style={styles.monthNav} accessibilityRole="button" accessibilityLabel="Next month">
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>

        {state === 'loading' ? <SupportText>Loading your posts…</SupportText> : null}
        {state === 'error' ? (
          <Pressable onPress={() => { setState('loading'); void load(); }} accessibilityRole="button">
            <SupportText tone="critical">{errorText} Tap to try again.</SupportText>
          </Pressable>
        ) : null}

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
            const key = dayKey(date);
            const isToday = key === todayKey;
            const isSelected = key === selectedDay && !activeView;
            const dayPosts = postsByDay.get(key) ?? [];

            return (
              <Pressable
                key={key}
                style={[styles.dayCell, isToday && styles.today, isSelected && styles.selectedDay]}
                onPress={() => setSelectedDay(key)}
                accessibilityRole="button"
                accessibilityLabel={`${date.toDateString()}, ${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'}`}
              >
                <Text style={[styles.dayNumber, isToday && styles.todayText]}>{i + 1}</Text>
                <View style={styles.dayDots}>
                  {dayPosts.slice(0, 4).map((post) => (
                    <View key={post.id} style={[styles.dot, { backgroundColor: statusInfo(post.status).color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          {(['draft', 'approved', 'scheduled', 'published', 'failed'] as const).map((status) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: statusInfo(status).color }]} />
              <Text style={styles.legendText}>{statusInfo(status).label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.listHeader}>
          <SectionTitle>
            {activeView ? `${activeView.charAt(0).toUpperCase()}${activeView.slice(1)}` : selectedLabel}
          </SectionTitle>
          {activeView ? (
            <Link href="/content" asChild><Pressable accessibilityRole="button"><Text style={styles.link}>Show calendar day</Text></Pressable></Link>
          ) : (
            <Link href={{ pathname: '/content/new', params: { date: selectedDay } }} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={`New post on ${selectedLabel}`}><Text style={styles.link}>+ Post on this day</Text></Pressable>
            </Link>
          )}
        </View>
        {activeView === 'ideas' ? <IdeasBank /> : null}
        {activeView !== 'ideas' && state === 'ready' && !listedPosts.length ? (
          <SupportText>{activeView ? 'Nothing here yet.' : 'No posts planned for this day.'}</SupportText>
        ) : null}
        {activeView !== 'ideas' ? listedPosts.map((post) => {
          const info = statusInfo(post.status);
          const date = contentPostDate(post);
          const platforms = Array.from(new Set((post.variants ?? []).map((variant) => PLATFORM_LABEL[variant.platform] ?? variant.platform)));
          return (
            <Link key={post.id} href={`/content/${post.id}`} asChild>
              <Pressable style={styles.postRow} accessibilityRole="button" accessibilityLabel={`${post.title}, ${info.label}`}>
                <View style={[styles.dot, styles.rowDot, { backgroundColor: info.color }]} />
                <View style={styles.postCopy}>
                  <BodyText>{post.title}</BodyText>
                  <SupportText>
                    {info.label}
                    {date ? ` · ${date.toLocaleString(undefined, activeView ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })}` : ''}
                    {platforms.length ? ` · ${platforms.join(', ')}` : ''}
                  </SupportText>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </Link>
          );
        }) : null}
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
  selectedDay: {
    backgroundColor: ui.colors.softGold,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing.sm,
    marginTop: ui.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    color: ui.colors.secondaryText,
    fontSize: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ui.spacing.sm,
  },
  link: {
    color: ui.colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ui.spacing.sm,
    minHeight: 56,
    paddingVertical: ui.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: ui.colors.border,
  },
  postCopy: {
    flex: 1,
    gap: 2,
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

function IdeasBank() {
  const [ws, setWs] = useState<string | null>(null);
  useEffect(() => { void getActiveWorkspace().then((w) => setWs(w.id)).catch(() => undefined); }, []);
  return <SuggestionsCard workspaceId={ws} showAllLink={false} />;
}
