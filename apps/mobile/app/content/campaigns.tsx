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

  if (state === 'error') return <Screen><ErrorState title="We couldn't load campaigns" message="Check your connection and try again." onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!workspaceId) return <Screen><Card><SupportText>Loading…</SupportText></Card></Screen>;

  return <Screen>
    <ScreenTitle>Campaigns & ideas</ScreenTitle>
    <SupportText>AngelOS puts drafts on your Social calendar. Nothing is posted until you approve and post it.</SupportText>

    <Card premium>
      <SectionTitle>Fill the next 30 days</SectionTitle>
      <SupportText>About 12 drafts: results 40%, education 25%, behind the scenes 15%, client stories 10%, offers/Academy 10%. Days that already have a post are skipped.</SupportText>
      <ActionButton kind="primary" label={busy ? 'Planning…' : 'Plan 30 days'} disabled={busy} onPress={() => void (async () => {
        const ok = await dialog.confirm({ title: 'Add about 12 drafts?', message: 'They go on your Social calendar as drafts. You can edit or delete each one.', confirmText: 'Add drafts', cancelText: 'Cancel' });
        if (ok) await run(() => planDays(workspaceId), (r) => void dialog.notify(`${r.created.length} drafts added`, r.note));
      })()} />
    </Card>

    <Card>
      <SectionTitle>New campaign</SectionTitle>
      {migration ? <Banner tone="warning"><SupportText>Campaigns start after a database update ({migration}). The 30-day plan and ideas work now.</SupportText></Banner> : null}
      <TextInput accessibilityLabel="Campaign name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="e.g. Academy January intake" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <View style={styles.chips}>{GOALS.map(([k, l]) => <Chip key={k} label={l} selected={form.goal === k} onPress={() => setForm({ ...form, goal: k })} />)}</View>
      <DateField label="Starts" value={form.startsOn} min={today} onChange={(startsOn) => setForm({ ...form, startsOn })} />
      <DateField label="Ends" value={form.endsOn} min={form.startsOn} onChange={(endsOn) => setForm({ ...form, endsOn })} />
      <TextInput accessibilityLabel="Offer" value={form.offer} onChangeText={(offer) => setForm({ ...form, offer })} placeholder="Offer (optional), e.g. model price ¥30,000" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton kind="primary" label="Create & plan with AngelOS" disabled={busy || !form.name.trim() || Boolean(migration)} onPress={() => void run(async () => {
        const c = await createCampaign(workspaceId, { ...form, name: form.name.trim(), offer: form.offer.trim() || undefined });
        return planCampaign(workspaceId, c.id);
      }, (r) => { setForm({ ...form, name: '', offer: '' }); void dialog.notify(`${r.created.length} post drafts added`, r.lineBroadcast ? 'Plus one LINE broadcast draft (with English meaning). Check the message count before sending.' : (r.lineNote ?? '')); })} />
    </Card>

    {campaigns.length ? <Card>
      <SectionTitle>Your campaigns</SectionTitle>
      {campaigns.map((c) => <View key={c.id} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{c.name}</Text><SupportText>{prettyDay(c.starts_on)} – {prettyDay(c.ends_on)} · {c.post_count} post{c.post_count === 1 ? '' : 's'} · {c.status}</SupportText></View>
        {c.status === 'draft' ? <ActionButton label="Plan" disabled={busy} onPress={() => void run(() => planCampaign(workspaceId, c.id))} /> : <ActionButton kind="quiet" label="Calendar" onPress={() => router.push('/content')} />}
      </View>)}
    </Card> : null}

    <Card>
      <SectionTitle>LINE broadcast draft</SectionTitle>
      <SupportText>AngelOS writes it in friendly Japanese and shows you the English meaning. You see the message count before anything is sent.</SupportText>
      <TextInput accessibilityLabel="What is it about" value={lineTopic} onChangeText={setLineTopic} placeholder="What is it about? e.g. free slots next week" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton label="Write LINE draft" disabled={busy} onPress={() => void run(() => createLineDraft(workspaceId, { topic: lineTopic.trim() || undefined }), (r) => { setLineTopic(''); router.push(`/content/${r.postId}`); })} />
    </Card>

    <Card>
      <SectionTitle>Ideas for you</SectionTitle>
      {!ideas.length ? <SupportText>No ideas yet. Add photos with marketing permission and bookings, and ideas appear here.</SupportText> : null}
      {ideas.map((idea) => <View key={idea.key} style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{idea.title}</Text><SupportText>{idea.angle}{idea.date ? ` · ${prettyDay(idea.date)}` : ''}</SupportText></View>
        <ActionButton label="Make draft" onPress={() => router.push({ pathname: '/content/new', params: { title: idea.title, goal: idea.objective, ...(idea.date && idea.date >= today ? { date: idea.date } : {}) } } as any)} />
      </View>)}
    </Card>

    <Card>
      <SectionTitle>Saved hashtag sets</SectionTitle>
      {sets.map((s) => <View key={s.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{s.name}</Text><SupportText>{s.tags.join(' ')}</SupportText></View><ActionButton kind="quiet" label="Delete" onPress={() => void run(() => deleteHashtagSet(workspaceId, s.id))} /></View>)}
      <TextInput accessibilityLabel="Set name" value={setForm2.name} onChangeText={(name) => setSetForm2({ ...setForm2, name })} placeholder="Set name, e.g. Brows JA" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <TextInput accessibilityLabel="Hashtags" value={setForm2.tags} onChangeText={(tags) => setSetForm2({ ...setForm2, tags })} placeholder="#眉アートメイク #沖縄 #pmu" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton label="Save set" disabled={busy || !setForm2.name.trim() || !setForm2.tags.trim()} onPress={() => void run(() => saveHashtagSet(workspaceId, { name: setForm2.name.trim(), language: /[\u3040-\u30ff\u4e00-\u9faf]/.test(setForm2.tags) ? (/[a-z]/i.test(setForm2.tags) ? 'both' : 'ja') : 'en', tags: setForm2.tags.split(/[\s,、]+/).filter(Boolean) }), () => setSetForm2({ name: '', tags: '' }))} />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 16, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: 12, fontSize: 15, fontFamily: tokens.font.ui },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText }
});
