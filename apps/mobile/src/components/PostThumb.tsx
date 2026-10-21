import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getMediaViewUrl } from '../lib/media';
import type { ContentPost } from '../lib/content';

const cache = new Map<string, string>();

/** Real photo thumbnail for a post (first image), with the calm two-tone placeholder while loading or when there is none. */
export function PostThumb({ workspaceId, post, size = 60, height, radius = 14, placeholder }: { workspaceId: string | null; post: ContentPost; size?: number; /** Defaults to size (square). */ height?: number; radius?: number; placeholder?: string }) {
  const asset = [...(post.media ?? [])].sort((a, b) => a.position - b.position).find((m) => m.asset?.media_type === 'image')?.asset;
  const [url, setUrl] = useState<string | null>(asset ? cache.get(asset.id) ?? null : null);
  useEffect(() => {
    if (!workspaceId || !asset || cache.has(asset.id)) return;
    let live = true;
    void getMediaViewUrl(workspaceId, asset.id).then((r) => { cache.set(asset.id, r.url); if (live) setUrl(r.url); }).catch(() => undefined);
    return () => { live = false; };
  }, [workspaceId, asset?.id]);
  const box = { width: size, height: height ?? size, borderRadius: radius };
  if (url) return <Image source={{ uri: url }} resizeMode="cover" style={[box, { backgroundColor: placeholder ?? '#F2F2F2' }]} accessibilityIgnoresInvertColors />;
  return placeholder ? <View style={[box, { backgroundColor: placeholder }]} /> : <View style={[box, styles.ph]}><View style={[styles.half, { backgroundColor: '#EDEDED' }]} /><View style={{ width: 2 }} /><View style={[styles.half, { backgroundColor: '#EDEDED' }]} /></View>;
}

const styles = StyleSheet.create({ ph: { overflow: 'hidden', flexDirection: 'row', backgroundColor: '#FFF' }, half: { flex: 1 } });
