import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Avatar, Chip } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import { listClients, type ClientSummary } from '../../src/lib/clients';
import { startConversation } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

const PLATFORMS = [
  { key: 'line', label: 'LINE' }, { key: 'instagram', label: 'Instagram' }, { key: 'facebook', label: 'Facebook' }, { key: 'other', label: 'Other' }
] as const;

export default function NewConversationScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]['key']>('line');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void getActiveWorkspace().then((ws) => setWorkspaceId(ws.id)).catch(() => undefined); }, []);
  useEffect(() => {
    if (!workspaceId) return;
    const handle = setTimeout(() => { void listClients(workspaceId, search).then(setClients).catch(() => setClients([])); }, 250);
    return () => clearTimeout(handle);
  }, [workspaceId, search]);

  async function save() {
    if (!workspaceId || !client || !body.trim()) return;
    setBusy(true);
    try {
      const result = await startConversation(workspaceId, { clientId: client.id, platform, body: body.trim() });
      router.replace(`/messages/${result.threadId}` as any);
    } catch (error) {
      const friendly = toFriendly(error, { action: 'save' });
      void dialog.notify(friendly.title, error instanceof Error && error.message ? error.message : friendly.message);
    } finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>New conversation</ScreenTitle>
    <SupportText>Pick the client, then paste the message they sent you. AngelOS keeps the conversation here and drafts your reply.</SupportText>

    <Card>
      <SectionTitle>1 · Client</SectionTitle>
      {client ? (
        <View style={styles.selected}>
          <Avatar name={client.display_name} />
          <View style={{ flex: 1 }}><Text style={styles.name}>{client.display_name}</Text><SupportText>{client.language === 'ja' ? '日本語' : 'English'}</SupportText></View>
          <ActionButton kind="quiet" label="Change" onPress={() => setClient(null)} />
        </View>
      ) : (
        <>
          <TextInput accessibilityLabel="Search clients" value={search} onChangeText={setSearch} placeholder="Search by name" placeholderTextColor={ui.colors.secondaryText} style={styles.input} autoCorrect={false} />
          {clients.slice(0, 8).map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Choose ${item.display_name}`} onPress={() => setClient(item)} style={styles.clientRow}>
              <Avatar name={item.display_name} /><Text style={styles.name}>{item.display_name}</Text>
            </Pressable>
          ))}
          {clients.length === 0 ? <SupportText>No clients found. Add the client first in Clients, then come back.</SupportText> : null}
          <ActionButton label="+ New client" onPress={() => router.push('/clients/new' as any)} />
        </>
      )}
    </Card>

    <Card>
      <SectionTitle>2 · Where did they message you?</SectionTitle>
      <View style={styles.chips}>{PLATFORMS.map((item) => <Chip key={item.key} label={item.label} selected={platform === item.key} onPress={() => setPlatform(item.key)} />)}</View>
    </Card>

    <Card>
      <SectionTitle>3 · Their message</SectionTitle>
      <TextInput accessibilityLabel="Paste the client's message" value={body} onChangeText={setBody} placeholder="Paste what the client wrote" placeholderTextColor={ui.colors.secondaryText} multiline style={[styles.input, styles.multiline]} />
    </Card>

    <ActionButton kind="primary" label={busy ? 'Saving…' : 'Add conversation'} disabled={busy || !client || !body.trim()} onPress={() => void save()} />
  </Screen>;
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.colors.border },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: ui.colors.primaryText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, fontFamily: tokens.font.ui },
  multiline: { minHeight: 120, textAlignVertical: 'top' }
});
