import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Avatar, Chip } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { friendlyText } from '../../src/lib/friendly-error';
import { getClient, listClients, type ClientSummary } from '../../src/lib/clients';
import { startConversation } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';

const PLATFORMS = [
  { key: 'line', label: 'LINE' }, { key: 'instagram', label: 'Instagram' }, { key: 'facebook', label: 'Facebook' }, { key: 'other', label: 'Other' }
] as const;

export default function NewConversationScreen() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const field = { backgroundColor: night ? palette.fill : 'rgba(255,255,255,0.80)', borderColor: night ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.06)', color: palette.text };
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]['key']>('line');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  useEffect(() => { void getActiveWorkspace().then((ws) => setWorkspaceId(ws.id)).catch(() => undefined); }, []);
  useEffect(() => {
    if (!workspaceId || !clientId || client) return;
    void getClient(workspaceId, clientId).then((d) => { setClient(d.client); if (d.client.line_id) setPlatform('line'); else if (d.client.instagram_handle) setPlatform('instagram'); }).catch(() => undefined);
  }, [workspaceId, clientId]);
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
      const f = friendlyText(error, { action: 'save' }); void dialog.notify(f.title, f.message);
    } finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>{t('mnew.s0')}</ScreenTitle>
    <SupportText>{t('mnew.s1')}</SupportText>

    <Card>
      <SectionTitle>{t('mnew.s2')}</SectionTitle>
      {client ? (
        <View style={styles.selected}>
          <Avatar name={client.display_name} />
          <View style={{ flex: 1 }}><Text style={styles.name}>{client.display_name}</Text><SupportText>{client.language === 'ja' ? '日本語' : 'English'}</SupportText></View>
          <ActionButton kind="quiet" label={t('mnew.s5')} onPress={() => setClient(null)} />
        </View>
      ) : (
        <>
          <TextInput accessibilityLabel={t('mnew.s6')} value={search} onChangeText={setSearch} placeholder={t('mnew.s7')} placeholderTextColor={palette.muted} style={[styles.input, field]} autoCorrect={false} />
          {clients.slice(0, 8).map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('mnew.choose', { name: item.display_name })} onPress={() => setClient(item)} style={styles.clientRow}>
              <Avatar name={item.display_name} /><Text style={styles.name}>{item.display_name}</Text>
            </Pressable>
          ))}
          {clients.length === 0 ? <SupportText>{t('mnew.s3')}</SupportText> : null}
          <ActionButton label={t('mnew.s8')} onPress={() => router.push('/clients/new' as any)} />
        </>
      )}
    </Card>

    <Card>
      <SectionTitle>{t('mnew.where')}</SectionTitle>
      <View style={styles.chips}>{PLATFORMS.map((item) => <Chip key={item.key} label={item.key === 'other' ? t('mnew.other', "Other") : item.label} selected={platform === item.key} onPress={() => setPlatform(item.key)} />)}</View>
    </Card>

    <Card>
      <SectionTitle>{t('mnew.s4')}</SectionTitle>
      <TextInput accessibilityLabel={t('mnew.s9')} value={body} onChangeText={setBody} placeholder={t('mnew.s10')} placeholderTextColor={palette.muted} multiline style={[styles.input, styles.multiline, field]} />
    </Card>

    <ActionButton kind="primary" label={busy ? t('mnew.saving') : t('mnew.add')} disabled={busy || !client || !body.trim()} onPress={() => void save()} />
  </Screen>;
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.colors.border },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: ui.colors.primaryText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, padding: 14, fontSize: 16, fontFamily: tokens.font.ui },
  multiline: { minHeight: 120, textAlignVertical: 'top' }
});
