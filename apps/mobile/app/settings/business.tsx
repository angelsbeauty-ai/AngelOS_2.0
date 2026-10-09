import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Field, Tabs } from '../../src/components/Field';
import { ActionButton } from '../../src/components/MessagingBits';
import { Card, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { dialog } from '../../src/lib/dialog';
import { getActiveWorkspace, updateWorkspace, type WorkspaceSummary } from '../../src/lib/workspace';

const CURRENCIES = ['JPY', 'USD', 'EUR', 'AUD', 'GBP'] as const;
const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Asia/Tokyo'; } };

export default function BusinessSettings() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<WorkspaceSummary | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [timezone, setTimezone] = useState('Asia/Tokyo');
  const [locale, setLocale] = useState<'en' | 'ja'>('ja');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getActiveWorkspace().then((w) => { setWs(w); setName(w.name); setCurrency(w.currency); setTimezone(w.timezone); setLocale(w.locale?.startsWith('en') ? 'en' : 'ja'); }).catch(() => undefined); }, []);
  const owner = ws?.role !== 'student';
  const tzOptions = Array.from(new Set(['Asia/Tokyo', deviceTz(), timezone]));

  async function save() {
    if (!ws) return;
    setBusy(true);
    try { const next = await updateWorkspace(ws.id, { name: name.trim(), currency, timezone, locale }); setWs({ ...ws, ...next }); await dialog.notify(t('common.saved')); }
    catch (e) { await dialog.notify(t('common.error'), e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>{t('business.title')}</ScreenTitle>
    {!owner ? <SupportText>{t('business.ownerOnly')}</SupportText> : null}
    <Card><Field label={t('business.name')} value={name} onChangeText={setName} editable={owner} /></Card>
    <Card><SectionTitle>{t('business.currency')}</SectionTitle><Tabs value={currency} options={CURRENCIES.map((c) => ({ id: c, label: c }))} onChange={setCurrency} /></Card>
    <Card><SectionTitle>{t('business.timezone')}</SectionTitle><Tabs value={timezone} options={tzOptions.map((z) => ({ id: z, label: z }))} onChange={setTimezone} /></Card>
    <Card><SectionTitle>{t('business.locale')}</SectionTitle><Tabs<'en' | 'ja'> value={locale} options={[{ id: 'ja', label: '日本語' }, { id: 'en', label: 'English' }]} onChange={setLocale} /></Card>
    <ActionButton kind="primary" label={t('common.save')} disabled={busy || !owner || !ws || !name.trim()} onPress={() => void save()} />
  </Screen>;
}
