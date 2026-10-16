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
import { Scissors } from 'phosphor-react-native/src/icons/Scissors';
import { Robot } from 'phosphor-react-native/src/icons/Robot';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { Question } from 'phosphor-react-native/src/icons/Question';
import { ChatText } from 'phosphor-react-native/src/icons/ChatText';
import { Crown } from 'phosphor-react-native/src/icons/Crown';
import { Heartbeat } from 'phosphor-react-native/src/icons/Heartbeat';
import { Key } from 'phosphor-react-native/src/icons/Key';
import { CreditCard } from 'phosphor-react-native/src/icons/CreditCard';
import { ChartLine } from 'phosphor-react-native/src/icons/ChartLine';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { CurrencyJpy } from 'phosphor-react-native/src/icons/CurrencyJpy';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { Screen } from '../../src/components/Screen';
import { Overline, ScreenTitle, Skeleton, SupportText, Button } from '../../src/components/ui';
import { Chip, ROSE, SettingsGroup, SettingsRow } from '../../src/components/SettingsList';
import { DeleteAccountSheet } from '../../src/components/DeleteAccountSheet';
import { clearMe, getMe, updateMe, type Me } from '../../src/lib/me';
import { getActiveWorkspace, type WorkspaceSummary } from '../../src/lib/workspace';
import { AiMeter } from '../../src/components/AiMeter';
import { listServices } from '../../src/lib/bookings';
import { listConnections } from '../../src/lib/messaging';
import { getSubscription } from '../../src/lib/subscription';
import { getSystemHealth, type SystemHealthOverview } from '../../src/lib/system-health';
import { listBetaFeedback } from '../../src/lib/beta';
import { confirm } from '../../src/lib/dialog';
import { supabase } from '../../src/lib/supabase';
import { tokens, webGlass } from '../../src/design/theme';

