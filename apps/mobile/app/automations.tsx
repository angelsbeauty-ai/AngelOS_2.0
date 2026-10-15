import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton, Banner, BilingualBlock } from '../src/components/MessagingBits';
import { Field, Tabs, fieldStyles } from '../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../src/components/ui';
import { listAutomationJobs, listAutomationRules, listDueReminders, listReminderRules, seedAutomationDefaults, updateAutomationRule, updateReminderRule, type AutomationJob, type AutomationRule, type DueReminder, type ReminderRule } from '../src/lib/automations';
import { approveSuggestion, dismissSuggestion } from '../src/lib/suggestions';
import { translateText } from '../src/lib/messaging';
import { getActiveWorkspace } from '../src/lib/workspace';
import { dialog } from '../src/lib/dialog';

type Tab = 'today' | 'messages' | 'tasks';

export default function AutomationsScreen() {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [due, setDue] = useState<DueReminder[] | null>(null);
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [editing, setEditing] = useState<{ type: string; en: string; meaning: string; ja: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    try {
      const id = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(id);
      const [d, r] = await Promise.all([listDueReminders(id).catch(() => []), listReminderRules(id).catch(() => [])]);
      setDue(d); setReminders(r);
      let all = await listAutomationRules(id).catch(() => [] as AutomationRule[]);
      if (!all.filter((x) => x.action_type !== 'client_message').length) all = [...all, ...(await seedAutomationDefaults(id).catch(() => []))];
      setRules(all.filter((x) => x.action_type !== 'client_message'));
      setJobs(await listAutomationJobs(id).catch(() => []));
    } catch (e) { void dialog.notify('Could not load reminders', e instanceof Error ? e.message : ''); }
  }
  async function approve(item: DueReminder) {
    if (!workspaceId) return;
    setBusy(item.key);
    try { const res = await approveSuggestion(workspaceId, item.key); setDue((d) => d?.filter((x) => x.key !== item.key) ?? null); if (res.threadId) router.push(`/messages/${res.threadId}` as any); }
    catch (e) { void dialog.notify('Could not prepare message', e instanceof Error ? e.message : ''); }
    finally { setBusy(null); }
  }
  async function saveTemplate() {
    if (!workspaceId || !editing) return;
    try { await updateReminderRule(workspaceId, editing.type, { templateEn: editing.en, ...(editing.ja ? { templateJa: editing.ja, templateJaMeaning: editing.meaning } : {}) }); setEditing(null); await load(); }
    catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : ''); }
  }

  return <Screen onRefresh={() => load()}>
    <ScreenTitle>{t('auto.s0')}</ScreenTitle>
    <SupportText>{t('auto.s1')}</SupportText>
    <Tabs value={tab} onChange={setTab} options={[{ id: 'today', label: t('auto.s16') }, { id: 'messages', label: t('auto.s17') }, { id: 'tasks', label: t('auto.s18') }]} />

    {tab === 'today' ? <>
      {due === null ? <Card><BodyText>{t('auto.s2')}</BodyText></Card> : null}
      {due?.length === 0 ? <Card><BodyText>{t('auto.s3')}</BodyText></Card> : null}
      {due?.map((item) => <Card key={item.key}>
        <SectionTitle>{item.title}</SectionTitle>
        {item.language === 'ja' ? <BilingualBlock ja={item.message} en={item.meaningEn} /> : <BodyText>{item.message}</BodyText>}
        <View style={fieldStyles.row}>
          <ActionButton kind="primary" label={busy === item.key ? 'Working…' : 'Approve'} disabled={Boolean(busy)} accessibilityHint="Puts this message in the conversation as a draft" onPress={() => void approve(item)} />
          <ActionButton label={t('auto.s8')} onPress={() => { setDue((d) => d?.filter((x) => x.key !== item.key) ?? null); if (workspaceId) void dismissSuggestion(workspaceId, item.key).catch(() => undefined); }} />
        </View>
      </Card>)}
    </> : null}

    {tab === 'messages' ? reminders.map((r) => <Card key={r.type}>
      <View style={fieldStyles.line}><Text style={fieldStyles.strong}>{r.name}</Text><Switch accessibilityLabel={`${r.name} on`} value={r.enabled} onValueChange={(enabled) => { if (workspaceId) void updateReminderRule(workspaceId, r.type, { enabled }).then(load).catch((e) => void dialog.notify('Could not update', e instanceof Error ? e.message : '')); }} /></View>
      {editing?.type === r.type ? <>
        <Field label={t('auto.s9')} value={editing.en} onChangeText={(en) => setEditing({ ...editing, en })} multiline hint={t('auto.s10')} />
        <Field label={t('auto.s11')} value={editing.meaning} onChangeText={(meaning) => setEditing({ ...editing, meaning, ja: '' })} multiline />
        <ActionButton label={t('auto.s12')} disabled={!editing.meaning.trim()} onPress={() => { if (workspaceId) void translateText(workspaceId, editing.meaning, 'ja').then((t) => setEditing({ ...editing, ja: t.translation })).catch((e) => void dialog.notify('Could not translate', e instanceof Error ? e.message : '')); }} />
        {editing.ja ? <BilingualBlock ja={editing.ja} en={editing.meaning} /> : <SupportText>{t('auto.s4')}</SupportText>}
        <View style={fieldStyles.row}><ActionButton kind="primary" label={t('auto.s13')} onPress={() => void saveTemplate()} /><ActionButton kind="quiet" label={t('auto.s14')} onPress={() => setEditing(null)} /></View>
      </> : <>
        <SupportText>English: {r.en}</SupportText>
        <BilingualBlock ja={r.ja} en={r.ja_meaning} />
        <ActionButton kind="quiet" label={t('auto.s15')} onPress={() => setEditing({ type: r.type, en: r.en, meaning: r.ja_meaning, ja: r.ja })} />
      </>}
    </Card>) : null}

    {tab === 'tasks' ? <>
      <Banner>{t('auto.s5')}</Banner>
      {rules.map((rule) => <Card key={rule.id}><View style={fieldStyles.line}><View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{rule.name}</Text><SupportText>{rule.category.replaceAll('_', ' ')}</SupportText></View><Switch accessibilityLabel={`${rule.name} on`} value={rule.enabled} onValueChange={(enabled) => { if (workspaceId) void updateAutomationRule(workspaceId, rule.id, { enabled }).then(load).catch(() => undefined); }} /></View></Card>)}
      <Card><SectionTitle>{t('auto.s6')}</SectionTitle>{jobs.length ? jobs.slice(0, 15).map((j) => <SupportText key={j.id}>{new Date(j.scheduled_for).toLocaleString()} · {j.rule?.name ?? 'Task'} · {j.status.replaceAll('_', ' ')}</SupportText>) : <SupportText>{t('auto.s7')}</SupportText>}</Card>
    </> : null}
  </Screen>;
}
