import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ActionButton } from '../../../src/components/MessagingBits';
import { Field, ProgressBar, fieldStyles } from '../../../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../../../src/components/ui';
import { addLesson, deleteCourse, getCourse, reorderLessons, updateCourse, type LessonRow } from '../../../src/lib/academy';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import { confirm, dialog } from '../../../src/lib/dialog';

export default function CourseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ws, setWs] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'student'>('student');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [newLesson, setNewLesson] = useState('');

  useFocusEffect(useCallback(() => { void load(); }, [id]));
  async function load() {
    try {
      const w = ws ?? (await getActiveWorkspace()).id; setWs(w);
      const r = await getCourse(w, id!);
      setRole(r.role); setTitle(r.course.title); setDescription(r.course.description ?? ''); setPublished(r.course.published); setLessons(r.lessons); setProgress(r.progress);
    } catch (e) { void dialog.notify('Could not load course', e instanceof Error ? e.message : ''); }
  }
  const run = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { void dialog.notify(label, e instanceof Error ? e.message : ''); } };
  function move(i: number, dir: -1 | 1) {
    if (!lessons || !ws) return;
    const next = [...lessons]; const j = i + dir; if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; setLessons(next);
    void run('Could not reorder', () => reorderLessons(ws, id!, next.map((l) => l.id)));
  }

  if (!lessons || !ws) return <Screen><Card><BodyText>{t('crs.s0')}</BodyText></Card></Screen>;
  if (role === 'student') return <Screen>
    <ScreenTitle>{title}</ScreenTitle>
    {description ? <BodyText>{description}</BodyText> : null}
    <ProgressBar value={progress} /><SupportText>{progress}% done</SupportText>
    {lessons.map((l, i) => <Card key={l.id}><Text style={fieldStyles.strong} onPress={() => router.push(`/academy/lesson/${l.id}` as any)}>{l.done ? '✓ ' : `${i + 1}. `}{l.title}</Text><ActionButton kind="quiet" label={l.done ? 'Open again' : 'Start'} onPress={() => router.push(`/academy/lesson/${l.id}` as any)} /></Card>)}
  </Screen>;

  return <Screen>
    <ScreenTitle>{t('crs.s1')}</ScreenTitle>
    <Card>
      <Field label={t('crs.s6')} value={title} onChangeText={setTitle} />
      <Field label={t('crs.s7')} value={description} onChangeText={setDescription} multiline />
      <View style={fieldStyles.line}><View style={fieldStyles.grow}><BodyText>{t('crs.s2')}</BodyText><SupportText>{t('crs.s3')}</SupportText></View><Switch accessibilityLabel={t('crs.s2')} value={published} onValueChange={(v) => { setPublished(v); void run('Could not update', () => updateCourse(ws, id!, { published: v })); }} /></View>
      <ActionButton kind="primary" label={t('crs.s8')} onPress={() => void run('Could not save', () => updateCourse(ws, id!, { title: title.trim(), description }))} />
    </Card>
    <Card>
      <SectionTitle>{t('crs.s4')}</SectionTitle>
      {!lessons.length ? <SupportText>{t('crs.s5')}</SupportText> : null}
      {lessons.map((l, i) => <View key={l.id} style={fieldStyles.line}>
        <Text style={[fieldStyles.strong, { flex: 1 }]} onPress={() => router.push(`/academy/lesson/${l.id}` as any)}>{i + 1}. {l.title}</Text>
        <ActionButton kind="quiet" label="↑" accessibilityHint="Move up" disabled={i === 0} onPress={() => move(i, -1)} />
        <ActionButton kind="quiet" label="↓" accessibilityHint="Move down" disabled={i === lessons.length - 1} onPress={() => move(i, 1)} />
      </View>)}
      <Field label={t('crs.s9')} value={newLesson} onChangeText={setNewLesson} />
      <ActionButton label={t('crs.s10')} disabled={!newLesson.trim()} onPress={() => void run('Could not add lesson', async () => { const l = await addLesson(ws, id!, { title: newLesson.trim() }); setNewLesson(''); router.push(`/academy/lesson/${l.id}` as any); })} />
    </Card>
    <ActionButton kind="quiet" label={t('crs.s11')} onPress={async () => { if (await confirm({ title: `Delete "${title}"?`, message: t('crs.s12'), confirmText: t('crs.s13'), destructive: true })) { try { await deleteCourse(ws, id!); router.back(); } catch (e) { void dialog.notify('Could not delete', e instanceof Error ? e.message : ''); } } }} />
  </Screen>;
}