const I = { size: 18, color: ROSE, weight: 'duotone' as const };

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [me, setMe] = useState<Me | null>(null);
  const [ws, setWs] = useState<WorkspaceSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [services, setServices] = useState<number | null>(null);
  const [connected, setConnected] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealthOverview | null | 'error'>(null);
  const [newFeedback, setNewFeedback] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await getMe(true); setMe(m); setState('ready');
      const owner = m.memberships.some((x) => x.role === 'owner');
      const w = await getActiveWorkspace().catch(() => null); setWs(w);
      if (w && owner) {
        void listServices(w.id).then((s) => setServices(s.length)).catch(() => undefined);
        void listConnections(w.id).then((c) => setConnected(c.filter((x) => x.connected).length)).catch(() => undefined);
        void getSubscription(w.id).then((s) => setPlan(s.plan?.name ?? s.plan?.code ?? null)).catch(() => undefined);
      }
      // Founder group: the server decides (GET /me → founder from platform_founders). Never by email.
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

  const name = me?.displayName?.trim() || me?.email?.split('@')[0] || '';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
  const owner = me?.memberships.some((x) => x.role === 'owner');
  const student = !owner && me?.memberships.some((x) => x.role === 'student');
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = (Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? Constants.nativeBuildVersion ?? '—').toString();
  const checkedMin = health && health !== 'error' ? Math.max(0, Math.round((Date.now() - Math.max(...health.components.map((c) => Date.parse(c.last_checked_at) || 0), 0)) / 60000)) : null;

  return <Screen onRefresh={load}>
    <View style={{ gap: 2 }}><Overline>{t('pf.eyebrow')}</Overline><ScreenTitle>{t('pf.title')}</ScreenTitle></View>

    {ws ? <AiMeter workspaceId={ws.id} /> : null}
    {state === 'loading' ? <Skeleton rows={1} height={96} /> : null}
    {state === 'error' ? <View style={styles.card}><SupportText>{t('pf.loadFail')}</SupportText><Button small variant="secondary" label={t('pf.tryAgain')} onPress={() => { setState('loading'); void load(); }} /></View> : null}
    {me ? <View style={styles.card}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
        <Text numberOfLines={1} style={styles.studio}>{ws?.name ?? t('pf.noStudio')}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>{plan ? <Chip label={t('pf.plan', { name: plan })} /> : null}{me.founder ? <Chip tone="rose" label={t('pf.founder').toUpperCase()} /> : null}</View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit' as any)} hitSlop={10}><Text style={styles.edit}>{t('pf.edit')}</Text></Pressable>
    </View> : null}

    {ws && owner ? <AccountsStrip workspaceId={ws.id} /> : null}

    {me?.founder ? <SettingsGroup highlight title={t('pf.founder')} badge={t('pf.onlyYou')} icon={<Crown size={14} color={ROSE} weight="duotone" />}>
      <SettingsRow icon={<Heartbeat {...I} />} title={t('pf.health')} sub={health === 'error' ? t('pf.cantCheck') : checkedMin == null ? undefined : checkedLabel(t, checkedMin)}
        trailing={health === 'error' ? <Pressable onPress={() => { setHealth(null); if (ws) void getSystemHealth(ws.id).then(setHealth).catch(() => setHealth('error')); }}><Text style={styles.edit}>{t('pf.tryAgain')}</Text></Pressable> : health ? <Chip tone={health.overallStatus === 'healthy' ? 'success' : 'danger'} label={t(`pf.status.${health.overallStatus}`)} /> : null}
        onPress={() => router.push('/system-health')} />
      <SettingsRow icon={<Key {...I} />} title={t('pf.admin')} onPress={() => router.push('/founder-admin')} />
      <SettingsRow icon={<ChatText {...I} />} title={t('pf.beta')} trailing={newFeedback ? <Chip label={t('pf.newN', { count: newFeedback })} /> : null} onPress={() => router.push('/founder-admin')} />
      <SettingsRow icon={<CreditCard {...I} />} title={t('pf.billing')} sub={t('pf.viewOnly')} onPress={() => router.push('/subscription')} />
      <SettingsRow last icon={<ChartLine {...I} />} title={t('pf.analytics')} onPress={() => router.push('/analytics')} />
    </SettingsGroup> : null}

    <SettingsGroup title={t('pf.account')}>
      <SettingsRow icon={<User {...I} />} title={t('pf.account')} value={me?.email ?? ''} onPress={() => router.push('/profile/edit' as any)} />
      <SettingsRow icon={<Lock {...I} />} title={t('pf.password')} onPress={() => router.push('/settings/account')} />
      <SettingsRow last icon={<Translate {...I} />} title={t('pf.language')} value={i18n.language === 'ja' ? '日本語' : 'English'} onPress={() => setLangOpen(true)} />
    </SettingsGroup>

    {owner ? <SettingsGroup title={t('pf.business')}>
      <SettingsRow icon={<Users {...I} />} title={t('tabs.clients')} onPress={() => router.push('/clients')} />
      <SettingsRow icon={<CurrencyJpy {...I} />} title={t('pf.money')} onPress={() => router.push('/finance')} />
      <SettingsRow last icon={<Robot {...I} />} title={t('pf.aiAssistant')} onPress={() => router.push('/ai-settings')} />
    </SettingsGroup> : null}

    {owner ? <SettingsGroup title={t('pf.app')}>
      <SettingsRow icon={<Link {...I} />} title={t('pf.connected')} value={connected} onPress={() => router.push('/settings/connections')} />
      <SettingsRow icon={<Scissors {...I} />} title={t('pf.services')} value={services} onPress={() => router.push('/services')} />
      <SettingsRow icon={<Clock {...I} />} title={t('pf.hours')} onPress={() => router.push('/business-hours' as any)} />
      <SettingsRow last icon={<Clock {...I} />} title={t('pf.daysOff')} onPress={() => router.push('/time-off' as any)} />
    </SettingsGroup> : null}
    {student ? <SettingsGroup title={t('pf.app')}><SettingsRow last icon={<GraduationCap {...I} />} title={t('pf.academy')} onPress={() => router.push('/academy' as any)} /></SettingsGroup> : null}

    <SettingsGroup title={t('pf.support')}>
      <SettingsRow icon={<ShieldCheck {...I} />} title={t('pf.privacy')} onPress={() => router.push('/privacy')} />
      <SettingsRow icon={<ShieldCheck {...I} />} title={t('pf.terms')} onPress={() => router.push('/terms')} />
      <SettingsRow icon={<Question {...I} />} title={t('pf.help')} onPress={() => router.push('/help')} />
      <SettingsRow last icon={<ChatText {...I} />} title={t('pf.feedback')} onPress={() => router.push('/beta-feedback')} />
    </SettingsGroup>

    <View style={{ gap: 10 }}>
      <Button variant="secondary" label={t('pf.logout')} onPress={() => void logout()} />
      {me && !me.founder ? <Button variant="danger" label={t('pf.delete')} onPress={() => setDeleteOpen(true)} /> : null}
      <Text style={styles.version}>{t('pf.version', { v: version, b: build })}</Text>
    </View>

    <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{t('pf.langTitle')}</Text>
        {(['ja', 'en'] as const).map((l) => <Pressable key={l} accessibilityRole="button" onPress={() => void setLang(l)} style={[styles.option, i18n.language === l && styles.optionOn]}><Text style={[styles.optionText, i18n.language === l && { color: '#FFFFFF' }]}>{l === 'ja' ? '日本語' : 'English'}</Text></Pressable>)}
      </View></Pressable>
    </Modal>
    <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} workspaceId={ws?.id ?? null} email={me?.email ?? null} />
  </Screen>;
}

/** Real relative time of the last health check: just now / N min / N h / N days. */
function checkedLabel(t: (k: string, o?: Record<string, unknown>) => string, min: number) {
  if (min < 1) return t('pf.checkedNow');
  if (min < 60) return t('pf.checked', { min });
  if (min < 48 * 60) return t('pf.checkedH', { h: Math.round(min / 60) });
  return t('pf.checkedD', { d: Math.round(min / 1440) });
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFEFEF', ...(webGlass as object) },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B87766' },
  avatarText: { color: '#FFFFFF', fontFamily: tokens.font.display, fontSize: 26 },
  name: { fontFamily: tokens.font.uiSemibold, fontSize: 18, color: '#262626' },
  studio: { fontFamily: tokens.font.ui, fontSize: 13, color: '#737373' },
  edit: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ROSE },
  version: { textAlign: 'center', fontFamily: tokens.font.ui, fontSize: 12, color: '#8E8E8E', marginTop: 4 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { gap: 10, padding: 20, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F5F2EE' },
  sheetTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 17, color: '#262626', textAlign: 'center', marginBottom: 4 },
  option: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.12)' },
  optionOn: { backgroundColor: '#262626', borderColor: '#262626' },
  optionText: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#262626' }
});
