import { ImageSquare } from 'phosphor-react-native/src/icons/ImageSquare';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getMediaViewUrl } from '../lib/media';
import type { ContentPost } from '../lib/content';
import { useAppearance } from '../design/appearance';
import { D, N, tokens } from '../design/theme';

const cache = new Map<string, string>();

/**
 * Real photo thumbnail for a post (first image). While a photo loads the tile is a flat neutral square.
 * A post with no photo at all shows a calm text tile (the first words of its caption) when `textTile` is on,
 * so a grid of text-only drafts still tells you which post is which.
 */
export function PostThumb({ workspaceId, post, size = 60, height, radius = 14, placeholder, textTile = false }: { workspaceId: string | null; post: ContentPost; size?: number; /** Defaults to size (square). */ height?: number; radius?: number; placeholder?: string; textTile?: boolean }) {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const asset = [...(post.media ?? [])].sort((a, b) => a.position - b.position).find((m) => m.asset?.media_type === 'image')?.asset;
  const [url, setUrl] = useState<string | null>(asset ? cache.get(asset.id) ?? null : null);
  useEffect(() => {
    if (!workspaceId || !asset || cache.has(asset.id)) return;
    let live = true;
    void getMediaViewUrl(workspaceId, asset.id).then((r) => { cache.set(asset.id, r.url); if (live) setUrl(r.url); }).catch(() => undefined);
    return () => { live = false; };
  }, [workspaceId, asset?.id]);
  const fill = placeholder ?? (night ? N.card : D.fill2);
  const box = { width: size, height: height ?? size, borderRadius: radius };
  if (url) return <Image source={{ uri: url }} resizeMode="cover" style={[box, { backgroundColor: fill }]} accessibilityIgnoresInvertColors />;
  const words = textTile && !asset ? (post.variants?.find((v) => v.caption)?.caption ?? post.title ?? '').trim() : '';
  if (words) return <View style={[box, styles.text, { backgroundColor: fill }]}>
    <Text numberOfLines={Math.max(2, Math.floor(((height ?? size) - 16) / tokens.type.footnote.lineHeight))} maxFontSizeMultiplier={1} style={[styles.words, { color: palette.text }]}>{words}</Text>
  </View>;
  // No photo on this post yet: a calm picture icon, not an empty grey box. Posts with a photo show the photo above.
  return <View style={[box, styles.icon, { backgroundColor: night ? N.field : 'rgba(0,0,0,0.05)' }]}><ImageSquare size={Math.round(Math.min(size, height ?? size) * 0.4)} color={palette.muted} weight="duotone" /></View>;
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  text: { padding: 8, justifyContent: 'center', overflow: 'hidden' },
  // Fixed size on purpose: the tile is a preview of the square, and VoiceOver reads the full title from the tile's label.
  words: { ...tokens.type.footnote, textAlign: 'center' },
});
