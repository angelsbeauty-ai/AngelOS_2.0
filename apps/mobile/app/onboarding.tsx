import { useEffect, useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton, Chip } from '../src/components/MessagingBits';
import { TimeField } from '../src/components/DateField';
import { Field, fieldStyles } from '../src/components/Field';
import { BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText } from '../src/components/ui';
import { apiFetch } from '../src/lib/api';
import { getBetaAccess, redeemBetaInvite, type BetaAccess } from '../src/lib/beta';
import { createService, setBusinessHours } from '../src/lib/bookings';
import { clearMe, updateMe } from '../src/lib/me';
import { dialog } from '../src/lib/dialog';

type Workspace = { id: string; name: string; timezone: string; currency: string; locale: string };
const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'KRW', 'TWD'];
const PRESETS = [
  { name: 'Powder brows', minutes: '150', price: '50000' },
  { name: 'Lip blush', minutes: '150', price: '55000' },
  { name: 'Eyeliner', minutes: '120', price: '45000' }
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** B10: invite → Business → Services → Hours → Done. Never a dead end. */
export default function OnboardingScreen() {
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
      if (existing[0]) { setWorkspace(existing[0]); setStep(2); }
    } catch { setAccess(null); } finally { setChecking(false); }
  })(); }, []);

  async function redeem() {
    if (!invite.trim()) return;
    setSaving(true);
    try {
      const result: any = await redeemBetaInvite(invite.trim()); setInvite('');
      clearMe();
      if (result?.role === 'student') { router.replace('/academy' as any); return; }
      setAccess(result);
    } catch (e) { void dialog.notify('Invite could not be used', e instanceof Error ? e.message : ''); }
    finally { setSaving(false); }
  }
  async function saveBusiness() {
    setSaving(true);
    try {
      const ws = await apiFetch<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name: biz.name.trim(), businessType: 'beauty', timezone: biz.timezone, currency: biz.currency, locale: biz.language === 'ja' ? 'ja-JP' : 'en-JP' }) });
      await updateMe({ language: biz.language }).catch(() => undefined);
      clearMe(); setWorkspace(ws); setStep(2);
    } catch (e) { void dialog.notify('Could not create your studio', e instanceof Error ? e.message : ''); }
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
    } catch (e) { void dialog.notify('Could not save services', e instanceof Error ? e.message : ''); }
    finally { setSaving(false); }
  }
  async function saveHours() {
    if (!workspace) return;
    setSaving(true);
    try { await setBusinessHours(workspace.id, hours.map((h) => (h.open ? { dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, isClosed: false } : { dayOfWeek: h.dayOfWeek, isClosed: true }))); setStep(4); }
    catch (e) { void dialog.notify('Could not save hours', e instanceof Error ? e.message : ''); }
    finally { setSaving(false); }
  }

  if (checking) return <Screen><Card><BodyText>Getting things ready…</BodyText></Card></Screen>;
  if (!access?.approved) return <Screen>
    <ScreenTitle>Welcome to AngelOS</ScreenTitle>
    <SupportText>AngelOS is invite-only while we test. Paste the invite you were sent.</SupportText>
    <Card premium>
      <Field label="Invite code" value={invite} onChangeText={setInvite} autoCapitalize="none" autoCorrect={false} />
      <ActionButton kind="primary" label={saving ? 'Checking…' : 'Use invite'} disabled={saving || !invite.trim()} onPress={() => void redeem()} />
    </Card>
  </Screen>;

  return <Screen>
    <Pill tone="gold">Step {step} of 4</Pill>
    {step === 1 ? <>
      <ScreenTitle>Your business</ScreenTitle>
      <Card>
        <Field label="Business name" value={biz.name} onChangeText={(name) => setBiz({ ...biz, name })} autoCapitalize="words" />
        <SupportText>Currency</SupportText>
        <View style={fieldStyles.row}>{CURRENCIES.map((c) => <Chip key={c} label={c} selected={biz.currency === c} onPress={() => setBiz({ ...biz, currency: c })} />)}</View>
        <SupportText>Time zone</SupportText>
        <View style={fieldStyles.row}>{Array.from(new Set(['Asia/Tokyo', deviceZone])).map((z) => <Chip key={z} label={z} selected={biz.timezone === z} onPress={() => setBiz({ ...biz, timezone: z })} />)}</View>
        <SupportText>App language</SupportText>
        <View style={fieldStyles.row}><Chip label="English" selected={biz.language === 'en'} onPress={() => setBiz({ ...biz, language: 'en' })} /><Chip label="日本語" selected={biz.language === 'ja'} onPress={() => setBiz({ ...biz, language: 'ja' })} /></View>
        <ActionButton kind="primary" label={saving ? 'Saving…' : 'Next'} disabled={saving || !biz.name.trim()} onPress={() => void saveBusiness()} />
      </Card>
    </> : null}
    {step === 2 ? <>
      <ScreenTitle>Your services</ScreenTitle>
      <SupportText>Start with these and change anything. You can edit them later in Services.</SupportText>
      {services.map((s, i) => <Card key={i}>
        <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{s.name || 'Service'}</Text><Switch accessibilityLabel={`Offer ${s.name}`} value={s.on} onValueChange={(on) => setServices(services.map((x, j) => (j === i ? { ...x, on } : x)))} /></View>
        {s.on ? <>
          <Field label="Name" value={s.name} onChangeText={(name) => setServices(services.map((x, j) => (j === i ? { ...x, name } : x)))} />
          <View style={fieldStyles.row}>
            <View style={{ flex: 1 }}><Field label="Minutes" value={s.minutes} keyboardType="number-pad" onChangeText={(minutes) => setServices(services.map((x, j) => (j === i ? { ...x, minutes } : x)))} /></View>
            <View style={{ flex: 1 }}><Field label={`Price (${workspace?.currency ?? 'JPY'})`} value={s.price} keyboardType="number-pad" onChangeText={(price) => setServices(services.map((x, j) => (j === i ? { ...x, price } : x)))} /></View>
          </View>
        </> : null}
      </Card>)}
      <View style={fieldStyles.row}><ActionButton kind="primary" label={saving ? 'Saving…' : 'Next'} disabled={saving} onPress={() => void saveServices()} /><ActionButton kind="quiet" label="Skip" onPress={() => setStep(3)} /></View>
    </> : null}
    {step === 3 ? <>
      <ScreenTitle>Your hours</ScreenTitle>
      {hours.map((h, i) => <Card key={h.dayOfWeek}>
        <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{DAYS[h.dayOfWeek]}</Text><Switch accessibilityLabel={`${DAYS[h.dayOfWeek]} open`} value={h.open} onValueChange={(open) => setHours(hours.map((x, j) => (j === i ? { ...x, open } : x)))} /></View>
        {h.open ? <View style={fieldStyles.row}><TimeField label="Opens" value={h.startTime} onChange={(startTime) => setHours(hours.map((x, j) => (j === i ? { ...x, startTime } : x)))} /><TimeField label="Closes" value={h.endTime} onChange={(endTime) => setHours(hours.map((x, j) => (j === i ? { ...x, endTime } : x)))} /></View> : null}
      </Card>)}
      <View style={fieldStyles.row}><ActionButton kind="primary" label={saving ? 'Saving…' : 'Next'} disabled={saving} onPress={() => void saveHours()} /><ActionButton kind="quiet" label="Skip" onPress={() => setStep(4)} /></View>
    </> : null}
    {step === 4 ? <>
      <ScreenTitle>You're all set</ScreenTitle>
      <Card premium><BodyText>{workspace?.name ?? 'Your studio'} is ready. Add your first client or booking from Today.</BodyText></Card>
      <ActionButton kind="primary" label="Go to Today" onPress={() => router.replace('/(tabs)' as any)} />
    </> : null}
  </Screen>;
}
