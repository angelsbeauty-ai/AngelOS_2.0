import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui';
import { tokens } from '../design/theme';
import { getSocialNumbers, PLATFORM_NAME, type SocialNumber } from '../lib/social';

/** Followers + simple engagement from connected accounts only. No connection = a Connect prompt, never zeros. */
export function SocialNumbersCard({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<SocialNumber[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { getSocialNumbers(workspaceId).then((r) => setItems(r.items)).catch((e) => setFailed(e instanceof Error ? e.message : 'unknown error')); }, [workspaceId]);
  const fmt = (n: number) => n.toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US');
  if (failed) return <View style={styles.card}><Text style={styles.title}>{t('sml.numbersTitle')}</Text><Text style={styles.body}>{t('acs.loadFail')}: {failed}</Text></View>;
  if (!items) return null;
  if (!items.length) return <View style={styles.card}>
    <Text style={styles.title}>{t('sml.numbersTitle')}</Text>
    <Text style={styles.body}>{t('sml.numbersEmpty')}</Text>
    <Button small variant="secondary" label={t('sml.connectAccount')} onPress={() => router.push('/content/accounts')} />
  </View>;
  return <View style={styles.card}>
    <Text style={styles.title}>{t('sml.numbersTitle')}</Text>
    {items.map((n) => <View key={n.platform} style={styles.row}>
      <Text numberOfLines={1} style={styles.name}>{PLATFORM_NAME[n.platform]}</Text>
      <View style={styles.vals}>
        <Text numberOfLines={1} style={styles.val}>{n.followers == null ? t('acs.na') : t(n.platform === 'line' ? 'sml.friends' : 'sml.followers', { n: fmt(n.followers) })}</Text>
        {n.platform !== 'line' ? <Text numberOfLines={1} style={styles.sub}>{t('acs.posts')}: {n.posts == null ? t('acs.na') : fmt(n.posts)}</Text> : null}
        {n.engagement != null ? <Text numberOfLines={1} style={styles.sub}>{t('sml.engagement', { n: fmt(n.engagement) })}</Text> : null}
        {n.followersChange7d != null ? <Text numberOfLines={1} style={styles.sub}>{t('sml.change7d', { n: (n.followersChange7d >= 0 ? '+' : '') + fmt(n.followersChange7d) })}</Text> : null}
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFECE6' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#6B645B' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515', flexShrink: 0, minWidth: 90 },
  vals: { flex: 1, alignItems: 'flex-end', gap: 2 },
  val: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  sub: { fontFamily: tokens.font.ui, fontSize: 12, color: '#6B645B' }
});
