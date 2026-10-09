import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, ScreenTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import { connectLine, listConnections, type ConnectionStatus } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

const STATE_LABEL: Record<ConnectionStatus['state'], string> = {
  connected: 'Connected', ready_to_connect: 'Ready to connect', not_connected: 'Not connected yet', needs_meta_approval: 'Needs Meta approval'
};

export default function ConnectionsScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<ConnectionStatus[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws); setItems(await listConnections(ws)); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function connect() {
    if (!workspaceId) return;
    setBusy(true);
    try { await connectLine(workspaceId); await load(); void dialog.notify('LINE connected', 'New LINE messages will appear in Messages. Replies are only sent after you tap Approve.'); }
    catch (error) { const f = toFriendly(error, { action: 'save' }); void dialog.notify('LINE is not connected', error instanceof Error && error.message ? error.message : f.message); }
    finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>Connections</ScreenTitle>
    <SupportText>Which apps AngelOS can really use. Anything not connected says so.</SupportText>
    {state === 'error' ? <ErrorState title="We couldn't load connections" message="Check your connection and try again." onRetry={() => { setState('loading'); void load(); }} /> : null}
    {state === 'loading' ? <Card><SupportText>Loading…</SupportText></Card> : null}

    {items.map((item) => <Card key={item.provider}>
      <View style={styles.head}>
        <Text style={styles.title}>{item.label}</Text>
        <Text style={[styles.state, item.connected ? styles.ok : styles.off]}>{STATE_LABEL[item.state]}</Text>
      </View>
      {item.accountName ? <SupportText>Account: {item.accountName}</SupportText> : null}
      <SupportText>{item.detail}</SupportText>
      {item.needs.length && !item.connected ? <View style={{ gap: 2 }}><Text style={styles.needsLabel}>What it needs</Text>{item.needs.map((need) => <SupportText key={need}>• {need}</SupportText>)}</View> : null}
      {item.provider === 'line' && item.canConnect ? <ActionButton kind="primary" label={busy ? 'Connecting…' : 'Connect LINE'} disabled={busy} onPress={() => void connect()} /> : null}
    </Card>)}

    {state === 'ready' ? <>
      <Card>
        <View style={styles.head}><Text style={styles.title}>Instagram & Facebook posting</Text><Text style={[styles.state, styles.off]}>Not connected yet</Text></View>
        <SupportText>Posting needs an Instagram Business/Creator account linked to a Facebook Page and a Meta app. Until then use "Copy caption & open Instagram".</SupportText>
      </Card>
      <Card>
        <View style={styles.head}><Text style={styles.title}>TikTok</Text><Text style={[styles.state, styles.off]}>Manual only</Text></View>
        <SupportText>Download the video and copy the caption. Direct posting needs a TikTok app audit.</SupportText>
      </Card>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: tokens.font.uiBold, fontSize: 17, color: ui.colors.primaryText },
  state: { fontFamily: tokens.font.uiBold, fontSize: 13 },
  ok: { color: tokens.color.success },
  off: { color: tokens.color.warning },
  needsLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText, marginTop: 4 }
});
