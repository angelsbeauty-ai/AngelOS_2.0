import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, SectionTitle, SupportText, ui } from './ui';
import { ActionButton } from './MessagingBits';
import { tokens } from '../design/theme';
import { getSocialInsights, platformLabel, type SocialInsights } from '../lib/content';

/** Insights › Social: only real numbers from AngelOS; platform metrics stay "Not connected yet". */
export function SocialInsightsCard({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<SocialInsights | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { getSocialInsights(workspaceId, 30).then(setData).catch(() => setFailed(true)); }, [workspaceId]);
  if (failed) return <Card><SectionTitle>Social</SectionTitle><SupportText>Couldn't load social numbers. Pull to refresh.</SupportText></Card>;
  if (!data) return <Card><SectionTitle>Social</SectionTitle><SupportText>Loading…</SupportText></Card>;
  const platforms = Object.entries(data.byPlatform);
  return <Card>
    <SectionTitle>Social · last {data.days} days</SectionTitle>
    <View style={styles.tiles}>
      <Tile label="Posted" value={platforms.reduce((a, [, v]) => a + v.posted, 0)} />
      <Tile label="Scheduled" value={platforms.reduce((a, [, v]) => a + v.scheduled, 0)} />
      <Tile label="New clients from social" value={data.fromSocial.newClients} />
      <Tile label="Their bookings" value={data.fromSocial.bookings} />
    </View>
    {platforms.map(([p, v]) => <SupportText key={p}>{p === 'line' ? 'LINE' : platformLabel(p)}: {v.posted} posted · {v.scheduled} scheduled · {v.drafts} drafts</SupportText>)}
    {Object.keys(data.fromSocial.bySource).length ? <SupportText>New clients by source: {Object.entries(data.fromSocial.bySource).map(([s, n]) => `${s} ${n}`).join(' · ')}</SupportText> : <SupportText>Set "Source" on new clients (Instagram, LINE…) to see which app brings bookings.</SupportText>}
    <Text style={styles.sub}>When you post</Text>
    <SupportText>{data.postingTimes.length ? data.postingTimes.map((t) => `${t.slot} (${t.count})`).join(' · ') : `Best time for now: ${data.bestTimeDefault}`}</SupportText>
    <Text style={styles.sub}>Reach, likes, followers</Text>
    <SupportText>{data.platformMetricsNote}</SupportText>
    <ActionButton label="Connect Instagram to see this" onPress={() => router.push('/settings/connections')} />
  </Card>;
}

function Tile({ label, value }: { label: string; value: number }) {
  return <View style={styles.tile}><Text style={styles.value}>{value}</Text><SupportText>{label}</SupportText></View>;
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { minWidth: 130, flexGrow: 1, padding: 12, borderRadius: 16, backgroundColor: tokens.color.glassTint },
  value: { fontFamily: tokens.font.display, fontSize: 30, color: ui.colors.primaryText, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText, marginTop: 6 }
});
