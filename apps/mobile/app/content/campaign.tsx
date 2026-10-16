import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Button, Skeleton, SupportText } from '../../src/components/ui';
import { DateField, addDayString, dayString } from '../../src/components/DateField';
import { ROSE } from '../../src/components/SettingsList';
import { createCampaign, listCampaigns, listIdeas, planCampaign, type ContentIdea } from '../../src/lib/content';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';
import { tokens } from '../../src/design/theme';

const GOALS = ['bookings', 'touch_ups', 'trust', 'reach', 'academy_students'] as const;

/** S7 Plan campaign: uses the existing campaigns API (create → plan). Drafts only; nothing posts. */
export default function PlanCampaign() {
  const { t } = useTranslation();
  const today = dayString(new Date());
  const [ws, setWs] = useState<string | null>(null);
  const [migration, setMigration] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [f, setF] = useState({ name: '', goal: 'bookings', startsOn: addDayString(today, 1), endsOn: addDayString(today, 14), offer: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => {
    const w = await getActiveWorkspace(); setWs(w.id);
    void listCampaigns(w.id).then((c) => setMigration(c.needsMigration)).catch(() => undefined);
    setIdeas((await listIdeas(w.id).catch(() => ({ ideas: [] }))).ideas);
  })().catch(() => setIdeas([])); }, []);

  async function create() {
    if (!ws || !f.name.trim()) return;
    setBusy(true);
    try {
      const c = await createCampaign(ws, { ...f, name: f.name.trim(), offer: f.offer.trim() || undefined });
      const r = await planCampaign(ws, c.id);
      await dialog.notify(t('s3.cCreated', { count: r.created.length }), t('s3.cCreatedMsg'));
      router.replace({ pathname: '/social', params: { view: 'drafts' } });
    } catch (e) { await dialog.notify(t('s3.cFail'), e instanceof Error ? e.message : ''); }
    finally { setBusy(false); }
  }

  return <Screen hideAsk>
    <View style={styles.card}>
      <Text style={styles.label}>{t('s3.cName')}</Text>
      <TextInput value={f.name} onChangeText={(name) => setF({ ...f, name })} placeholder={t('s3.cNamePh')} placeholderTextColor="#8E8E8E" style={styles.input} accessibilityLabel={t('s3.cName')} />
      <Text style={styles.label}>{t('s3.cGoal')}</Text>
      <View style={styles.chips}>{GOALS.map((g) => <Pressable key={g} accessibilityRole="button" accessibilityState={{ selected: f.goal === g }} onPress={() => setF({ ...f, goal: g })} style={[styles.pill, f.goal === g && styles.pillOn]}><Text style={[styles.pillText, f.goal === g && { color: '#FFF' }]}>{t(`s3.goal.${g}`)}</Text></Pressable>)}</View>
      <DateField label={t('s3.cStart')} value={f.startsOn} min={today} onChange={(startsOn) => setF({ ...f, startsOn })} />
      <DateField label={t('s3.cEnd')} value={f.endsOn} min={f.startsOn} onChange={(endsOn) => setF({ ...f, endsOn })} />
      <Text style={styles.label}>{t('s3.cOffer')}</Text>
      <TextInput value={f.offer} onChangeText={(offer) => setF({ ...f, offer })} placeholder={t('s3.cOfferPh')} placeholderTextColor="#8E8E8E" style={styles.input} accessibilityLabel={t('s3.cOffer')} />
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>{t('s3.cIdeas')}</Text>
      {ideas === null ? <Skeleton rows={2} height={48} /> : ideas.length ? ideas.slice(0, 6).map((i) => <View key={i.key} style={styles.idea}><Text style={styles.ideaTitle}>{i.title}</Text><SupportText>{i.angle}</SupportText></View>) : <SupportText>{t('s3.cNoIdeas')}</SupportText>}
    </View>
    {migration ? <SupportText>{t('s3.cMigration')}</SupportText> : null}
    <Button label={t('s3.cCreate')} loading={busy} disabled={busy || !f.name.trim() || Boolean(migration)} onPress={() => void create()} />
  </Screen>;
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F2F2F2' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#6B645B' },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(42,39,37,0.12)', backgroundColor: '#FFF', paddingHorizontal: 14, fontSize: 16, color: '#151515', fontFamily: tokens.font.ui },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,39,37,0.12)' },
  pillOn: { backgroundColor: ROSE, borderColor: ROSE },
  pillText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  idea: { gap: 2, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDED' },
  ideaTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#151515' }
});
