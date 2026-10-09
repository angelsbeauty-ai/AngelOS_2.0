import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { dialog } from '../../src/lib/dialog';
import { Link, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { BodyText, Button, Card, EmptyState, Header, Pill, SectionTitle, Skeleton, StatTile, SupportText, ui } from '../../src/components/ui';
import { getMediaViewUrl, listMedia, type MediaAsset } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';

export default function MediaLibraryScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null); const [assets, setAssets] = useState<MediaAsset[]>([]); const [previews, setPreviews] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(true);
  useEffect(() => { void load(); }, []);
  async function load() { setBusy(true); try { const workspace = workspaceId ? { id: workspaceId } : await getActiveWorkspace(); if (!workspaceId) setWorkspaceId(workspace.id); const rows = await listMedia(workspace.id); setAssets(rows); const imageRows = rows.filter((row) => row.media_type === 'image' && row.upload_status === 'uploaded').slice(0, 24); const urls = await Promise.all(imageRows.map(async (row) => [row.id, (await getMediaViewUrl(workspace.id, row.id)).url] as const)); setPreviews(Object.fromEntries(urls)); } catch (error) { void dialog.notify('Could not load media', error instanceof Error ? error.message : 'Unknown error'); } finally { setBusy(false); } }
  const approvedCount = assets.filter((asset) => asset.marketing_permission === 'marketing_approved').length;

  return <Screen onRefresh={() => load()}>
    <Header eyebrow="Secure Library" title="Media" subtitle="Your photos, videos and business assets in one calm workspace." action={<Button small label="Import" onPress={() => router.push('/media/import')} />} />
    <View style={styles.summaryRow}><StatTile label="Total assets" value={assets.length} detail="Secure business copies" /><StatTile label="Marketing ready" value={approvedCount} detail="Approved for use" /></View>
    {busy && assets.length === 0 ? <Skeleton rows={2} height={160} /> : null}
    {!busy && assets.length === 0 ? <EmptyState title="No media yet" message="Import from Photos or take a new business photo to begin." action={{ label: 'Import', onPress: () => router.push('/media/import') }} /> : null}
    <View style={styles.grid}>{assets.map((asset) => <Pressable key={asset.id} accessibilityRole="button" accessibilityLabel={`Open ${asset.original_filename}`} onPress={() => router.push(`/media/${asset.id}` as any)} style={styles.assetCard}>
      {asset.media_type === 'image' && previews[asset.id] ? <Image source={{ uri: previews[asset.id] }} style={styles.preview} /> : <View style={styles.placeholder}><Pill>{asset.media_type === 'video' ? 'Video' : 'File'}</Pill></View>}
      <View style={styles.assetCopy}><Text numberOfLines={1} style={styles.filename}>{asset.original_filename}</Text><SupportText>{asset.links?.[0]?.client?.display_name ?? 'Not linked'}</SupportText><Pill tone={asset.marketing_permission === 'marketing_approved' ? 'success' : asset.marketing_permission === 'private' ? 'critical' : 'secondary'}>{asset.marketing_permission.replaceAll('_', ' ')}</Pill></View>
    </Pressable>)}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ui.spacing.sm }, headerCopy: { flex: 1, gap: ui.spacing.xs }, importButton: { width: 104 }, summaryRow: { flexDirection: 'row', gap: ui.spacing.sm },
  libraryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ui.spacing.sm }, refreshButton: { width: 104 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.sm }, assetCard: { width: '47.5%', overflow: 'hidden', borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.card, backgroundColor: ui.colors.elevated },
  preview: { width: '100%', aspectRatio: 1 }, placeholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.warmSurface }, assetCopy: { gap: ui.spacing.xs, padding: ui.spacing.sm }, filename: { color: ui.colors.primaryText, fontSize: 14, fontWeight: '700' }
});
