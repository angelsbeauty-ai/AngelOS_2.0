import { createElement, useCallback, useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../../src/components/Screen';
import { ActionButton, Banner } from '../../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../../src/components/Field';
import { BodyText, Card, Pill, ScreenTitle, SectionTitle, SupportText } from '../../../src/components/ui';
import { deleteLesson, getLesson, saveProgress, submitPractice, updateLesson } from '../../../src/lib/academy';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import { confirm, dialog } from '../../../src/lib/dialog';

type Data = Awaited<ReturnType<typeof getLesson>>;

function Video({ video, url }: { video: Data['video']; url: string | null }) {
  if (video.kind === 'none' || !url) return null;
  if (Platform.OS === 'web' && video.embedUrl && (video.kind === 'youtube' || video.kind === 'vimeo')) return createElement('iframe', { src: video.embedUrl, title: 'Lesson video', allow: 'encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true, style: { width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12 } });
  if (Platform.OS === 'web' && video.kind === 'file') return createElement('video', { src: video.embedUrl, controls: true, playsInline: true, style: { width: '100%', borderRadius: 12 } });
  return <ActionButton label="Watch the video" onPress={() => void Linking.openURL(url)} />;
}

async function pickPhotoBase64(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = () => { const file = input.files?.[0]; if (!file) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsDataURL(file); };
      input.click();
    });
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
  return res.canceled || !res.assets?.[0]?.base64 ? null : res.assets[0].base64;
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ws, setWs] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [edit, setEdit] = useState<{ title: string; body: string; videoUrl: string; checklist: string } | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(useCallback(() => { void load(); }, [id]));
  async function load() {
    try {
      const w = ws ?? (await getActiveWorkspace()).id; setWs(w);
      const d = await getLesson(w, id!); setData(d);
      if (d.role === 'owner') setEdit({ title: d.lesson.title, body: d.lesson.body ?? '', videoUrl: d.lesson.video_url ?? '', checklist: (d.lesson.checklist ?? []).join('\n') });
    } catch (e) { void dialog.notify('Could not load lesson', e instanceof Error ? e.message : ''); }
  }
  const run = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { void dialog.notify(label, e instanceof Error ? e.message : ''); } };

  if (!data || !ws) return <Screen><Card><BodyText>Loading…</BodyText></Card></Screen>;
  const { lesson, progress } = data;
  const doneItems = new Set(progress.checklist_done ?? []);

  if (data.role === 'owner' && edit) return <Screen>
    <ScreenTitle>Edit lesson</ScreenTitle>
    <Card>
      <Field label="Title" value={edit.title} onChangeText={(title) => setEdit({ ...edit, title })} />
      <Field label="Video link (https)" value={edit.videoUrl} onChangeText={(videoUrl) => setEdit({ ...edit, videoUrl })} autoCapitalize="none" placeholder="YouTube, Vimeo or a video file link" />
      <Field label="Lesson text" value={edit.body} onChangeText={(body) => setEdit({ ...edit, body })} multiline style={{ minHeight: 160 }} />
      <Field label="Checklist (one step per line)" value={edit.checklist} onChangeText={(checklist) => setEdit({ ...edit, checklist })} multiline />
      <ActionButton kind="primary" label="Save" onPress={() => void run('Could not save', () => updateLesson(ws, id!, { title: edit.title.trim(), body: edit.body, videoUrl: edit.videoUrl.trim() || null, checklist: edit.checklist.split('\n').map((s) => s.trim()).filter(Boolean) }))} />
    </Card>
    <Card><SectionTitle>Preview</SectionTitle><Video video={data.video} url={lesson.video_url} />{lesson.body ? <BodyText>{lesson.body}</BodyText> : null}</Card>
    <ActionButton kind="quiet" label="Delete lesson" onPress={async () => { if (await confirm({ title: `Delete "${lesson.title}"?`, message: 'Student progress and practice photos for it are deleted too.', confirmText: 'Delete', destructive: true })) { try { await deleteLesson(ws, id!); router.back(); } catch (e) { void dialog.notify('Could not delete', e instanceof Error ? e.message : ''); } } }} />
  </Screen>;

  return <Screen>
    <ScreenTitle>{lesson.title}</ScreenTitle>
    <Video video={data.video} url={lesson.video_url} />
    {lesson.body ? <Card><BodyText>{lesson.body}</BodyText></Card> : null}
    {lesson.checklist?.length ? <Card>
      <SectionTitle>Checklist</SectionTitle>
      {lesson.checklist.map((item, i) => <View key={i} style={fieldStyles.line}><Text style={{ flex: 1 }}>{item}</Text><Switch accessibilityLabel={item} value={doneItems.has(i)} onValueChange={(v) => { const next = new Set(doneItems); if (v) next.add(i); else next.delete(i); void run('Could not save', () => saveProgress(ws, id!, { checklistDone: Array.from(next) })); }} /></View>)}
    </Card> : null}
    <ActionButton kind={progress.done_at ? 'secondary' : 'primary'} label={progress.done_at ? '✓ Done (tap to undo)' : 'Mark lesson done'} onPress={() => void run('Could not save', () => saveProgress(ws, id!, { done: !progress.done_at }))} />
    <Card>
      <SectionTitle>Send practice photo</SectionTitle>
      <SupportText>Your teacher reviews it and replies here.</SupportText>
      <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
      <ActionButton kind="primary" label={sending ? 'Sending…' : 'Choose photo and send'} disabled={sending} onPress={async () => {
        const photo = await pickPhotoBase64(); if (!photo && !note.trim()) return;
        setSending(true); await run('Could not send', async () => { await submitPractice(ws, id!, { photoBase64: photo ?? undefined, note: note.trim() || undefined }); setNote(''); }); setSending(false);
      }} />
      {data.submissions.map((s) => <View key={s.id} style={fieldStyles.line}>
        <View style={fieldStyles.grow}><SupportText>{new Date(s.created_at).toLocaleDateString()}{s.note ? ` · ${s.note}` : ''}</SupportText>{s.feedback ? <BodyText>Teacher: {s.feedback}</BodyText> : null}</View>
        <Pill tone={s.status === 'approved' ? 'success' : s.status === 'try_again' ? 'warning' : 'secondary'}>{s.status === 'try_again' ? 'Try again' : s.status === 'approved' ? 'Approved' : 'Waiting'}</Pill>
      </View>)}
    </Card>
    {data.role === 'owner' ? <Banner>This is the student view.</Banner> : null}
  </Screen>;
}
