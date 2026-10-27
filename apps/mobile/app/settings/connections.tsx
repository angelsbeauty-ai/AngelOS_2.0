import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, ScreenTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { friendlyText } from '../../src/lib/friendly-error';
import { connectLine, listConnections, type ConnectionStatus } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

const STATE_LABEL: Record<ConnectionStatus['state'], string> = {
  connected: 'Connected', ready_to_connect: 'Ready to connect', not_connected: 'Not connected yet', needs_meta_approval: 'Needs Meta approval'
};

export default function ConnectionsScreen() {
  const { t } = useTranslation();
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
    try { await connectLine(workspaceId); await load(); void dialog.notify(t('conn.lineOk', "LINE connected"), t('conn.lineOkBody', "New LINE messages will appear in Messages. Replies are only sent after you tap Approve.")); }
    catch (error) { const f = friendlyText(error, { action: 'save' }, t('conn.lineFail', "LINE is not connected")); void dialog.notify(f.title, f.message); }
    finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>{t('conn.s0')}</ScreenTitle>
    <SupportText>{t('conn.s1')}</SupportText>
    {state === 'error' ? <ErrorState title={t('conn.s7')} message={t('conn.s8')} onRetry={() => { setState('loading'); void load(); }} /> : null}
    {state === 'loading' ? <Card><SupportText>{t('conn.s2')}</SupportText></Card> : null}

    {items.map((item) => <Card key={item.provider}>
      <View style={styles.head}>
        <Text style={styles.title}>{item.label}</Text>
        <Text style={[styles.state, item.connected ? styles.ok : styles.off]}>{t(`conn.st_${item.state}`, STATE_LABEL[item.state])}</Text>
      </View>
      {item.accountName ? <SupportText>{t('conn.account', "Account: ")}{item.accountName}</SupportText> : null}
      <SupportText>{item.detail}</SupportText>
      {item.needs.length && !item.connected ? <View style={{ gap: 2 }}><Text style={styles.needsLabel}>{t('conn.s3')}</Text>{item.needs.filter((need) => !/project key|admin key/i.test(need)).map((need) => <SupportText key={need}>• {need}</SupportText>)}</View> : null}
      {item.provider === 'line' && item.canConnect ? <ActionButton kind="primary" label={busy ? t('conn.connecting', "Connecting\u2026") : t('conn.connectLine', "Connect LINE")} disabled={busy} onPress={() => void connect()} /> : null}
    </Card>)}

    {state === 'ready' ? <>
      <Card>
        <View style={styles.head}><Text style={styles.title}>{t('conn.metaTitle', "Instagram & Facebook posting")}</Text><Text style={[styles.state, styles.off]}>{t('conn.s4')}</Text></View>
        <SupportText>{t('conn.metaBody', "Posting needs an Instagram professional account linked to a Facebook Page. Until then, use \"Copy caption & open Instagram\".")}</SupportText>
      </Card>
      <Card>
        <View style={styles.head}><Text style={styles.title}>TikTok</Text><Text style={[styles.state, styles.off]}>{t('conn.s5')}</Text></View>
        <SupportText>{t('conn.s6')}</SupportText>
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
