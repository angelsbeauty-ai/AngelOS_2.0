import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getMediaViewUrl } from '../lib/media';
import type { ContentPost } from '../lib/content';

const cache = new Map<string, string>();

/** Real photo thumbnail for a post (first image), with the calm two-tone placeholder while loading or when there is none. */
export function PostThumb({ workspaceId, post, size = 60, radius = 14 }: { workspaceId: string | null; post: ContentPost; size?: number; radius?: number }) {
  const asset = [...(post.media ?? [])].sort((a, b) => a.position - b.position).find((m) => m.asset?.media_type === 'image')?.asset;
  const [url, setUrl] = useState<string | null>(asset ? cache.get(asset.id) ?? null : null);
  useEffect(() => {
    if (!workspaceId || !asset || cache.has(asset.id)) return;
    let live = true;
    void getMediaViewUrl(workspaceId, asset.id).then((r) => { cache.set(asset.id, r.url); if (live) setUrl(r.url); }).catch(() => undefined);
    return () => { live = false; };
  }, [workspaceId, asset?.id]);
  const box = { width: size, height: size, borderRadius: radius };
  if (url) return <Image source={{ uri: url }} style={[box, { backgroundColor: '#E5DDD5' }]} accessibilityIgnoresInvertColors />;
  return <View style={[box, styles.ph]}><View style={[styles.half, { backgroundColor: '#D9CFC6' }]} /><View style={{ width: 2 }} /><View style={[styles.half, { backgroundColor: '#C9A99B' }]} /></View>;
}

const styles = StyleSheet.create({ ph: { overflow: 'hidden', flexDirection: 'row', backgroundColor: '#FFF' }, half: { flex: 1 } });
