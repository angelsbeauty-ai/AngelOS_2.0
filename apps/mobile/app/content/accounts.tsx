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
import { D, N, tokens } from '../../src/design/theme';
import { useAppearance } from '../../src/design/appearance';
import { BrandLogo } from '../../src/components/BrandBadge';
import { ProfilePostGrid } from '../../src/components/ProfilePostGrid';
import { listContent, type ContentPost } from '../../src/lib/content';
import { friendlyText } from '../../src/lib/friendly-error';

/** Social › Accounts: LINE guided one-time setup; IG/FB Connect when the Meta login is live on the server. */
export default function SocialAccounts() {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const k = { card: { backgroundColor: night ? N.card : D.surface, borderColor: palette.border }, choice: { backgroundColor: night ? N.field : D.surface, borderColor: palette.border }, text: { color: palette.text }, muted: { color: palette.muted }, input: { color: palette.text, backgroundColor: night ? N.field : D.surface, borderColor: night ? N.fieldBorder : 'rgba(42,39,37,0.14)' } };
  const [ws, setWs] = useState<string | null>(null);
  const [items, setItems] = useState<SocialAccount[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nostudio'>('loading');
  const [setup, setSetup] = useState(false);
  const [form, setForm] = useState({ channelId: '', channelSecret: '', accessToken: '' });
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [connErr, setConnErr] = useState<{ a: SocialAccount; message: string } | null>(null);

  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [postsErr, setPostsErr] = useState(false);
  const loadPosts = useCallback((id: string) => { setPostsErr(false); listContent(id).then(setPosts).catch(() => setPostsErr(true)); }, []);
  const load = useCallback(async () => {
    try { const w = await getActiveWorkspace(); setWs(w.id); loadPosts(w.id); setItems(await getSocialAccounts(w.id)); setState('ready'); }
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
      .catch((e) => { if (meta === 'choose') setNotice(`${t('sml.choiceExpired')} ${friendlyText(e, { action: 'save' }).message}`); });
  }, [meta, ws, state, items, t]);

  async function choosePage(p: MetaPageChoice) {
    if (!ws || busy) return; setBusy(true);
    try { await selectMetaPage(ws, p.pageId); setChoices(null); if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname); await load(); void dialog.notify(t('sml.metaConnected'), p.pageName ?? ''); }
    catch (e) { void dialog.notify(t('sml.metaFailed'), friendlyText(e, { action: 'save' }).message); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!ws) return;
    const ok = await dialog.confirm({ title: t('sml.disconnectTitle'), message: t('sml.disconnectBody'), confirmText: t('sml.disconnect'), destructive: true });
    if (!ok) return;
    try { await disconnectMeta(ws); await load(); }
    catch (e) { void dialog.notify(t('sml.disconnectFailed'), friendlyText(e, { action: 'save' }).message); }
  }

  async function saveLine() {
    if (!ws) return; setBusy(true);
    try { const a = await connectLineChannel(ws, form); setSetup(false); setForm({ channelId: '', channelSecret: '', accessToken: '' }); await load(); void dialog.notify(t('sml.lineConnected'), a.name ?? ''); }
    catch (e) { void dialog.notify(t('sml.lineFailed'), friendlyText(e, { action: 'save' }).message); }
    finally { setBusy(false); }
  }
  async function connectMeta(a: SocialAccount) {
    if (!ws) return;
    setConnErr(null);
    try { const r = await startReconnect(ws, a.platform); if (r === 'returned') await load(); }
    catch (e) { setConnErr({ a, message: e instanceof ReconnectError && e.kind === 'login_off' ? t('messages.loginOff') : friendlyText(e, { action: 'save' }).message }); }
  }

  const canSave = /^\d{6,20}$/.test(form.channelId.trim()) && form.channelSecret.trim().length >= 16 && form.accessToken.trim().length >= 40 && !busy;
  return <Screen onRefresh={load}>
    <ScreenTitle>{t('sml.accountsTitle')}</ScreenTitle>
    <SupportText>{t('sml.accountsSub')}</SupportText>
    {state === 'loading' ? <Skeleton rows={3} height={76} /> : null}
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <View style={[styles.card, k.card]}><Text style={[styles.body, k.muted]}>{t('sml.loadError')}{loadErr ? ` (${loadErr})` : ''}</Text><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}

    {notice ? <View style={[styles.card, k.card]}><Text style={[styles.body, k.muted]}>{notice}</Text><Button small variant="secondary" label={t('sml.notNow')} onPress={() => setNotice(null)} /></View> : null}
    {connErr ? <View style={[styles.card, k.card]}>
      <Text style={[styles.title, k.text]}>{t('messages.reconnectFailed')} ({PLATFORM_NAME[connErr.a.platform]})</Text>
      <Text style={[styles.body, k.muted]}>{connErr.message}</Text>
      <Button label={t('messages.retry')} onPress={() => void connectMeta(connErr.a)} />
    </View> : null}
    {state === 'ready' && choices ? <View style={[styles.card, k.card]}>
      <Text style={[styles.title, k.text]}>{t('sml.choosePage')}</Text>
      <SupportText>{t('sml.choosePageSub')}</SupportText>
      {choices.map((p) => <Pressable key={p.pageId} accessibilityRole="button" accessibilityLabel={p.pageName ?? p.pageId} disabled={busy} onPress={() => void choosePage(p)} style={({ pressed }) => [styles.choice, k.choice, pressed && { opacity: 0.7 }]}>
        {p.pictureUrl ? <Image source={{ uri: p.pictureUrl }} style={styles.avatar} /> : <View style={styles.avatar}><BrandLogo platform="facebook" size={48} /></View>}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, k.text]}>{p.pageName ?? p.pageId}</Text>
          <Text numberOfLines={1} style={[styles.body, k.muted]}>{p.igUsername ? `Instagram @${p.igUsername}` : t('sml.noIg')}</Text>
        </View>
        <Text style={[styles.chev, k.text]}>›</Text>
      </Pressable>)}
      <Button variant="secondary" label={t('sml.notNow')} onPress={() => setChoices(null)} />
    </View> : null}

    {state === 'ready' ? items.map((a) => <View key={a.platform} style={[styles.card, k.card]}>
      <View style={styles.row}>
        {a.pictureUrl ? <Image source={{ uri: a.pictureUrl }} style={styles.avatar} accessibilityIgnoresInvertColors /> : <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><BrandLogo platform={a.platform} size={48} /></View>}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, k.text]}>{PLATFORM_NAME[a.platform]}</Text>
          <Text numberOfLines={1} style={[styles.body, k.muted]}>{a.state === 'connected' ? [a.name, a.handle].filter(Boolean).join(' · ') || t('sml.connected') : a.state === 'needs_reconnect' ? t('sml.reconnect') : t('sml.notConnected')}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: a.state === 'connected' ? tokens.color.success : a.state === 'needs_reconnect' ? tokens.color.warning : palette.muted }]} />
      </View>
      {a.state !== 'not_connected' && (a.followers != null || a.posts != null) ? <Text style={[styles.body, k.muted]}>{a.followers != null ? `${t(a.platform === 'line' ? 'acs.friends' : 'acs.followers')}: ${a.followers.toLocaleString()}` : ''}{a.platform !== 'line' && a.posts != null ? `${a.followers != null ? ' · ' : ''}${t('acs.posts')}: ${a.posts.toLocaleString()}` : ''}</Text> : null}
      {a.state === 'connected' ? <Text style={styles.ok}>{t('sml.connected')}</Text> : null}
      {a.state === 'needs_reconnect' && a.reason ? <Text style={styles.warn}>{a.reason}</Text> : null}
      {a.syncError ? <Text style={styles.warn}>{a.syncError}</Text> : null}
      {a.platform !== 'line' && a.state !== 'not_connected' && a.connectPath ? <Button variant="danger" label={t('sml.disconnect')} onPress={() => void disconnect()} /> : null}
      {a.platform === 'line' && a.state !== 'connected' && !setup ? <Button label={t('sml.lineSetup')} onPress={() => setSetup(true)} /> : null}
      {a.platform === 'line' && setup ? <View style={{ gap: 10 }}>
        <Text style={[styles.step, k.text]}>{t('sml.lineStep1')}</Text>
        <Text style={[styles.step, k.text]}>{t('sml.lineStep2')}</Text>
        <Text style={[styles.step, k.text]}>{t('sml.lineStep3')}</Text>
        <Text style={[styles.step, k.text]}>{t('sml.lineStep4')}</Text>
        <TextInput accessibilityLabel={t('sml.channelId')} placeholder={t('sml.channelId')} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} value={form.channelId} onChangeText={(v) => setForm({ ...form, channelId: v })} placeholderTextColor={palette.muted} style={[styles.input, k.input]} />
        <TextInput accessibilityLabel={t('sml.channelSecret')} placeholder={t('sml.channelSecret')} secureTextEntry autoCapitalize="none" autoCorrect={false} value={form.channelSecret} onChangeText={(v) => setForm({ ...form, channelSecret: v })} placeholderTextColor={palette.muted} style={[styles.input, k.input]} />
        <TextInput accessibilityLabel={t('sml.accessToken')} placeholder={t('sml.accessToken')} secureTextEntry autoCapitalize="none" autoCorrect={false} value={form.accessToken} onChangeText={(v) => setForm({ ...form, accessToken: v })} placeholderTextColor={palette.muted} style={[styles.input, k.input]} />
        <SupportText>{t('sml.lineSafe')}</SupportText>
        <Button label={busy ? t('sml.checking') : t('sml.lineConnect')} disabled={!canSave} onPress={() => void saveLine()} />
        <Button variant="secondary" label={t('sml.notNow')} onPress={() => setSetup(false)} />
      </View> : null}
      {a.platform !== 'line' && a.state !== 'connected' ? (a.connectAvailable && a.connectPath
        ? <Button label={a.state === 'needs_reconnect' ? t('sml.reconnect') : t('sml.connectX', { name: PLATFORM_NAME[a.platform] })} onPress={() => void connectMeta(a)} />
        : <Text style={[styles.soon, k.muted]}>{t('messages.loginOff')}</Text>) : null}
      {a.platform !== 'line' && a.state !== 'not_connected' ? <ProfilePostGrid platform={a.platform} workspaceId={ws} posts={posts} failed={postsErr} onRetry={() => ws && loadPosts(ws)} inset={64} /> : null}
    </View>) : null}
    {/* TikTok grid only when a TikTok account is actually linked (V1 has no TikTok connect). */}
    {state === 'ready' && items.some((x) => (x.platform as string) === 'tiktok' && x.state !== 'not_connected') ? <View style={[styles.card, k.card]}>
      <ProfilePostGrid platform="tiktok" workspaceId={ws} posts={posts} failed={postsErr} onRetry={() => ws && loadPosts(ws)} inset={64} />
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  warn: { ...tokens.type.subhead, fontFamily: tokens.font.uiMedium, color: tokens.color.warning },
  card: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  title: { ...tokens.type.headline, fontFamily: tokens.font.uiBold },
  body: { ...tokens.type.subhead, fontFamily: tokens.font.ui },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: '#FFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED' },
  chev: { fontSize: 24 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ok: { ...tokens.type.footnote, fontFamily: tokens.font.uiSemibold, color: tokens.color.success },
  soon: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold },
  step: { ...tokens.type.subhead, fontFamily: tokens.font.ui },
  input: { minHeight: 46, borderWidth: 1, borderColor: 'rgba(42,39,37,0.14)', borderRadius: 14, paddingHorizontal: 14, fontFamily: tokens.font.ui, fontSize: 16, color: '#151515', backgroundColor: '#FFF' }
});
