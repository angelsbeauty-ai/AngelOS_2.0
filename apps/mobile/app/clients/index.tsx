import { NoStudio } from '../../src/components/NoStudio';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { RowMenu } from '../../src/components/RowMenu';
import { ErrorState } from '../../src/components/ErrorState';
import { Tabs } from '../../src/components/Field';
import { Avatar, Badge, Button, EmptyState, Header, Skeleton, SupportText, ui } from '../../src/components/ui';
import { isDemoSeed, listClients, setClientArchived, type ClientFilter, type ClientSummary } from '../../src/lib/clients';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { toFriendly, type FriendlyResult } from '../../src/lib/friendly-error';
import { label } from '../../src/lib/labels';
import { useAppearance } from '../../src/design/appearance';
import { confirm } from '../../src/lib/dialog';

const FILTER_IDS: ClientFilter[] = ['all', 'new', 'active', 'touch_up', 'archived'];

export default function ClientsScreen() {
  const { t } = useTranslation();
  const { mode } = useAppearance();
  const night = mode === 'night';
  const FILTERS = FILTER_IDS.map((id) => ({ id, label: t(`clients.filter.${id}`) }));
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyResult | null>(null);
  const [noStudio, setNoStudio] = useState(false);

  useEffect(() => { const t = setTimeout(() => void load(), search ? 300 : 0); return () => clearTimeout(t); }, [search, filter]);

  async function load() {
    setBusy(true); setLoadError(null);
    try {
      const id = workspaceId ?? (await getActiveWorkspace()).id;
      setWorkspaceId(id);
      setClients((await listClients(id, search, filter)).filter((c) => !isDemoSeed(c)));
    } catch (error) { if (isNoWorkspace(error)) setNoStudio(true); else setLoadError(toFriendly(error, { action: 'load', thing: 'clients' })); }
    finally { setBusy(false); }
  }

  async function archive(client: ClientSummary) {
    if (!workspaceId) return;
    const archived = Boolean(client.archived_at);
    if (!archived && !(await confirm({ title: t('clients.archiveTitle', { name: client.display_name }), message: t('clients.archiveMsg'), confirmText: t('clients.archive') }))) return;
    await setClientArchived(workspaceId, client.id, !archived).catch(() => undefined);
    await load();
  }

  return <Screen onRefresh={() => load()}>
    <Header title={t('clients.title')} action={<Pressable accessibilityRole="button" accessibilityLabel={t('clients.add')} onPress={() => router.push('/clients/new')} style={styles.plus}><Text style={styles.plusText}>+</Text></Pressable>} />
    <TextInput value={search} onChangeText={setSearch} placeholder={t('clients.search')} accessibilityLabel={t('clients.search')} placeholderTextColor={night ? '#9A9A9F' : ui.colors.secondaryText} style={[styles.search, night && { backgroundColor: '#161618', color: '#F4F4F5', borderColor: 'rgba(255,255,255,0.14)' }]} />
    <Tabs value={filter} options={FILTERS} onChange={setFilter} />
    {busy && !clients.length ? <Skeleton rows={4} /> : null}
    {noStudio ? <NoStudio /> : null}
    {!busy && loadError ? <ErrorState title={loadError.title} message={loadError.message} onRetry={() => void load()} /> : null}
    {!busy && !loadError && !noStudio && clients.length === 0 ? <EmptyState title={search || filter !== 'all' ? t('clients.noMatch') : t('clients.none')} message={search || filter !== 'all' ? undefined : t('clients.noneHint')} action={search || filter !== 'all' ? undefined : { label: t('clients.newClient'), onPress: () => router.push('/clients/new') }} /> : null}
    {clients.map((client) => <RowMenu key={client.id} accessibilityHint={t('clients.holdHint')} onPress={() => router.push(`/clients/${client.id}` as any)}
      actions={[{ id: 'book', title: t('clients.book') }, { id: 'edit', title: t('clients.edit') }, { id: 'archive', title: client.archived_at ? t('clients.unarchive') : t('clients.archive') }]}
      onAction={(action) => { if (action === 'book') router.push({ pathname: '/bookings/new', params: { clientId: client.id } }); if (action === 'edit') router.push(`/clients/${client.id}/edit` as any); if (action === 'archive') void archive(client); }}>
      <View style={[styles.clientRow, night && { backgroundColor: '#161618', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }]}>
        <Avatar name={client.display_name} />
        <View style={styles.clientCopy}><Text style={[styles.clientName, night && { color: '#F4F4F5' }]}>{client.display_name}</Text><View style={{ flexDirection: 'row' }}><Badge status={client.status === 'lead' ? 'request' : 'confirmed'} label={client.status === 'lead' ? t('clients.chipLead') : t('clients.chipClient')} /></View>{client.phone || client.email ? <SupportText>{client.phone ?? client.email}</SupportText> : null}</View>
        {client.health_flag ? <Badge status="request" label={t('clients.checkHealth')} /> : null}
        {client.archived_at ? <Badge status="cancelled" label={t('clients.archived')} /> : null}
      </View>
    </RowMenu>)}
  </Screen>;
}

const styles = StyleSheet.create({ search: { minHeight: 48, borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, backgroundColor: '#FFFFFF', color: ui.colors.primaryText, paddingHorizontal: ui.spacing.sm, fontSize: 16 }, clientRow: { flexDirection: 'row', gap: ui.spacing.sm, alignItems: 'center', minHeight: 64, padding: ui.spacing.sm, borderRadius: ui.radius.card, backgroundColor: '#FFFFFF' }, clientCopy: { flex: 1, gap: 2 }, plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151515' }, plusText: { color: '#FFFFFF', fontSize: 26, lineHeight: 28 }, clientName: { color: ui.colors.primaryText, fontSize: 17, fontWeight: '700' } });
