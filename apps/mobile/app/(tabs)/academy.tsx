import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Banner } from '../../src/components/MessagingBits';
import { Field, ProgressBar, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { createCourse, listCourses, type Course } from '../../src/lib/academy';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

export default function AcademyScreen() {
  const [ws, setWs] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'student' | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useFocusEffect(useCallback(() => { void load(); }, []));
  async function load() {
    try { const w = await getActiveWorkspace(); setWs(w.id); const r = await listCourses(w.id); setRole(r.role); setCourses(r.courses); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Academy is not available right now.'); setCourses([]); }
  }
  async function add() {
    if (!ws || !title.trim()) return;
    try { const c = await createCourse(ws, { title: title.trim() }); setTitle(''); router.push(`/academy/course/${c.id}` as any); }
    catch (e) { void dialog.notify('Could not create course', e instanceof Error ? e.message : ''); }
  }

  return <Screen>
    <ScreenTitle>Academy</ScreenTitle>
    {error ? <Banner tone="warning">{error}</Banner> : null}
    {role === 'owner' ? <View style={fieldStyles.row}>
      <ActionButton label="Students" onPress={() => router.push('/academy/students' as any)} />
      <ActionButton label="Practice photos to review" onPress={() => router.push('/academy/submissions' as any)} />
    </View> : null}
    {courses === null ? <Card><BodyText>Loading…</BodyText></Card> : null}
    {courses?.length === 0 && !error ? <Card><BodyText>{role === 'student' ? 'No courses yet. Your teacher will add you to a course.' : 'No courses yet. Create your first course below.'}</BodyText></Card> : null}
    {courses?.map((c) => <Card key={c.id}>
      <Text style={fieldStyles.strong} onPress={() => router.push(`/academy/course/${c.id}` as any)}>{c.title}</Text>
      {c.description ? <SupportText>{c.description}</SupportText> : null}
      <View style={fieldStyles.row}>
        <SupportText>{c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}</SupportText>
        {role === 'owner' ? <><SupportText>· {c.students} student{c.students === 1 ? '' : 's'}</SupportText>{c.published ? <Pill tone="success">Published</Pill> : <Pill>Draft</Pill>}</> : null}
      </View>
      {role === 'student' && c.myProgress != null ? <><ProgressBar value={c.myProgress} /><SupportText>{c.myProgress}% done</SupportText></> : null}
      <ActionButton kind="quiet" label="Open" onPress={() => router.push(`/academy/course/${c.id}` as any)} />
    </Card>)}
    {role === 'owner' ? <Card>
      <SectionTitle>New course</SectionTitle>
      <Field label="Course title" value={title} onChangeText={setTitle} placeholder="e.g. Powder brows basics" />
      <ActionButton kind="primary" label="Create course" disabled={!title.trim()} onPress={() => void add()} />
    </Card> : null}
  </Screen>;
}
