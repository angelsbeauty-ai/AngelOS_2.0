import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { Screen } from '../../src/components/Screen';
import { ProgressBar } from '../../src/components/Field';
import { Badge, Button, Card, EmptyState, Header, ListRow, SectionTitle, Skeleton, StatTile, SupportText, TextField, ui } from '../../src/components/ui';
import { ErrorState } from '../../src/components/ErrorState';
import { createCourse, listCourses, type Course } from '../../src/lib/academy';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

/** Owner: courses (lms_* tables) with lesson/student counts + Students / Practice photos. Student: my courses with progress. */
export default function AcademyScreen() {
  const { t } = useTranslation();
  const [ws, setWs] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'student' | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(useCallback(() => { void load(); }, []));
  async function load() {
    try { const w = await getActiveWorkspace(); setWs(w.id); const r = await listCourses(w.id); setRole(r.role); setCourses(r.courses); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : t('acad.unavailable')); setCourses([]); }
  }
  async function add() {
    if (!ws || !title.trim()) return;
    setCreating(true);
    try { const c = await createCourse(ws, { title: title.trim() }); setTitle(''); router.push(`/academy/course/${c.id}` as any); }
    catch (e) { void dialog.notify(t('acad.createFail'), e instanceof Error ? e.message : ''); }
    finally { setCreating(false); }
  }

  const owner = role === 'owner';
  const totalStudents = (courses ?? []).reduce((n, c) => n + (c.students ?? 0), 0);
  return <Screen onRefresh={() => load()}>
    <Header eyebrow={t('acad.eyebrow')} title={t('acad.title')} />
    {error ? <ErrorState title={t('acad.unavailable')} message={error} onRetry={() => void load()} /> : null}
    {courses === null ? <Skeleton rows={3} /> : null}
    {owner && courses?.length ? <View style={styles.tiles}>
      <StatTile label={t('acad.courses')} value={courses.length} />
      <StatTile label={t('acad.students')} value={totalStudents} onPress={() => router.push('/academy/students' as any)} />
    </View> : null}
    {owner ? <View style={styles.row}>
      <Button small variant="secondary" label={t('acad.students')} onPress={() => router.push('/academy/students' as any)} />
      <Button small variant="secondary" label={t('acad.reviews')} onPress={() => router.push('/academy/submissions' as any)} />
    </View> : null}
    {courses?.length === 0 && !error ? <Card><EmptyState icon={<View style={styles.disc}><GraduationCap size={34} color={ui.colors.gold} weight="duotone" /></View>} title={owner ? t('acad.emptyOwner') : t('acad.emptyStudent')} message={owner ? t('acad.emptyOwnerMsg') : t('acad.emptyStudentMsg')} /></Card> : null}
    {courses?.length ? <SectionTitle>{t('acad.courses')}</SectionTitle> : null}
    {courses?.map((c) => <View key={c.id} style={{ gap: 6 }}>
      <ListRow leading={<View style={styles.icon}><GraduationCap size={22} color={ui.colors.gold} weight="duotone" /></View>} title={c.title}
        subtitle={[t('acad.lessons', { count: c.lessonCount }), owner ? t('acad.studentsN', { count: c.students }) : null].filter(Boolean).join(' · ')}
        trailing={owner ? <Badge status={c.published ? 'confirmed' : 'request'} label={c.published ? t('acad.published') : t('acad.draft')} /> : undefined}
        onPress={() => router.push(`/academy/course/${c.id}` as any)} />
      {role === 'student' && c.myProgress != null ? <View style={{ paddingHorizontal: 8, gap: 4 }}><ProgressBar value={c.myProgress} /><SupportText>{t('acad.done', { p: c.myProgress })}</SupportText></View> : null}
    </View>)}
    {owner ? <Card>
      <SectionTitle>{t('acad.newCourse')}</SectionTitle>
      <TextField label={t('acad.courseTitle')} value={title} onChangeText={setTitle} placeholder={t('acad.coursePh')} />
      <Button label={t('acad.create')} loading={creating} disabled={!title.trim()} onPress={() => void add()} />
    </Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: ui.spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ui.spacing.xs },
  disc: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.elevated },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.colors.softGold }
});
