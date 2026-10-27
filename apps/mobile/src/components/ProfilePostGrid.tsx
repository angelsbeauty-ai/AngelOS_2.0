import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { PostThumb } from './PostThumb';
import { SatinGlyph } from './SatinGlyph';
import { ErrorState } from './ErrorState';
import { EmptyState, Skeleton } from './ui';
import { useAppearance } from '../design/appearance';
import { D, N, tokens } from '../design/theme';
import type { ContentPost } from '../lib/content';
import { isCarousel, isVideo, platformPosts, type ProfilePlatform } from '../lib/grid';

const GAP = 1;
const NAME: Record<ProfilePlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

/** One platform's profile grid: 3 square columns, 1pt gaps, like the app shows it. Real posts only. */
export function ProfilePostGrid({ platform, workspaceId, posts, failed, onRetry, inset = 32 }: { platform: ProfilePlatform; workspaceId: string | null; posts: ContentPost[] | null; failed: boolean; onRetry: () => void; inset?: number }) {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const outer = Math.min(width, 600) - inset;
  const cell = Math.floor((outer - GAP * 2) / 3);
  const ph = mode === 'night' ? N.card : D.fill2;
  const rose = mode === 'night' ? tokens.color.roseGoldNight : tokens.color.roseGold;
  const list = posts ? platformPosts(posts, platform).slice(0, 12) : [];
  return <View style={{ gap: 8 }}>
    <View style={styles.head}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.title, { color: palette.text }]}>{t('profileGrid.title', { defaultValue: '{{name}} posts', name: NAME[platform] })}</Text>
      {list.length ? <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/content/grid' as any)}><Text style={[styles.link, { color: rose }]}>{t('profileGrid.all', 'See all')}</Text></Pressable> : null}
    </View>
    {failed ? <ErrorState title={t('profileGrid.errTitle', 'Posts did not load')} message={t('profileGrid.errBody', 'Check your connection and try again.')} onRetry={onRetry} />
      : posts === null ? <Skeleton rows={1} height={cell} />
      : !list.length ? <EmptyState title={t('profileGrid.emptyTitle', { defaultValue: 'No {{name}} posts yet', name: NAME[platform] })} message={t('profileGrid.emptyBody', 'Posts you publish or schedule here will show in this grid.')} action={{ label: t('grid.create', 'Create'), onPress: () => router.push({ pathname: '/content/new', params: { platform } } as any) }} />
      : <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={[styles.grid, { width: outer }]}>
        {list.map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={[p.title, isCarousel(p) ? t('grid.carousel', 'Carousel') : null, isVideo(p) ? t('grid.video', 'Video') : null].filter(Boolean).join(', ')} onPress={() => router.push(`/content/${p.id}` as any)} style={({ pressed }) => [{ width: cell, height: cell, opacity: pressed ? 0.85 : 1 }]}>
          <PostThumb workspaceId={workspaceId} post={p} size={cell} height={cell} radius={0} placeholder={ph} textTile />
          {isCarousel(p) ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="carousel" color={tokens.color.onCharcoal} size={16} /></View>
            : isVideo(p) ? <View pointerEvents="none" style={styles.corner}><SatinGlyph name="play" color={tokens.color.onCharcoal} size={16} /></View> : null}
        </Pressable>)}
      </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  title: { ...tokens.type.headline, fontFamily: tokens.font.uiBold },
  link: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold, lineHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center' },
  corner: { position: 'absolute', top: 6, right: 6 }
});
