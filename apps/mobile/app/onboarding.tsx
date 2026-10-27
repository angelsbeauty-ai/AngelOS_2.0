import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton, Chip } from '../src/components/MessagingBits';
import { TimeField } from '../src/components/DateField';
import { Field, fieldStyles } from '../src/components/Field';
import { AccentSwitch, BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText } from '../src/components/ui';
import { apiFetch } from '../src/lib/api';
import { getBetaAccess, redeemBetaInvite, type BetaAccess } from '../src/lib/beta';
import { createService, setBusinessHours } from '../src/lib/bookings';
import { clearMe, updateMe } from '../src/lib/me';
import { dialog } from '../src/lib/dialog';
import { friendlyText } from '../src/lib/friendly-error';

type Workspace = { id: string; name: string; timezone: string; currency: string; locale: string };
const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'KRW', 'TWD'];
/** AngelOS V1 has no bookings, so onboarding is invite → business → done. Services/hours stay in code for later. */
const V1_BOOKINGS = false;
/** Common treatments as a starting point; prices are left for the owner to fill in (no sample prices). */
const PRESETS = [
  { name: 'Powder brows', minutes: '150', price: '' },
  { name: 'Lip blush', minutes: '150', price: '' },
  { name: 'Eyeliner', minutes: '120', price: '' }
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** B10: invite → Business → Services → Hours → Done. Never a dead end. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ invite?: string }>();
  const deviceZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [access, setAccess] = useState<BetaAccess | null>(null);
  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState(params.invite ?? '');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [biz, setBiz] = useState({ name: '', currency: 'JPY', timezone: 'Asia/Tokyo', language: 'en' as 'en' | 'ja' });
  const [services, setServices] = useState(PRESETS.map((p) => ({ ...p, on: true })));
  const [hours, setHours] = useState(DAYS.map((_, d) => ({ dayOfWeek: d, open: d !== 0, startTime: '10:00', endTime: '19:00' })));
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const a = await getBetaAccess(); setAccess(a);
      const existing = await apiFetch<Workspace[]>('/workspaces').catch(() => []);
      if (existing[0]) { if (!V1_BOOKINGS) { router.replace('/' as any); return; } setWorkspace(existing[0]); setStep(2); }
    } catch { setAccess(null); } finally { setChecking(false); }
  })(); }, []);

  async function redeem() {
    if (!invite.trim()) return;
    setSaving(true);
    try {
      const result: any = await redeemBetaInvite(invite.trim()); setInvite('');
      clearMe();
      if (result?.role === 'student') { router.replace('/profile' as any); return; }
      setAccess(result);
    } catch (e) { { const f = friendlyText(e, { action: 'save' }, t('onb.inviteFail', "Invite could not be used")); void dialog.notify(f.title, f.message); } }
    finally { setSaving(false); }
  }
  async function saveBusiness() {
    setSaving(true);
    try {
      const ws = await apiFetch<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name: biz.name.trim(), businessType: 'beauty', timezone: biz.timezone, currency: biz.currency, locale: biz.language === 'ja' ? 'ja-JP' : 'en-JP' }) });
      await updateMe({ language: biz.language }).catch(() => undefined);
      clearMe(); setWorkspace(ws); setStep(V1_BOOKINGS ? 2 : 4);
    } catch (e) { { const f = friendlyText(e, { action: 'save' }, t('onb.createFail', "Could not create your studio")); void dialog.notify(f.title, f.message); } }
    finally { setSaving(false); }
  }
  async function saveServices() {
    if (!workspace) return;
    setSaving(true);
    try {
      for (const s of services.filter((x) => x.on && x.name.trim())) {
        await createService(workspace.id, { name: s.name.trim(), durationMinutes: Number(s.minutes) || 120, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, standardPrice: Number(s.price) || 0, currency: workspace.currency });
      }
      setStep(3);
    } catch (e) { { const f = friendlyText(e, { action: 'save' }, t('onb.svcFail', "Could not save services")); void dialog.notify(f.title, f.message); } }
    finally { setSaving(false); }
  }
  async function saveHours() {
    if (!workspace) return;
    setSaving(true);
    try { await setBusinessHours(workspace.id, hours.map((h) => (h.open ? { dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, isClosed: false } : { dayOfWeek: h.dayOfWeek, isClosed: true }))); setStep(4); }
    catch (e) { { const f = friendlyText(e, { action: 'save' }, t('onb.hoursFail', "Could not save hours")); void dialog.notify(f.title, f.message); } }
    finally { setSaving(false); }
  }

  if (checking) return <Screen><Card><BodyText>{t('onb.s0')}</BodyText></Card></Screen>;
  if (!access?.approved) return <Screen>
    <ScreenTitle>{t('onb.s1')}</ScreenTitle>
    <SupportText>{t('onb.s2')}</SupportText>
    <Card premium>
      <Field label={t('onb.s11')} value={invite} onChangeText={setInvite} autoCapitalize="none" autoCorrect={false} />
      <ActionButton kind="primary" label={saving ? t('onb.checking', "Checking\u2026") : t('onb.useInvite', "Use invite")} disabled={saving || !invite.trim()} onPress={() => void redeem()} />
    </Card>
  </Screen>;

  return <Screen>
    {step < 4 ? <Pill tone="gold">{t('onb.stepOf', { n: V1_BOOKINGS ? step : 1, total: V1_BOOKINGS ? 4 : 2, defaultValue: 'Step {{n}} of {{total}}' })}</Pill> : null}
    {step === 1 ? <>
      <ScreenTitle>{t('onb.s3')}</ScreenTitle>
      <Card>
        <Field label={t('onb.s12')} value={biz.name} onChangeText={(name) => setBiz({ ...biz, name })} autoCapitalize="words" />
        <SupportText>{t('onb.s4')}</SupportText>
        <View style={fieldStyles.row}>{CURRENCIES.map((c) => <Chip key={c} label={c} selected={biz.currency === c} onPress={() => setBiz({ ...biz, currency: c })} />)}</View>
        <SupportText>{t('onb.s5')}</SupportText>
        <View style={fieldStyles.row}>{Array.from(new Set(['Asia/Tokyo', deviceZone])).map((z) => <Chip key={z} label={z} selected={biz.timezone === z} onPress={() => setBiz({ ...biz, timezone: z })} />)}</View>
        <SupportText>{t('onb.s6')}</SupportText>
        <View style={fieldStyles.row}><Chip label={t('onb.english', "English")} selected={biz.language === 'en'} onPress={() => setBiz({ ...biz, language: 'en' })} /><Chip label="日本語" selected={biz.language === 'ja'} onPress={() => setBiz({ ...biz, language: 'ja' })} /></View>
        <ActionButton kind="primary" label={saving ? t('onb.saving', "Saving\u2026") : t('onb.next', "Next")} disabled={saving || !biz.name.trim()} onPress={() => void saveBusiness()} />
      </Card>
    </> : null}
    {step === 2 ? <>
      <ScreenTitle>{t('onb.s7')}</ScreenTitle>
      <SupportText>{t('onb.s8')}</SupportText>
      {services.map((s, i) => <Card key={i}>
        <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{s.name || 'Service'}</Text><AccentSwitch accessibilityLabel={`Offer ${s.name}`} value={s.on} onValueChange={(on) => setServices(services.map((x, j) => (j === i ? { ...x, on } : x)))} /></View>
        {s.on ? <>
          <Field label={t('onb.s13')} value={s.name} onChangeText={(name) => setServices(services.map((x, j) => (j === i ? { ...x, name } : x)))} />
          <View style={fieldStyles.row}>
            <View style={{ flex: 1 }}><Field label={t('onb.s14')} value={s.minutes} keyboardType="number-pad" onChangeText={(minutes) => setServices(services.map((x, j) => (j === i ? { ...x, minutes } : x)))} /></View>
            <View style={{ flex: 1 }}><Field label={`Price (${workspace?.currency ?? 'JPY'})`} value={s.price} keyboardType="number-pad" onChangeText={(price) => setServices(services.map((x, j) => (j === i ? { ...x, price } : x)))} /></View>
          </View>
        </> : null}
      </Card>)}
      <View style={fieldStyles.row}><ActionButton kind="primary" label={saving ? 'Saving…' : 'Next'} disabled={saving} onPress={() => void saveServices()} /><ActionButton kind="quiet" label={t('onb.s15')} onPress={() => setStep(3)} /></View>
    </> : null}
    {step === 3 ? <>
      <ScreenTitle>{t('onb.s9')}</ScreenTitle>
      {hours.map((h, i) => <Card key={h.dayOfWeek}>
        <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{DAYS[h.dayOfWeek]}</Text><AccentSwitch accessibilityLabel={`${DAYS[h.dayOfWeek]} open`} value={h.open} onValueChange={(open) => setHours(hours.map((x, j) => (j === i ? { ...x, open } : x)))} /></View>
        {h.open ? <View style={fieldStyles.row}><TimeField label={t('onb.s16')} value={h.startTime} onChange={(startTime) => setHours(hours.map((x, j) => (j === i ? { ...x, startTime } : x)))} /><TimeField label={t('onb.s17')} value={h.endTime} onChange={(endTime) => setHours(hours.map((x, j) => (j === i ? { ...x, endTime } : x)))} /></View> : null}
      </Card>)}
      <View style={fieldStyles.row}><ActionButton kind="primary" label={saving ? 'Saving…' : 'Next'} disabled={saving} onPress={() => void saveHours()} /><ActionButton kind="quiet" label={t('onb.s15')} onPress={() => setStep(4)} /></View>
    </> : null}
    {step === 4 ? <>
      <ScreenTitle>{t('onb.s10')}</ScreenTitle>
      <Card premium><BodyText>{t('onb.readyV1', { name: workspace?.name ?? t('onb.yourStudio', 'Your studio'), defaultValue: '{{name}} is ready. Connect your accounts and plan your first post.' })}</BodyText></Card>
      <ActionButton kind="primary" label={t('onb.start', 'Get started')} onPress={() => router.replace('/' as any)} />
    </> : null}
  </Screen>;
}
