import { BrandLogo } from './BrandBadge';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from './ui';
import { tokens, webGlass } from '../design/theme';
import { getSocialAccounts, PLATFORM_NAME, type SocialAccount } from '../lib/social';

/** Real connected accounts: photo, name, followers, posts. Unknown numbers say "not available" (never 0). Sync problems are shown, not hidden. */
export function AccountsStrip({ workspaceId, accounts: given }: { workspaceId: string; accounts?: SocialAccount[] }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<SocialAccount[] | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (given) return;
    setError(null);
    getSocialAccounts(workspaceId).then(setItems).catch((e) => setError(e instanceof Error ? e.message : t('acs.loadFail')));
  }, [workspaceId, given, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const fmt = (n: number | null | undefined) => (n == null ? t('acs.na') : n.toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'));
  if (error) return <View style={styles.card}><Text style={styles.warn}>{t('acs.loadFail')}: {error}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={load} /></View>;
  if (!items) return null;
  const shown = items.filter((a) => a.state !== 'not_connected');
  if (!shown.length) return <View style={styles.card}>
    <Text style={styles.title}>{t('acs.none')}</Text>
    <Button small variant="secondary" label={t('inbox.connectBtn')} onPress={() => router.push('/content/accounts')} />
  </View>;
  return <View style={styles.card}>
    {shown.map((a) => <Pressable key={a.platform} accessibilityRole="button" accessibilityLabel={`${PLATFORM_NAME[a.platform]} ${a.name ?? ''}`} onPress={() => router.push('/content/accounts')} style={styles.row}>
      <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}><BrandLogo platform={a.platform} size={32} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={styles.title}>{PLATFORM_NAME[a.platform]}{a.name ? ` · ${a.handle ?? a.name}` : ''}</Text>
        <Text numberOfLines={1} style={styles.body}>{t(a.platform === 'line' ? 'acs.friends' : 'acs.followers')}: {fmt(a.followers)}{a.platform !== 'line' ? ` · ${t('acs.posts')}: ${fmt(a.posts)}` : ''}</Text>
        {a.state === 'needs_reconnect' ? <Text numberOfLines={3} style={styles.warn}>{a.reason ?? t('sml.reconnect')}</Text> : null}
        {a.syncError ? <Text numberOfLines={3} style={styles.warn}>{a.syncError}</Text> : null}
      </View>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFECE6', ...(webGlass as object) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  avatarText: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  body: { fontFamily: tokens.font.ui, fontSize: 13, color: '#6B645B' },
  warn: { fontFamily: tokens.font.uiMedium, fontSize: 13, lineHeight: 18, color: tokens.color.warning }
});
