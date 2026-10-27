import { useCallback, useState } from 'react';
import { AccountsStrip } from '../../src/components/AccountsStrip';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { User } from 'phosphor-react-native/src/icons/User';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { Translate } from 'phosphor-react-native/src/icons/Translate';
import { Link } from 'phosphor-react-native/src/icons/Link';
import { Robot } from 'phosphor-react-native/src/icons/Robot';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { Question } from 'phosphor-react-native/src/icons/Question';
import { ChatText } from 'phosphor-react-native/src/icons/ChatText';
import { Crown } from 'phosphor-react-native/src/icons/Crown';
import { Heartbeat } from 'phosphor-react-native/src/icons/Heartbeat';
import { Key } from 'phosphor-react-native/src/icons/Key';
import { CreditCard } from 'phosphor-react-native/src/icons/CreditCard';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { AskInline, Screen } from '../../src/components/Screen';
import { screenHeader, Skeleton, SupportText, Button } from '../../src/components/ui';
import { Chip, ROSE, SettingsGroup, SettingsRow } from '../../src/components/SettingsList';
import { DeleteAccountSheet } from '../../src/components/DeleteAccountSheet';
import { clearMe, getMe, updateMe, type Me } from '../../src/lib/me';
import { getActiveWorkspace, type WorkspaceSummary } from '../../src/lib/workspace';
import { AiMeter } from '../../src/components/AiMeter';
import { useAppearance, type AppearanceMode } from '../../src/design/appearance';
import { listConnections } from '../../src/lib/messaging';
import { getSubscription } from '../../src/lib/subscription';
import { getSystemHealth, type SystemHealthOverview } from '../../src/lib/system-health';
import { listBetaFeedback } from '../../src/lib/beta';
import { confirm } from '../../src/lib/dialog';
import { supabase } from '../../src/lib/supabase';
import { D, N, tokens, webGlass } from '../../src/design/theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [me, setMe] = useState<Me | null>(null);
  const [ws, setWs] = useState<WorkspaceSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [connected, setConnected] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealthOverview | null | 'error'>(null);
  const [newFeedback, setNewFeedback] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  const ink = { size: 18, color: palette.icon, weight: 'duotone' as const };
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await getMe(true); setMe(m); setState('ready');
      const owner = m.memberships.some((x) => x.role === 'owner');
      const w = await getActiveWorkspace().catch(() => null); setWs(w);
      if (w && owner) {
        void listConnections(w.id).then((c) => setConnected(c.filter((x) => x.connected).length)).catch(() => undefined);
        void getSubscription(w.id).then((s) => setPlan(s.plan?.name ?? s.plan?.code ?? null)).catch(() => undefined);
      }
      if (m.founder) {
        if (w) void getSystemHealth(w.id).then(setHealth).catch(() => setHealth('error'));
        void listBetaFeedback().then((rows) => setNewFeedback(rows.filter((r: any) => r.status === 'new').length)).catch(() => undefined);
      }
    } catch { setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function logout() {
    if (!(await confirm({ title: t('settings.signOutTitle'), message: t('settings.signOutMsg'), confirmText: t('pf.logout') }))) return;
    clearMe(); await supabase.auth.signOut(); router.replace('/login');
  }
  async function setLang(lang: 'en' | 'ja') { setLangOpen(false); await updateMe({ language: lang }).then(setMe).catch(() => void i18n.changeLanguage(lang)); }

  const name = me?.displayName?.trim() || '';
  const initials = (name || me?.email || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
  const owner = me?.memberships.some((x) => x.role === 'owner');
  const student = !owner && me?.memberships.some((x) => x.role === 'student');
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = (Constants.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '').toString();
  const checkedMin = health && health !== 'error' ? Math.max(0, Math.round((Date.now() - Math.max(...health.components.map((c) => Date.parse(c.last_checked_at) || 0), 0)) / 60000)) : null;

  return <Screen hideAsk onRefresh={load}>
    <View style={[screenHeader.row, { minHeight: 40 }]}><AskInline screen="profile" /></View>
    <View style={{ gap: 2 }}>
      <Text style={[styles.overline, { color: palette.muted }]}>{t('pf.overline', 'Profile & settings').toUpperCase()}</Text>
      <Text accessibilityRole="header" numberOfLines={1} style={[screenHeader.title, { color: palette.text }]}>{t('pf.title')}</Text>
    </View>

    {me && ws ? <AiMeter workspaceId={ws.id} founder={Boolean(me.founder)} /> : null}

    {state === 'loading' ? <Skeleton rows={1} height={96} /> : null}
    {state === 'error' ? <View style={styles.card}><SupportText>{t('pf.loadFail')}</SupportText><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}
    {me ? <View style={[styles.card, { backgroundColor: palette.glass, borderColor: palette.border, ...palette.gloss }]}>
      <View style={[styles.avatar, { backgroundColor: night ? N.card : D.fill2 }]}><Text style={[styles.avatarText, { color: palette.text }]}>{initials}</Text></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={[styles.name, { color: palette.text }]} {...(name ? {} : { accessibilityRole: 'button' as const, onPress: () => router.push('/profile/edit' as any) })}>{name || t('pf.addName', 'Add your name')}</Text>
        <Text numberOfLines={1} style={[styles.studio, { color: palette.muted }]}>{ws?.name ?? t('pf.noStudio')}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>{plan ? <Chip label={t('pf.plan', { name: plan })} /> : null}{me.founder ? <Chip tone="rose" label={t('pf.founder').toUpperCase()} /> : null}</View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit' as any)} hitSlop={10}><Text style={[styles.edit, mode === 'night' && { color: palette.text }]}>{t('pf.edit')}</Text></Pressable>
    </View> : null}

    {ws && owner ? <AccountsStrip workspaceId={ws.id} /> : null}

    <SettingsGroup title={t('pf.account')}>
      <SettingsRow icon={<User {...ink} />} title={t('pf.account')} value={me?.email ?? ''} onPress={() => router.push('/profile/edit' as any)} />
      <SettingsRow icon={<Lock {...ink} />} title={t('pf.password')} onPress={() => router.push('/settings/account')} />
      <SettingsRow last icon={<Translate {...ink} />} title={t('pf.language')} value={i18n.language === 'ja' ? '日本語' : 'English'} onPress={() => setLangOpen(true)} />
    </SettingsGroup>

    {/* AngelOS V1: Clients, Money, Tasks, New business, Services, Business hours, Days off and Automations are hidden (code kept). */}
    {owner ? <SettingsGroup title={t('pf.app')}>
      <SettingsRow icon={<Link {...ink} />} title={t('pf.connected')} value={connected} onPress={() => router.push('/content/accounts' as any)} />
      <SettingsRow icon={<Robot {...ink} />} title={t('pf.aiAssistant')} onPress={() => router.push('/assistant' as any)} />
      <SettingsRow last icon={<Bell {...ink} />} title={t('pf.notifications')} onPress={() => router.push('/notifications' as any)} />
    </SettingsGroup> : null}

    <SettingsGroup title={t('pf.support')}>
      <SettingsRow icon={<ShieldCheck {...ink} />} title={t('pf.privacy')} onPress={() => router.push('/privacy')} />
      <SettingsRow icon={<ShieldCheck {...ink} />} title={t('pf.terms')} onPress={() => router.push('/terms')} />
      <SettingsRow last icon={<Question {...ink} />} title={t('pf.help')} onPress={() => router.push('/help')} />
    </SettingsGroup>

    {me?.founder ? <SettingsGroup highlight title={t('pf.founder')} badge={t('pf.onlyYou')} icon={<Crown size={14} color={ROSE} weight="duotone" />}>
      <SettingsRow icon={<Heartbeat {...ink} />} title={t('pf.health')} sub={health === 'error' ? t('pf.cantCheck') : checkedMin == null ? undefined : checkedLabel(t, checkedMin)}
        trailing={health === 'error' ? <Pressable onPress={() => { setHealth(null); if (ws) void getSystemHealth(ws.id).then(setHealth).catch(() => setHealth('error')); }}><Text style={[styles.edit, mode === 'night' && { color: palette.text }]}>{t('pf.tryAgain')}</Text></Pressable> : health ? <Chip tone={health.overallStatus === 'healthy' ? 'success' : 'danger'} label={t(`pf.status.${health.overallStatus}`)} /> : null}
        onPress={() => router.push('/system-health')} />
      <SettingsRow icon={<Key {...ink} />} title={t('pf.admin')} onPress={() => router.push('/founder-admin')} />
      <SettingsRow icon={<ChatText {...ink} />} title={t('pf.beta')} trailing={newFeedback ? <Chip label={t('pf.newN', { count: newFeedback })} /> : null} onPress={() => router.push('/founder-admin')} />
      <SettingsRow last icon={<CreditCard {...ink} />} title={t('pf.billing')} sub={t('pf.viewOnly')} onPress={() => router.push('/subscription')} />
    </SettingsGroup> : null}

    <View style={{ gap: 10 }}>
      <Button variant="secondary" label={t('pf.logout')} onPress={() => void logout()} />
      {me && !me.founder ? <Button variant="danger" label={t('pf.delete')} onPress={() => setDeleteOpen(true)} /> : null}
      <Text style={[styles.version, { color: palette.muted }]}>{build ? t('pf.version', { v: version, b: build }) : t('pf.versionOnly', { v: version, defaultValue: 'AngelOS {{v}}' })}</Text>
    </View>

    <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)}><View style={[styles.sheet, { backgroundColor: night ? N.card : D.surface }]}>
        <Text style={[styles.sheetTitle, { color: palette.text }]}>{t('pf.langTitle')}</Text>
        {(['ja', 'en'] as const).map((l) => <Pressable key={l} accessibilityRole="button" onPress={() => void setLang(l)} style={[styles.option, { borderColor: night ? N.secondaryBorder : 'rgba(42,39,37,0.12)' }, i18n.language === l && { backgroundColor: palette.text, borderColor: palette.text }]}><Text style={[styles.optionText, { color: i18n.language === l ? palette.bg : palette.text }]}>{l === 'ja' ? '日本語' : 'English'}</Text></Pressable>)}
      </View></Pressable>
    </Modal>
    <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} workspaceId={ws?.id ?? null} email={me?.email ?? null} />
  </Screen>;
}

