import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui';
import { tokens, webGlass } from '../design/theme';
import { getSocialNumbers, type SocialNumber } from '../lib/social';

export type Plat = 'all' | 'instagram' | 'facebook' | 'line' | 'tiktok';
export const PLATS: Array<[Plat, string]> = [['all', ''], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['line', 'LINE'], ['tiktok', 'TikTok']];

/** Meta Business insights style tiles (views, interactions, followers). Only real connected-account numbers; never zeros for "not connected". */
export function MetaTiles({ workspaceId, platform }: { workspaceId: string; platform: Plat }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<SocialNumber[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { getSocialNumbers(workspaceId).then((r) => setItems(r.items)).catch((e) => setFailed(e instanceof Error ? e.message : 'unknown error')); }, [workspaceId]);
  if (failed) return <View style={styles.card}><Text style={styles.body}>{t('acs.loadFail')}: {failed}</Text></View>;
  if (!items) return null;
  const rows = items.filter((n) => platform === 'all' || n.platform === platform);
  if (!rows.length) return <View style={styles.card}>
    <Text style={styles.title}>{t('mt.emptyTitle')}</Text>
    <Text style={styles.body}>{t('mt.emptyBody')}</Text>
    <Button small variant="secondary" label={t('inbox.connectBtn')} onPress={() => router.push('/content/accounts')} />
  </View>;
  const sum = (pick: (n: SocialNumber) => number | null) => { const v = rows.map(pick).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const fmt = (n: number | null) => (n == null ? t('acs.na') : n.toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'));
  const tiles: Array<[string, number | null]> = [['views', sum((n) => n.reach)], ['interactions', sum((n) => n.engagement)], ['followers', sum((n) => n.followers)]];
  return <View style={styles.grid}>{tiles.map(([k, v]) => <View key={k} style={styles.tile}>
    <Text numberOfLines={1} style={styles.label}>{t(`mt.${k}`)}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, v == null && styles.muted]}>{fmt(v)}</Text>
  </View>)}</View>;
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2', ...(webGlass as object) },
  title: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#6C6C70' },
  grid: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, gap: 4, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2', ...(webGlass as object) },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 12, color: '#6C6C70' },
  value: { fontFamily: tokens.font.uiBold, fontSize: 26, fontVariant: ['tabular-nums'], color: '#151515' },
  muted: { fontSize: 15, fontFamily: tokens.font.ui, color: '#76767A' }
});
