import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { RowMenu } from '../../src/components/RowMenu';
import { ErrorState } from '../../src/components/ErrorState';
import { Tabs } from '../../src/components/Field';
import { Avatar, Badge, Button, EmptyState, Header, Skeleton, SupportText, ui } from '../../src/components/ui';
import { listClients, setClientArchived, type ClientFilter, type ClientSummary } from '../../src/lib/clients';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { toFriendly, type FriendlyResult } from '../../src/lib/friendly-error';
import { confirm } from '../../src/lib/dialog';

const FILTER_IDS: ClientFilter[] = ['all', 'new', 'active', 'touch_up', 'archived'];

export default function ClientsScreen() {
  const { t } = useTranslation();
  const FILTERS = FILTER_IDS.map((id) => ({ id, label: t(`clients.filter.${id}`) }));
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyResult | null>(null);

  useEffect(() => { const t = setTimeout(() => void load(), search ? 300 : 0); return () => clearTimeout(t); }, [search, filter]);

  async function load() {
    setBusy(true); setLoadError(null);
    try {
      const id = workspaceId ?? (await getActiveWorkspace()).id;
      setWorkspaceId(id);
      setClients(await listClients(id, search, filter));
    } catch (error) { setLoadError(toFriendly(error, { action: 'load', thing: 'clients' })); }
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
    <Header title={t('clients.title')} subtitle={t('clients.sub')} action={<Button small label={t('clients.newClient')} onPress={() => router.push('/clients/new')} />} />
    <TextInput value={search} onChangeText={setSearch} placeholder={t('clients.search')} accessibilityLabel={t('clients.search')} placeholderTextColor={ui.colors.secondaryText} style={styles.search} />
    <Tabs value={filter} options={FILTERS} onChange={setFilter} />
    {busy && !clients.length ? <Skeleton rows={4} /> : null}
    {!busy && loadError ? <ErrorState title={loadError.title} message={loadError.message} onRetry={() => void load()} /> : null}
    {!busy && !loadError && clients.length === 0 ? <EmptyState title={search || filter !== 'all' ? t('clients.noMatch') : t('clients.none')} message={search || filter !== 'all' ? undefined : t('clients.noneHint')} action={search || filter !== 'all' ? undefined : { label: t('clients.newClient'), onPress: () => router.push('/clients/new') }} /> : null}
    {clients.map((client) => <RowMenu key={client.id} accessibilityHint={t('clients.holdHint')} onPress={() => router.push(`/clients/${client.id}` as any)}
      actions={[{ id: 'book', title: t('clients.book') }, { id: 'edit', title: t('clients.edit') }, { id: 'archive', title: client.archived_at ? t('clients.unarchive') : t('clients.archive') }]}
      onAction={(action) => { if (action === 'book') router.push({ pathname: '/bookings/new', params: { clientId: client.id } }); if (action === 'edit') router.push(`/clients/${client.id}/edit` as any); if (action === 'archive') void archive(client); }}>
      <View style={styles.clientRow}>
        <Avatar name={client.display_name} />
        <View style={styles.clientCopy}><Text style={styles.clientName}>{client.display_name}</Text><SupportText>{client.status.replaceAll('_', ' ')} · {client.language === 'ja' ? t('clients.japanese') : t('clients.english')}</SupportText>{client.phone || client.email ? <SupportText>{client.phone ?? client.email}</SupportText> : null}</View>
        {client.health_flag ? <Badge status="request" label={t('clients.checkHealth')} /> : null}
        {client.archived_at ? <Badge status="cancelled" label={t('clients.archived')} /> : null}
      </View>
    </RowMenu>)}
  </Screen>;
}

const styles = StyleSheet.create({ search: { minHeight: 48, borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, backgroundColor: '#FFFFFF', color: ui.colors.primaryText, paddingHorizontal: ui.spacing.sm, fontSize: 16 }, clientRow: { flexDirection: 'row', gap: ui.spacing.sm, alignItems: 'center', minHeight: 64, padding: ui.spacing.sm, borderRadius: ui.radius.card, backgroundColor: '#FFFFFF' }, clientCopy: { flex: 1, gap: 2 }, clientName: { color: ui.colors.primaryText, fontSize: 17, fontWeight: '700' } });