function checkedLabel(t: (k: string, o?: Record<string, unknown>) => string, min: number) {
  if (min < 1) return t('pf.checkedNow');
  if (min < 60) return t('pf.checked', { min });
  if (min < 48 * 60) return t('pf.checkedH', { h: Math.round(min / 60) });
  return t('pf.checkedD', { d: Math.round(min / 1440) });
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED', ...(webGlass as object) },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDEDED' },
  avatarText: { color: '#151515', fontFamily: tokens.font.display, fontSize: 26 },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 18, color: '#151515' },
  studio: { ...tokens.type.footnote, fontFamily: tokens.font.ui, color: '#6C6C70' },
  edit: { ...tokens.type.subhead, fontFamily: tokens.font.uiSemibold, lineHeight: 44, color: ROSE },
  overline: { ...tokens.type.overline, fontFamily: tokens.font.uiSemibold, letterSpacing: 0.8 },
  version: { textAlign: 'center', ...tokens.type.overline, fontFamily: tokens.font.ui, color: '#6C6C70', marginTop: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { gap: 10, padding: 20, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF' },
  sheetTitle: { ...tokens.type.headline, fontFamily: tokens.font.uiSemibold, color: '#151515', textAlign: 'center', marginBottom: 4 },
  option: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.12)' },
  optionText: { ...tokens.type.body, fontFamily: tokens.font.uiSemibold, color: '#151515' }
});
