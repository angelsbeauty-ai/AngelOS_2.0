import { useCallback, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ActionButton, Chip } from '../../src/components/MessagingBits';
import { ProgressBar, fieldStyles } from '../../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { createStudentInvite, enrollStudent, inviteLink, listStudents, type Student } from '../../src/lib/academy';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { dialog } from '../../src/lib/dialog';

export default function StudentsScreen() {
  const [ws, setWs] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [link, setLink] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { void load(); }, []));
  async function load() {
    try { const w = ws ?? (await getActiveWorkspace()).id; setWs(w); const r = await listStudents(w); setStudents(r.students); setCourses(r.courses); }
    catch (e) { setStudents([]); void dialog.notify('Could not load students', e instanceof Error ? e.message : ''); }
  }
  async function invite() {
    if (!ws) return;
    try {
      const r = await createStudentInvite(ws); const url = inviteLink(r.code); setLink(url);
      const nav: any = Platform.OS === 'web' ? (globalThis as any).navigator : null;
      if (nav?.share) await nav.share({ title: 'Join my Academy on AngelOS', url }).catch(() => undefined);
      else if (nav?.clipboard) { await nav.clipboard.writeText(url).catch(() => undefined); void dialog.notify('Link copied', 'Send it to your student. It works once and expires in 30 days.'); }
      else await Share.share({ message: url });
    } catch (e) { void dialog.notify('Could not make an invite', e instanceof Error ? e.message : ''); }
  }

  return <Screen onRefresh={() => load()}>
    <ScreenTitle>Students</ScreenTitle>
    <Card>
      <SectionTitle>Invite a student</SectionTitle>
      <SupportText>The link adds them to your studio as a student. Students only see the Academy, never your clients, bookings or money.</SupportText>
      <ActionButton kind="primary" label="Make invite link" onPress={() => void invite()} />
      {link ? <Text selectable style={{ fontSize: 13 }}>{link}</Text> : null}
    </Card>
    {students === null ? <Card><BodyText>Loading…</BodyText></Card> : null}
    {students?.length === 0 ? <Card><BodyText>No students yet.</BodyText></Card> : null}
    {students?.map((s) => <Card key={s.userId}>
      <Text style={fieldStyles.strong}>{s.name}</Text>
      {s.email ? <SupportText>{s.email}</SupportText> : null}
      {s.courses.map((c) => <View key={c.courseId} style={{ gap: 4 }}><SupportText>{c.title} · {c.progress}%</SupportText><ProgressBar value={c.progress} /></View>)}
      <SupportText>Courses (tap to add or remove):</SupportText>
      <View style={fieldStyles.row}>{courses.map((c) => { const on = s.courses.some((x) => x.courseId === c.id); return <Chip key={c.id} label={c.title} selected={on} onPress={() => { if (ws) void enrollStudent(ws, c.id, s.userId, on).then(load).catch((e) => void dialog.notify('Could not update', e instanceof Error ? e.message : '')); }} />; })}</View>
    </Card>)}
  </Screen>;
}
