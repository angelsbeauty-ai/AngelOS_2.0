import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Tabs } from '../../src/components/Field';
import { Badge, BodyText, Button, Card, EmptyState, Header, SectionTitle, Skeleton, SupportText, ui } from '../../src/components/ui';
import { ErrorState } from '../../src/components/ErrorState';
import { getMediaViewUrl, listMedia, updateMedia, type MediaAsset } from '../../src/lib/media';
import { listClients, type ClientSummary } from '../../src/lib/clients';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { confirm, dialog } from '../../src/lib/dialog';
import { toFriendly, type FriendlyResult } from '../../src/lib/friendly-error';

const ROLES = ['before', 'after', 'healed', 'touch_up', 'content_source', 'other'] as const;

/** Full-screen photo viewer: tag, marketing toggle, link a client, remove from library. */
export default function MediaViewerScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wsId, setWsId] = useState<string | null>(null);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FriendlyResult | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const ws = (await getActiveWorkspace()).id; setWsId(ws);
      const found = (await listMedia(ws)).find((a) => a.id === id) ?? null;
      setAsset(found);
      if (found && found.media_type === 'image') setUrl((await getMediaViewUrl(ws, found.id)).url);
      setClients(await listClients(ws, '', 'all').catch(() => []));
    } catch (e) { setError(toFriendly(e, { action: 'load', thing: 'photo' })); }
    finally { setBusy(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save(patch: Record<string, unknown>) {
    if (!wsId || !asset) return;
    setSaving(true);
    try { await updateMedia(wsId, asset.id, patch); await load(); }
    catch (e) { const f = toFriendly(e, { action: 'save', thing: 'photo' }); void dialog.notify(f.title, f.message); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!asset) return;
    if (!(await confirm({ title: t('media.removeTitle'), message: t('media.removeMsg'), confirmText: t('media.remove'), destructive: true }))) return;
    await save({ lifecycleStatus: 'archived' });
    router.back();
  }

  const link = asset?.links?.[0];
  return <Screen onRefresh={load}>
    <Header title={t('media.viewerTitle')} subtitle={asset?.original_filename} />
    {busy && !asset ? <Skeleton rows={2} height={220} /> : null}
    {!busy && error ? <ErrorState title={error.title} message={error.message} onRetry={() => void load()} /> : null}
    {!busy && !error && !asset ? <EmptyState title={t('media.notFound')} action={{ label: t('media.back'), onPress: () => router.back() }} /> : null}
    {asset ? <>
      {url ? <Image source={{ uri: url }} resizeMode="contain" accessibilityLabel={asset.original_filename} style={styles.image} /> : <Card><BodyText>{asset.media_type === 'video' ? t('media.videoNote') : t('media.noPreview')}</BodyText></Card>}
      <Card>
        <SectionTitle>{t('media.tag')}</SectionTitle>
        <Tabs value={(link?.role ?? 'other') as (typeof ROLES)[number]} options={ROLES.map((r) => ({ id: r, label: t(`media.role.${r}`) }))} onChange={(role) => void save({ role })} />
      </Card>
      <Card>
        <View style={styles.line}>
          <View style={{ flex: 1 }}><SectionTitle>{t('media.marketing')}</SectionTitle><SupportText>{t('media.marketingHint')}</SupportText></View>
          <Switch accessibilityLabel={t('media.marketing')} disabled={saving} value={asset.marketing_permission === 'marketing_approved'} trackColor={{ false: ui.colors.border, true: ui.colors.softGold }} thumbColor={ui.colors.gold}
            onValueChange={(on) => void save({ marketingPermission: on ? 'marketing_approved' : 'private' })} />
        </View>
        <Badge status={asset.marketing_permission === 'marketing_approved' ? 'confirmed' : 'cancelled'} label={asset.marketing_permission === 'marketing_approved' ? t('media.okMarketing') : t('media.notMarketing')} />
      </Card>
      <Card>
        <SectionTitle>{t('media.client')}</SectionTitle>
        <SupportText>{link?.client?.display_name ?? t('media.notLinked')}</SupportText>
        {clients.length === 0 ? <SupportText>{t('media.noClients')}</SupportText> : <View style={styles.chips}>
          {link?.client_id ? <Button small variant="secondary" label={t('media.unlink')} disabled={saving} onPress={() => void save({ clientId: null })} /> : null}
          {clients.slice(0, 12).map((c) => <Button key={c.id} small variant={link?.client_id === c.id ? 'primary' : 'secondary'} label={c.display_name} disabled={saving} onPress={() => void save({ clientId: c.id })} />)}
        </View>}
      </Card>
      <Button variant="danger" label={t('media.remove')} loading={saving} onPress={() => void remove()} />
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 4 / 5, borderRadius: 28, backgroundColor: 'rgba(42,39,37,0.06)' },
  line: { flexDirection: 'row', alignItems: 'center', gap: ui.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs },
});
