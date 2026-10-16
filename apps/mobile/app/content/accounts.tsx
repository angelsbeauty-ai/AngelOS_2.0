import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReconnectError, metaResultText, startReconnect } from '../../src/lib/meta-connect';
import { Screen } from '../../src/components/Screen';
import { NoStudio } from '../../src/components/NoStudio';
import { Button, ScreenTitle, Skeleton, SupportText } from '../../src/components/ui';
import { dialog } from '../../src/lib/dialog';
import { connectLineChannel, disconnectMeta, getMetaPendingPages, getSocialAccounts, PLATFORM_NAME, selectMetaPage, type MetaPageChoice, type SocialAccount } from '../../src/lib/social';
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
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [connErr, setConnErr] = useState<{ a: SocialAccount; message: string } | null>(null);

  const load = useCallback(async () => {
    try { const w = await getActiveWorkspace(); setWs(w.id); setItems(await getSocialAccounts(w.id)); setState('ready'); }
    catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); setLoadErr(e instanceof Error ? e.message : null); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const { meta } = useLocalSearchParams<{ meta?: string }>();
  const [choices, setChoices] = useState<MetaPageChoice[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (meta && meta !== 'choose') setNotice(metaResultText(meta)); }, [meta]);
  // Several Pages waiting from the last Facebook login: open the picker automatically (also without ?meta=choose).
  useEffect(() => {
    if (!ws || state !== 'ready' || !items.some((a) => a.platform !== 'line' && a.connectPath)) return;
    getMetaPendingPages(ws).then((p) => { if (p.length) setChoices(p); else if (meta === 'choose') setNotice(t('sml.choiceExpired')); })
      .catch((e) => { if (meta === 'choose') setNotice(`${t('sml.choiceExpired')} ${e instanceof Error ? e.message : ''}`); });
  }, [meta, ws, state, items, t]);

  async function choosePage(p: MetaPageChoice) {
    if (!ws || busy) return; setBusy(true);
    try { await selectMetaPage(ws, p.pageId); setChoices(null); if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname); await load(); void dialog.notify(t('sml.metaConnected'), p.pageName ?? ''); }
    catch (e) { void dialog.notify(t('sml.metaFailed'), e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!ws) return;
    const ok = await dialog.confirm({ title: t('sml.disconnectTitle'), message: t('sml.disconnectBody'), confirmText: t('sml.disconnect'), destructive: true });
    if (!ok) return;
    try { await disconnectMeta(ws); await load(); }
    catch (e) { void dialog.notify(t('sml.disconnectFailed'), e instanceof Error ? e.message : ''); }
  }

  async function saveLine() {
    if (!ws) return; setBusy(true);
    try { const a = await connectLineChannel(ws, form); setSetup(false); setForm({ channelId: '', channelSecret: '', accessToken: '' }); await load(); void dialog.notify(t('sml.lineConnected'), a.name ?? ''); }
    catch (e) { void dialog.notify(t('sml.lineFailed'), e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }
  async function connectMeta(a: SocialAccount) {
    if (!ws) return;
    setConnErr(null);
    try { const r = await startReconnect(ws, a.platform); if (r === 'returned') await load(); }
    catch (e) { setConnErr({ a, message: e instanceof ReconnectError && e.kind === 'login_off' ? t('messages.loginOff') : e instanceof Error ? e.message : String(e) }); }
  }

  const canSave = /^\d{6,20}$/.test(form.channelId.trim()) && form.channelSecret.trim().length >= 16 && form.accessToken.trim().length >= 40 && !busy;
  return <Screen onRefresh={load}>
    <ScreenTitle>{t('sml.accountsTitle')}</ScreenTitle>
    <SupportText>{t('sml.accountsSub')}</SupportText>
    {state === 'loading' ? <Skeleton rows={3} height={76} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <View style={styles.card}><Text style={styles.body}>{t('sml.loadError')}{loadErr ? ` (${loadErr})` : ''}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}

    {notice ? <View style={styles.card}><Text style={styles.body}>{notice}</Text><Button small variant="secondary" label={t('sml.notNow')} onPress={() => setNotice(null)} /></View> : null}
    {connErr ? <View style={styles.card}>
      <Text style={styles.title}>{t('messages.reconnectFailed')} ({PLATFORM_NAME[connErr.a.platform]})</Text>
      <Text style={styles.body}>{connErr.message}</Text>
      <Button label={t('messages.retry')} onPress={() => void connectMeta(connErr.a)} />
    </View> : null}
    {state === 'ready' && choices ? <View style={styles.card}>
      <Text style={styles.title}>{t('sml.choosePage')}</Text>
      <SupportText>{t('sml.choosePageSub')}</SupportText>
      {choices.map((p) => <Pressable key={p.pageId} accessibilityRole="button" accessibilityLabel={p.pageName ?? p.pageId} disabled={busy} onPress={() => void choosePage(p)} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.7 }]}>
        {p.pictureUrl ? <Image source={{ uri: p.pictureUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarText}>{(p.pageName ?? 'F').slice(0, 1)}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{p.pageName ?? p.pageId}</Text>
          <Text numberOfLines={1} style={styles.body}>{p.igUsername ? `Instagram @${p.igUsername}` : t('sml.noIg')}</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>)}
      <Button variant="secondary" label={t('sml.notNow')} onPress={() => setChoices(null)} />
    </View> : null}

    {state === 'ready' ? items.map((a) => <View key={a.platform} style={styles.card}>
      <View style={styles.row}>
        {a.pictureUrl ? <Image source={{ uri: a.pictureUrl }} style={styles.avatar} accessibilityIgnoresInvertColors /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarText}>{PLATFORM_NAME[a.platform].slice(0, 1)}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{PLATFORM_NAME[a.platform]}</Text>
          <Text numberOfLines={1} style={styles.body}>{a.state === 'connected' ? [a.name, a.handle].filter(Boolean).join(' · ') || t('sml.connected') : a.state === 'needs_reconnect' ? t('sml.reconnect') : t('sml.notConnected')}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: a.state === 'connected' ? tokens.color.success : a.state === 'needs_reconnect' ? tokens.color.warning : '#A8A8A8' }]} />
      </View>
      {a.state !== 'not_connected' ? <Text style={styles.body}>{t(a.platform === 'line' ? 'acs.friends' : 'acs.followers')}: {a.followers == null ? t('acs.na') : a.followers.toLocaleString()}{a.platform !== 'line' ? ` · ${t('acs.posts')}: ${a.posts == null ? t('acs.na') : a.posts.toLocaleString()}` : ''}</Text> : null}
      {a.state === 'connected' ? <Text style={styles.ok}>{t('sml.connected')}</Text> : null}
      {a.state === 'needs_reconnect' && a.reason ? <Text style={styles.warn}>{a.reason}</Text> : null}
      {a.syncError ? <Text style={styles.warn}>{a.syncError}</Text> : null}
      {a.platform !== 'line' && a.state !== 'not_connected' && a.connectPath ? <Button variant="danger" label={t('sml.disconnect')} onPress={() => void disconnect()} /> : null}
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
        : <Text style={styles.soon}>{t('messages.loginOff')}</Text>) : null}
    </View>) : null}
  </Screen>;
}

const styles = StyleSheet.create({
  warn: { fontFamily: tokens.font.uiMedium, fontSize: 14, lineHeight: 20, color: tokens.color.warning },
  card: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFEFEF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  avatarText: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#000000' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 17, color: '#262626' },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#737373' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: '#FFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB' },
  chev: { fontSize: 24, color: '#000000' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ok: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: tokens.color.success },
  soon: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#737373' },
  step: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#262626' },
  input: { minHeight: 46, borderWidth: 1, borderColor: 'rgba(42,39,37,0.14)', borderRadius: 14, paddingHorizontal: 14, fontFamily: tokens.font.ui, fontSize: 16, color: '#262626', backgroundColor: '#FFF' }
});
