import { BrandLogo } from './BrandBadge';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from './ui';
import { tokens, webGlass } from '../design/theme';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useAppearance } from '../design/appearance';
import { getSocialAccounts, PLATFORM_NAME, type SocialAccount } from '../lib/social';

/** Real connected accounts: photo, name, followers, posts. Unknown numbers say "not available" (never 0). Sync problems are shown, not hidden. */
export function AccountsStrip({ workspaceId, accounts: given }: { workspaceId: string; accounts?: SocialAccount[] }) {
  const { t, i18n } = useTranslation();
  const { palette, mode } = useAppearance();
  const nc = mode === 'night' ? { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss } : null;
  const nt = mode === 'night' ? { color: palette.text } : null; const nm = mode === 'night' ? { color: palette.muted } : null;
  const [items, setItems] = useState<SocialAccount[] | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (given) return;
    setError(null);
    getSocialAccounts(workspaceId).then(setItems).catch((e) => setError(e instanceof Error ? e.message : t('acs.loadFail')));
  }, [workspaceId, given, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const fmt = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'));
  if (error) return <View style={[styles.card, nc]}><Text style={styles.warn}>{t('acs.loadFail')}: {error}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={load} /></View>;
  if (!items) return null;
  const shown = items.filter((a) => a.state !== 'not_connected');
  if (!shown.length) return <View style={[styles.card, nc]}>
    <Text style={styles.title}>{t('acs.none')}</Text>
    <Button small variant="secondary" label={t('inbox.connectBtn')} onPress={() => router.push('/content/accounts')} />
  </View>;
  return <View style={[styles.card, nc]}>
    {shown.map((a) => {
      const id = a.handle || a.name || '';
      return <Pressable key={a.platform} accessibilityRole="button" accessibilityLabel={`${id} ${PLATFORM_NAME[a.platform]}`} onPress={() => router.push('/content/accounts')} style={styles.row}>
      {a.pictureUrl ? <Image source={{ uri: a.pictureUrl }} style={styles.photo} /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={[styles.avatarText, nt]}>{(id.replace(/^@/, '')[0] ?? '?').toUpperCase()}</Text></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[styles.title, nt]}>{id}</Text>
        <View style={styles.stat}>
          <BrandLogo platform={a.platform} size={14} />
          {a.followers == null && (a.platform === 'line' || a.posts == null) ? <><Text numberOfLines={1} style={[styles.body, nm]}>{a.state === 'needs_reconnect' || a.syncError ? t('acs.reconnectStats', 'Reconnect to see stats') : t('acs.syncing', 'Stats syncing…')}</Text>{a.state === 'needs_reconnect' || a.syncError ? <CaretRight size={12} color={palette.muted} /> : null}</>
            : <Text numberOfLines={1} style={[styles.body, nm]}>{[a.followers != null ? `${t(a.platform === 'line' ? 'acs.friends' : 'acs.followers')}: ${fmt(a.followers)}` : null, a.platform !== 'line' && a.posts != null ? `${t('acs.posts')}: ${fmt(a.posts)}` : null].filter(Boolean).join(' · ')}</Text>}
        </View>
        {a.state === 'needs_reconnect' ? <Text numberOfLines={3} style={styles.warn}>{a.reason ?? t('sml.reconnect')}</Text> : null}
        {a.syncError ? <Text numberOfLines={3} style={styles.warn}>{a.syncError}</Text> : null}
      </View>
    </Pressable>; })}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2', ...(webGlass as object) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  photo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F2' },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  avatarText: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' },
  body: { fontFamily: tokens.font.ui, fontSize: 13, color: '#6B645B' },
  warn: { fontFamily: tokens.font.uiMedium, fontSize: 13, lineHeight: 18, color: tokens.color.warning }
});
