import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton } from '../../src/components/MessagingBits';
import { Field, Tabs, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { listSubmissions, reviewSubmission, type Submission } from '../../src/lib/academy';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

type Status = 'pending' | 'approved' | 'try_again';

export default function SubmissionsScreen() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [items, setItems] = useState<Submission[] | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => { void load(status); }, [status]));
  async function load(s: Status) {
    try { const w = ws ?? (await getActiveWorkspace()).id; setWs(w); setItems(await listSubmissions(w, s)); }
    catch (e) { setItems([]); void dialog.notify('Could not load', e instanceof Error ? e.message : ''); }
  }
  async function review(id: string, next: 'approved' | 'try_again') {
    if (!ws) return;
    try { await reviewSubmission(ws, id, { status: next, feedback: comments[id]?.trim() || undefined }); await load(status); }
    catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : ''); }
  }
  return <Screen onRefresh={() => load(status)}>
    <ScreenTitle>{t('subm.s0')}</ScreenTitle>
    <Tabs value={status} onChange={setStatus} options={[{ id: 'pending', label: t('subm.s8') }, { id: 'approved', label: t('subm.s9') }, { id: 'try_again', label: t('subm.s7') }]} />
    {items === null ? <Card><BodyText>{t('subm.s1')}</BodyText></Card> : null}
    {items?.length === 0 ? <Card><BodyText>{t('subm.s2')}</BodyText></Card> : null}
    {items?.map((s) => <Card key={s.id}>
      <SectionTitle>{s.lesson?.title ?? 'Lesson'}</SectionTitle>
      <SupportText>{new Date(s.created_at).toLocaleString()}</SupportText>
      {s.photoUrl ? <Image source={{ uri: s.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} resizeMode="cover" accessibilityLabel={t('subm.s3')} /> : null}
      {s.note ? <BodyText>{s.note}</BodyText> : null}
      {s.status === 'pending' ? <>
        <Field label={t('subm.s4')} value={comments[s.id] ?? ''} onChangeText={(v) => setComments({ ...comments, [s.id]: v })} multiline hint={t('subm.s5')} />
        <View style={fieldStyles.row}><ActionButton kind="primary" label={t('subm.s6')} onPress={() => void review(s.id, 'approved')} /><ActionButton label={t('subm.s7')} onPress={() => void review(s.id, 'try_again')} /></View>
      </> : s.feedback ? <SupportText>Your comment: {s.feedback}</SupportText> : null}
    </Card>)}
  </Screen>;
}
