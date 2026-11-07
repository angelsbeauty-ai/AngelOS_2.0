import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import type { ContentPost } from '../lib/content';
import type { ProfilePlatform } from '../lib/grid';

const NAME: Record<ProfilePlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

/** Account settings link to the one feed, rather than embedding a second capped browser. */
export function ProfilePostGrid({ platform }: { platform: ProfilePlatform; workspaceId: string | null; posts: ContentPost[] | null; failed: boolean; onRetry: () => void; inset?: number }) {
  const { t } = useTranslation();
  const { palette } = useAppearance();
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/analytics', params: { pane: 'profile' } })} style={styles.link}>
    <Text style={[styles.title, { color: palette.text }]}>{t('profileGrid.title', { defaultValue: '{{name}} posts', name: NAME[platform] })}</Text>
    <Text style={{ color: palette.muted }}>{t('an2.profilePages')}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ link: { minHeight: 44, justifyContent: 'center', gap: 4 }, title: { ...tokens.type.headline } });
