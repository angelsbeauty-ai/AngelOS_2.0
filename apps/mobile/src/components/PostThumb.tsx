import { ImageSquare } from 'phosphor-react-native/src/icons/ImageSquare';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMediaViewUrl } from '../lib/media';
import { getContentPost, type ContentPost } from '../lib/content';
import { useAppearance } from '../design/appearance';
import { D, N, tokens } from '../design/theme';

const cache = new Map<string, { url: string; expiresAt: number }>();

/** Shared real-media preview. Missing/failed media is never replaced by caption text or an invented image. */
export function PostThumb({ workspaceId, post, size = 60, height, radius = 14, placeholder }: { workspaceId: string | null; post: ContentPost; size?: number; height?: number; radius?: number; placeholder?: string }) {
  const { t } = useTranslation();
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const asset = [...(post.media ?? [])].sort((a, b) => a.position - b.position).find((m) => m.asset?.media_type === 'image')?.asset;
  const mediaKey = workspaceId && asset ? `${workspaceId}:${asset.id}` : null;
  const [remoteOverride, setRemoteOverride] = useState<{ postId: string; baseUrl: string | null | undefined; url: string | null } | null>(null);
  const remote = post.variants?.find((v) => v.capabilities_snapshot?.imported && v.capabilities_snapshot.preview_url)?.capabilities_snapshot?.preview_url;
  const importedUrl = remoteOverride && remoteOverride.postId === post.id && remoteOverride.baseUrl === remote ? remoteOverride.url : remote;
  const remoteUrl = typeof importedUrl === 'string' && importedUrl.startsWith('https://') ? importedUrl : null;
  const sourceKey = mediaKey ?? remoteUrl ?? post.id;
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setRetry(0);
  }, [mediaKey]);
  useEffect(() => {
    if (!workspaceId || !asset || !mediaKey) { setPhoto(null); return; }
    let live = true;
    const cached = cache.get(mediaKey);
    if (cached && cached.expiresAt > Date.now()) {
      setPhoto({ key: mediaKey, url: cached.url });
      return;
    }
    setPhoto(null);
    void getMediaViewUrl(workspaceId, asset.id).then((r) => {
      cache.set(mediaKey, { url: r.url, expiresAt: Date.now() + Math.max(0, r.expiresInSeconds - 30) * 1000 });
      if (live) setPhoto({ key: mediaKey, url: r.url });
    }).catch(() => { if (live) setFailedFor(mediaKey); });
    return () => { live = false; };
  }, [workspaceId, asset?.id, mediaKey, retry]);
  const url = asset ? (photo?.key === mediaKey ? photo.url : null) : remoteUrl;
  function retryPhoto() {
    if (mediaKey) {
      cache.delete(mediaKey); setPhoto(null); setFailedFor(null); setRetry((n) => n + 1);
    } else if (workspaceId) {
      // Sync refreshes expiring Meta CDN previews. Re-read the real post, never manufacture a cover.
      void getContentPost(workspaceId, post.id).then((fresh) => {
        const preview = fresh.variants?.find((v) => v.capabilities_snapshot?.preview_url)?.capabilities_snapshot?.preview_url ?? null;
        setRemoteOverride({ postId: post.id, baseUrl: remote, url: preview }); setFailedFor(null); setRetry((n) => n + 1);
      }).catch(() => undefined);
    }
  }
  function imageFailed() {
    setFailedFor(sourceKey);
    if (mediaKey && retry === 0) retryPhoto(); // A stale signed storage URL gets one automatic refresh.
  }
  const fill = placeholder ?? (night ? N.card : D.fill2);
  const box = { width: size, height: height ?? size, borderRadius: radius };
  if (url && failedFor !== sourceKey) return <Image key={`${sourceKey}:${retry}`} source={{ uri: url }} resizeMode="cover" style={[box, { backgroundColor: fill }]} onError={imageFailed} accessibilityIgnoresInvertColors />;
  const icon = <ImageSquare size={Math.round(Math.min(size, height ?? size) * 0.4)} color={palette.muted} weight="duotone" />;
  if (failedFor === sourceKey) return <Pressable accessibilityRole="button" accessibilityLabel={t('profileGrid.retryPhoto', 'Retry photo')} onPress={(event) => { event.stopPropagation(); retryPhoto(); }} style={[box, styles.icon, { minWidth: 44, minHeight: 44, backgroundColor: fill }]}>
    {icon}<Text numberOfLines={1} style={{ ...tokens.type.footnote, color: palette.muted }}>{t('common.tryAgain', 'Try again')}</Text>
  </Pressable>;
  return <View style={[box, styles.icon, { backgroundColor: night ? N.field : 'rgba(0,0,0,0.05)' }]}>{icon}</View>;
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
});
