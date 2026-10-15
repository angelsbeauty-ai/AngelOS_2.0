import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { Button, ScreenTitle, Skeleton, SupportText } from '../../src/components/ui';
import { dialog } from '../../src/lib/dialog';
import { connectLineChannel, getSocialAccounts, PLATFORM_NAME, startMetaConnect, type SocialAccount } from '../../src/lib/social';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

/** Social › Accounts: LINE guided one-time setup; IG/FB Connect when the Meta login is live on the server. */
export default function SocialAccounts() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<string | null>(null);
  const [items, setItems] = useState<SocialAccount[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [setup, setSetup] = useState(false);
  const [form, setForm] = useState({ channelId: '', channelSecret: '', accessToken: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const w = await getActiveWorkspace(); setWs(w.id); setItems(await getSocialAccounts(w.id)); setState('ready'); }
    catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function saveLine() {
    if (!ws) return; setBusy(true);
    try { const a = await connectLineChannel(ws, form); setSetup(false); setForm({ channelId: '', channelSecret: '', accessToken: '' }); await load(); void dialog.notify(t('sml.lineConnected'), a.name ?? ''); }
    catch (e) { void dialog.notify(t('sml.lineFailed'), e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  async function connectMeta(a: SocialAccount) {
    if (!a.connectPath) return;
    try { const { authUrl } = await startMetaConnect(a.connectPath, a.platform as 'instagram' | 'facebook'); await Linking.openURL(authUrl); }
    catch (e) { void dialog.notify(t('sml.metaFailed'), e instanceof Error ? e.message : ''); }
  }

  const canSave = /^\d{6,20}$/.test(form.channelId.trim()) && form.channelSecret.trim().length >= 16 && form.accessToken.trim().length >= 40 && !busy;
  return <Screen onRefresh={load}>
    <ScreenTitle>{t('sml.accountsTitle')}</ScreenTitle>
    <SupportText>{t('sml.accountsSub')}</SupportText>
    {state === 'loading' ? <Skeleton rows={3} height={76} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <View style={styles.card}><Text style={styles.body}>{t('sml.loadError')}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}

    {state === 'ready' ? items.map((a) => <View key={a.platform} style={styles.card}>
      <View style={styles.row}>
        {a.pictureUrl ? <Image source={{ uri: a.pictureUrl }} style={styles.avatar} accessibilityIgnoresInvertColors /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarText}>{PLATFORM_NAME[a.platform].slice(0, 1)}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{PLATFORM_NAME[a.platform]}</Text>
          <Text numberOfLines={1} style={styles.body}>{a.state === 'connected' ? [a.name, a.handle].filter(Boolean).join(' · ') || t('sml.connected') : a.state === 'needs_reconnect' ? t('sml.reconnect') : t('sml.notConnected')}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: a.state === 'connected' ? tokens.color.success : a.state === 'needs_reconnect' ? tokens.color.warning : '#B9B1AA' }]} />
      </View>
      {a.state === 'connected' ? <Text style={styles.ok}>{t('sml.connected')}</Text> : null}
      {a.platform === 'line' && a.state !== 'connected' && !setup ? <Button label={t('sml.lineSetup')} onPress={() => setSetup(true)} /> : null}
      {a.platform === 'line' && setup ? <View style={{ gap: 10 }}>
        <Text style={styles.step}>{t('sml.lineStep1')}</Text>
        <Text style={styles.step}>{t('sml.lineStep2')}</Text>
        <Text style={styles.step}>{t('sml.lineStep3')}</Text>
        <Text style={styles.step}>{t('sml.lineStep4')}</Text>
        <TextInput accessibilityLabel={t('sml.channelId')} placeholder={t('sml.channelId')} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} value={form.channelId} onChangeText={(v) => setForm({ ...form, channelId: v })} style={styles.input} />
        <TextInput accessibilityLabel={t('sml.channelSecret')} placeholder={t('sml.channelSecret')} secureTextEntry autoCapitalize="none" autoCorrect={false} value={form.channelSecret} onChangeText={(v) => setForm({ ...form, channelSecret: v })} style={styles.input} />
        <TextInput accessibilityLabel={t('sml.accessToken')} placeholder={t('sml.accessToken')} secureTextEntry autoCapitalize="none" autoCorrect={false} value={form.accessToken} onChangeText={(v) => setForm({ ...form, accessToken: v })} style={styles.input} />
        <SupportText>{t('sml.lineSafe')}</SupportText>
        <Button label={busy ? t('sml.checking') : t('sml.lineConnect')} disabled={!canSave} onPress={() => void saveLine()} />
        <Button variant="secondary" label={t('sml.notNow')} onPress={() => setSetup(false)} />
      </View> : null}
      {a.platform !== 'line' && a.state !== 'connected' ? (a.connectAvailable && a.connectPath
        ? <Button label={a.state === 'needs_reconnect' ? t('sml.reconnect') : t('sml.connectX', { name: PLATFORM_NAME[a.platform] })} onPress={() => void connectMeta(a)} />
        : <Text style={styles.soon}>{t('sml.comingSoon')}</Text>) : null}
    </View>) : null}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: 'rgba(250,248,245,0.86)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42,39,37,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,85,71,0.12)' },
  avatarText: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#8C5547' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 17, color: '#2A2725' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#625B56' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ok: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: tokens.color.success },
  soon: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#625B56' },
  step: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#2A2725' },
  input: { minHeight: 46, borderWidth: 1, borderColor: 'rgba(42,39,37,0.14)', borderRadius: 14, paddingHorizontal: 14, fontFamily: tokens.font.ui, fontSize: 16, color: '#2A2725', backgroundColor: '#FFF' }
});
