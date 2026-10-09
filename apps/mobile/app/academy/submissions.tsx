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
    <ScreenTitle>Practice photos</ScreenTitle>
    <Tabs value={status} onChange={setStatus} options={[{ id: 'pending', label: 'To review' }, { id: 'approved', label: 'Approved' }, { id: 'try_again', label: 'Try again' }]} />
    {items === null ? <Card><BodyText>Loading…</BodyText></Card> : null}
    {items?.length === 0 ? <Card><BodyText>Nothing here.</BodyText></Card> : null}
    {items?.map((s) => <Card key={s.id}>
      <SectionTitle>{s.lesson?.title ?? 'Lesson'}</SectionTitle>
      <SupportText>{new Date(s.created_at).toLocaleString()}</SupportText>
      {s.photoUrl ? <Image source={{ uri: s.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} resizeMode="cover" accessibilityLabel="Practice photo" /> : null}
      {s.note ? <BodyText>{s.note}</BodyText> : null}
      {s.status === 'pending' ? <>
        <Field label="Comment for the student" value={comments[s.id] ?? ''} onChangeText={(v) => setComments({ ...comments, [s.id]: v })} multiline hint="Needed for Try again." />
        <View style={fieldStyles.row}><ActionButton kind="primary" label="Approve" onPress={() => void review(s.id, 'approved')} /><ActionButton label="Try again" onPress={() => void review(s.id, 'try_again')} /></View>
      </> : s.feedback ? <SupportText>Your comment: {s.feedback}</SupportText> : null}
    </Card>)}
  </Screen>;
}
