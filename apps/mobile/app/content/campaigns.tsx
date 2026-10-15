import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { DateField, addDayString, dayString, prettyDay } from '../../src/components/DateField';
import { tokens } from '../../src/design/theme';
import { dialog } from '../../src/lib/dialog';
import {
  createCampaign, createLineDraft, deleteHashtagSet, listCampaigns, listHashtagSets, listIdeas, planCampaign, planDays, saveHashtagSet,
  type Campaign, type ContentIdea, type HashtagSet
} from '../../src/lib/content';
import { getActiveWorkspace } from '../../src/lib/workspace';

const GOALS = [['bookings', 'Bookings'], ['academy_students', 'Academy students'], ['touch_ups', 'Touch-ups'], ['trust', 'Trust'], ['reach', 'Reach']] as const;
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Please try again.');

export default function CampaignsScreen() {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [migration, setMigration] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [sets, setSets] = useState<HashtagSet[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const today = dayString(new Date());
  const [form, setForm] = useState({ name: '', goal: 'bookings', startsOn: addDayString(today, 1), endsOn: addDayString(today, 14), offer: '' });
  const [lineTopic, setLineTopic] = useState('');
  const [setForm2, setSetForm2] = useState({ name: '', tags: '' });

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws);
      const [c, i, h] = await Promise.all([listCampaigns(ws), listIdeas(ws).catch(() => ({ ideas: [] })), listHashtagSets(ws).catch(() => ({ sets: [], needsMigration: null }))]);
      setCampaigns(c.campaigns); setMigration(c.needsMigration); setIdeas(i.ideas); setSets(h.sets); setState('ready');
    } catch { setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function run<T>(task: () => Promise<T>, after?: (v: T) => void) {
    setBusy(true);
    try { const v = await task(); after?.(v); await load(); }
    catch (e) { void dialog.notify('That did not work', errText(e)); }
    finally { setBusy(false); }
  }

  if (state === 'error') return <Screen><ErrorState title={t('camp.s11')} message={t('camp.s12')} onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!workspaceId) return <Screen><Card><SupportText>{t('camp.s0')}</SupportText></Card></Screen>;

  return <Screen>
    <ScreenTitle>Campaigns & ideas</ScreenTitle>
    <SupportText>{t('camp.s1')}</SupportText>

    <Card premium>
      <SectionTitle>{t('camp.s2')}</SectionTitle>
      <SupportText>{t('camp.s3')}</SupportText>
      <ActionButton kind="primary" label={busy ? 'Planning…' : 'Plan 30 days'} disabled={busy} onPress={() => void (async () => {
        const ok = await dialog.confirm({ title: t('camp.s31'), message: t('camp.s32'), confirmText: t('camp.s33'), cancelText: t('camp.s34') });
        if (ok) await run(() => planDays(workspaceId), (r) => void dialog.notify(`${r.created.length} drafts added`, r.note));
      })()} />
    </Card>

    <Card>
      <SectionTitle>{t('camp.s4')}</SectionTitle>
      {migration ? <Banner tone="warning"><SupportText>Campaigns start after a database update ({migration}). The 30-day plan and ideas work now.</SupportText></Banner> : null}
      <TextInput accessibilityLabel={t('camp.s13')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder={t('camp.s14')} placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <View style={styles.chips}>{GOALS.map(([k, l]) => <Chip key={k} label={l} selected={form.goal === k} onPress={() => setForm({ ...form, goal: k })} />)}</View>
      <DateField label={t('camp.s15')} value={form.startsOn} min={today} onChange={(startsOn) => setForm({ ...form, startsOn })} />
      <DateField label={t('camp.s16')} value={form.endsOn} min={form.startsOn} onChange={(endsOn) => setForm({ ...form, endsOn })} />
      <TextInput accessibilityLabel={t('camp.s17')} value={form.offer} onChangeText={(offer) => setForm({ ...form, offer })} placeholder={t('camp.s18')} placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton kind="primary" label={t('camp.s19')} disabled={busy || !form.name.trim() || Boolean(migration)} onPress={() => void run(async () => {
        const c = await createCampaign(workspaceId, { ...form, name: form.name.trim(), offer: form.offer.trim() || undefined });
        return planCampaign(workspaceId, c.id);
      }, (r) => { setForm({ ...form, name: '', offer: '' }); void dialog.notify(`${r.created.length} post drafts added`, r.lineBroadcast ? 'Plus one LINE broadcast draft (with English meaning). Check the message count before sending.' : (r.lineNote ?? '')); })} />
    </Card>

    {campaigns.length ? <Card>
      <SectionTitle>{t('camp.s5')}</SectionTitle>
      {campaigns.map((c) => <View key={c.id} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{c.name}</Text><SupportText>{prettyDay(c.starts_on)} – {prettyDay(c.ends_on)} · {c.post_count} post{c.post_count === 1 ? '' : 's'} · {c.status}</SupportText></View>
        {c.status === 'draft' ? <ActionButton label={t('camp.s20')} disabled={busy} onPress={() => void run(() => planCampaign(workspaceId, c.id))} /> : <ActionButton kind="quiet" label={t('camp.s21')} onPress={() => router.push('/content')} />}
      </View>)}
    </Card> : null}

    <Card>
      <SectionTitle>{t('camp.s6')}</SectionTitle>
      <SupportText>{t('camp.s7')}</SupportText>
      <TextInput accessibilityLabel={t('camp.s22')} value={lineTopic} onChangeText={setLineTopic} placeholder={t('camp.s23')} placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton label={t('camp.s24')} disabled={busy} onPress={() => void run(() => createLineDraft(workspaceId, { topic: lineTopic.trim() || undefined }), (r) => { setLineTopic(''); router.push(`/content/${r.postId}`); })} />
    </Card>

    <Card>
      <SectionTitle>{t('camp.s8')}</SectionTitle>
      {!ideas.length ? <SupportText>{t('camp.s9')}</SupportText> : null}
      {ideas.map((idea) => <View key={idea.key} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{idea.title}</Text><SupportText>{idea.angle}{idea.date ? ` · ${prettyDay(idea.date)}` : ''}</SupportText></View>
        <ActionButton label={t('camp.s25')} onPress={() => router.push({ pathname: '/content/new', params: { title: idea.title, goal: idea.objective, ...(idea.date && idea.date >= today ? { date: idea.date } : {}) } } as any)} />
      </View>)}
    </Card>

    <Card>
      <SectionTitle>{t('camp.s10')}</SectionTitle>
      {sets.map((s) => <View key={s.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{s.name}</Text><SupportText>{s.tags.join(' ')}</SupportText></View><ActionButton kind="quiet" label={t('camp.s26')} onPress={() => void run(() => deleteHashtagSet(workspaceId, s.id))} /></View>)}
      <TextInput accessibilityLabel={t('camp.s27')} value={setForm2.name} onChangeText={(name) => setSetForm2({ ...setForm2, name })} placeholder={t('camp.s28')} placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <TextInput accessibilityLabel={t('camp.s29')} value={setForm2.tags} onChangeText={(tags) => setSetForm2({ ...setForm2, tags })} placeholder="#眉アートメイク #沖縄 #pmu" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton label={t('camp.s30')} disabled={busy || !setForm2.name.trim() || !setForm2.tags.trim()} onPress={() => void run(() => saveHashtagSet(workspaceId, { name: setForm2.name.trim(), language: /[\u3040-\u30ff\u4e00-\u9faf]/.test(setForm2.tags) ? (/[a-z]/i.test(setForm2.tags) ? 'both' : 'ja') : 'en', tags: setForm2.tags.split(/[\s,、]+/).filter(Boolean) }), () => setSetForm2({ name: '', tags: '' }))} />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 16, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: 12, fontSize: 15, fontFamily: tokens.font.ui },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText }
});
