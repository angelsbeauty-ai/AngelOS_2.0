import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RowMenu } from '../../src/components/RowMenu';
import { ErrorState } from '../../src/components/ErrorState';
import { Tabs } from '../../src/components/Field';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SupportText, ui } from '../../src/components/ui';
import { listClients, setClientArchived, type ClientFilter, type ClientSummary } from '../../src/lib/clients';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { toFriendly, type FriendlyResult } from '../../src/lib/friendly-error';
import { confirm } from '../../src/lib/dialog';

const FILTERS: Array<{ id: ClientFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'new', label: 'New' }, { id: 'active', label: 'Active' }, { id: 'touch_up', label: 'Touch-up due' }, { id: 'archived', label: 'Archived' }
];

export default function ClientsScreen() {
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
    if (!archived && !(await confirm({ title: `Archive ${client.display_name}?`, message: 'They move to the Archived list. Nothing is deleted.', confirmText: 'Archive' }))) return;
    await setClientArchived(workspaceId, client.id, !archived).catch(() => undefined);
    await load();
  }

  return <Screen>
    <View style={styles.header}>
      <View style={styles.headerCopy}><ScreenTitle>Clients</ScreenTitle><SupportText>Search by name, phone or email.</SupportText></View>
      <Link href="/clients/new" asChild><Pressable style={styles.addButton} accessibilityRole="button"><PrimaryActionLabel>New client</PrimaryActionLabel></Pressable></Link>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="Search clients" accessibilityLabel="Search clients" placeholderTextColor={ui.colors.secondaryText} style={styles.search} />
    <Tabs value={filter} options={FILTERS} onChange={setFilter} />
    {busy && !clients.length ? <Card><BodyText>Loading clients…</BodyText></Card> : null}
    {!busy && loadError ? <ErrorState title={loadError.title} message={loadError.message} onRetry={() => void load()} /> : null}
    {!busy && !loadError && clients.length === 0 ? <Card><BodyText>{search || filter !== 'all' ? 'No clients match.' : 'No clients yet.'}</BodyText><SupportText>Add a client, or they appear here when they message you.</SupportText></Card> : null}
    {clients.map((client) => <RowMenu key={client.id} accessibilityHint="Hold for client options" onPress={() => router.push(`/clients/${client.id}` as any)}
      actions={[{ id: 'book', title: 'Book' }, { id: 'edit', title: 'Edit' }, { id: 'archive', title: client.archived_at ? 'Unarchive' : 'Archive' }]}
      onAction={(action) => { if (action === 'book') router.push({ pathname: '/bookings/new', params: { clientId: client.id } }); if (action === 'edit') router.push(`/clients/${client.id}/edit` as any); if (action === 'archive') void archive(client); }}>
      <Card><View style={styles.clientRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{client.display_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.clientCopy}><Text style={styles.clientName}>{client.display_name}</Text><SupportText>{client.status.replaceAll('_', ' ')} · {client.language === 'ja' ? 'Japanese' : 'English'}</SupportText>{client.phone || client.email ? <SupportText>{client.phone ?? client.email}</SupportText> : null}</View>
        {client.health_flag ? <Pill tone="warning">Check health</Pill> : null}
        {client.archived_at ? <Pill>Archived</Pill> : null}
      </View></Card>
    </RowMenu>)}
  </Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'flex-start', gap: ui.spacing.sm }, headerCopy: { flex: 1, gap: ui.spacing.xs }, addButton: { width: 124 }, search: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.control, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: ui.spacing.sm, fontSize: 16 }, clientRow: { flexDirection: 'row', gap: ui.spacing.sm, alignItems: 'center' }, avatar: { width: 44, height: 44, borderWidth: 1, borderColor: ui.colors.softGold, backgroundColor: ui.colors.warmSurface, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: ui.colors.gold, fontWeight: '700', fontSize: 18 }, clientCopy: { flex: 1, gap: 2 }, clientName: { color: ui.colors.primaryText, fontSize: 17, fontWeight: '700' } });
