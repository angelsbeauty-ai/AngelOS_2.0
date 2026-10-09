import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../../src/components/ui';
import { addConsent, addHealthForm, getHealthForms, type HealthQuestion } from '../../../src/lib/clients';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import { dialog } from '../../../src/lib/dialog';

const CONSENTS = [
  { type: 'treatment', en: 'I agree to the treatment and understand the aftercare.', ja: '施術内容とアフターケアについて説明を受け、同意します。' },
  { type: 'photo_video', en: 'Photos may be taken for my client record.', ja: 'カルテ用に写真を撮影することに同意します。' },
  { type: 'marketing', en: 'Photos may be used on social media (face hidden unless I agree).', ja: '写真をSNSで使用することに同意します（顔は許可がない限り隠します）。' }
];

/** Health form (mode default) or consent (mode=consent). Typed name = signature. Hand the phone to the client. */
export default function HealthFormScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<HealthQuestion[]>([]);
  const [needsMigration, setNeedsMigration] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: 'yes' | 'no'; detail?: string }>>({});
  const [consents, setConsents] = useState<Record<string, boolean>>({ treatment: true, photo_video: true, marketing: false });
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const consentMode = mode === 'consent';

  useEffect(() => { void (async () => {
    const wsId = (await getActiveWorkspace()).id; setWorkspaceId(wsId);
    if (!consentMode) { const res = await getHealthForms(wsId, id!); setQuestions(res.questions); setNeedsMigration(res.needsMigration); }
  })().catch(() => undefined); }, [id]);

  async function save() {
    if (!workspaceId || !id || !name.trim()) return;
    setSaving(true);
    try {
      if (consentMode) {
        for (const c of CONSENTS) await addConsent(workspaceId, id, { consentType: c.type, status: consents[c.type] ? 'granted' : 'denied', signedName: name.trim(), formVersion: 'v1', scope: { text_en: c.en } });
      } else {
        await addHealthForm(workspaceId, id, { answers, signedName: name.trim() });
      }
      router.back();
    } catch (e) { void dialog.notify('Could not save', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSaving(false); }
  }

  const unanswered = !consentMode && questions.some((q) => !answers[q.key]);
  return <Screen>
    <ScreenTitle>{consentMode ? 'Consent' : 'Health form'}</ScreenTitle>
    <SupportText>Hand the phone to your client. English is shown for you; the Japanese line is for the client.</SupportText>
    {needsMigration ? <Banner tone="warning">Saving health forms needs the database update {needsMigration} (waiting for Angel's yes).</Banner> : null}
    {consentMode ? CONSENTS.map((c) => <Card key={c.type}>
      <BodyText>{c.ja}</BodyText><SupportText>{c.en}</SupportText>
      <View style={fieldStyles.row}><Chip label="Yes / はい" selected={consents[c.type]} onPress={() => setConsents({ ...consents, [c.type]: true })} /><Chip label="No / いいえ" selected={!consents[c.type]} onPress={() => setConsents({ ...consents, [c.type]: false })} /></View>
    </Card>) : questions.map((q) => <Card key={q.key}>
      <BodyText>{q.ja}</BodyText><SupportText>{q.en}</SupportText>
      <View style={fieldStyles.row}>
        <Chip label="Yes / はい" selected={answers[q.key]?.answer === 'yes'} onPress={() => setAnswers({ ...answers, [q.key]: { ...answers[q.key], answer: 'yes' } })} />
        <Chip label="No / いいえ" selected={answers[q.key]?.answer === 'no'} onPress={() => setAnswers({ ...answers, [q.key]: { answer: 'no' } })} />
        {q.redFlag && answers[q.key]?.answer === 'yes' ? <Text style={{ color: ui.colors.critical, fontWeight: '700' }}>Check before treatment</Text> : null}
      </View>
      {answers[q.key]?.answer === 'yes' ? <Field label="Details / 詳細" value={answers[q.key]?.detail ?? ''} onChangeText={(detail) => setAnswers({ ...answers, [q.key]: { answer: 'yes', detail } })} /> : null}
    </Card>)}
    <Card>
      <SectionTitle>Signature</SectionTitle>
      <Field label="Full name / お名前（フルネーム）" value={name} onChangeText={setName} hint="Typing the name counts as the signature. The date is saved automatically." />
      {unanswered ? <SupportText tone="warning">Answer every question first.</SupportText> : null}
      <ActionButton kind="primary" label={saving ? 'Saving…' : 'Save'} disabled={saving || !name.trim() || unanswered || Boolean(needsMigration)} onPress={() => void save()} />
    </Card>
  </Screen>;
}
