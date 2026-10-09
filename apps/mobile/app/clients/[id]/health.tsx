import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ActionButton, Banner, Chip } from '../../../src/components/MessagingBits';
import { Field, fieldStyles } from '../../../src/components/Field';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../../src/components/ui';
import { addConsent, addHealthForm, getHealthForms, type HealthQuestion } from '../../../src/lib/clients';
import { getActiveWorkspace } from '../../../src/lib/workspace';
import i18n from '../../../src/i18n';
import { dialog } from '../../../src/lib/dialog';

const CONSENTS = [
  { type: 'treatment', k: 'hf.cTreat' },
  { type: 'photo_video', k: 'hf.cPhoto' },
  { type: 'marketing', k: 'hf.cMkt' }
];

/** Health form (mode default) or consent (mode=consent). Typed name = signature. Hand the phone to the client. */
export default function HealthFormScreen() {
  const { t } = useTranslation();
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
        for (const c of CONSENTS) await addConsent(workspaceId, id, { consentType: c.type, status: consents[c.type] ? 'granted' : 'denied', signedName: name.trim(), formVersion: 'v1', scope: { text_en: i18n.t(c.k, { lng: 'en' }) } });
      } else {
        await addHealthForm(workspaceId, id, { answers, signedName: name.trim() });
      }
      router.back();
    } catch (e) { void dialog.notify(t('cf.saveFail'), e instanceof Error ? e.message : t('cf.tryAgain')); }
    finally { setSaving(false); }
  }

  const unanswered = !consentMode && questions.some((q) => !answers[q.key]);
  return <Screen>
    <ScreenTitle>{consentMode ? t('hf.consent') : t('hf.health')}</ScreenTitle>
    <SupportText>{t('hf.hand')}</SupportText>
    {needsMigration ? <Banner tone="warning">{t('hf.needsMig', { m: needsMigration })}</Banner> : null}
    {consentMode ? CONSENTS.map((c) => <Card key={c.type}>
      <BodyText>{i18n.t(c.k, { lng: 'ja' })}</BodyText><SupportText>{i18n.t(c.k, { lng: 'en' })}</SupportText>
      <View style={fieldStyles.row}><Chip label={t('hf.yes')} selected={consents[c.type]} onPress={() => setConsents({ ...consents, [c.type]: true })} /><Chip label={t('hf.no')} selected={!consents[c.type]} onPress={() => setConsents({ ...consents, [c.type]: false })} /></View>
    </Card>) : questions.map((q) => <Card key={q.key}>
      <BodyText>{q.ja}</BodyText><SupportText>{q.en}</SupportText>
      <View style={fieldStyles.row}>
        <Chip label={t('hf.yes')} selected={answers[q.key]?.answer === 'yes'} onPress={() => setAnswers({ ...answers, [q.key]: { ...answers[q.key], answer: 'yes' } })} />
        <Chip label={t('hf.no')} selected={answers[q.key]?.answer === 'no'} onPress={() => setAnswers({ ...answers, [q.key]: { answer: 'no' } })} />
        {q.redFlag && answers[q.key]?.answer === 'yes' ? <Text style={{ color: ui.colors.critical, fontWeight: '700' }}>{t('hf.check')}</Text> : null}
      </View>
      {answers[q.key]?.answer === 'yes' ? <Field label={t('hf.details')} value={answers[q.key]?.detail ?? ''} onChangeText={(detail) => setAnswers({ ...answers, [q.key]: { answer: 'yes', detail } })} /> : null}
    </Card>)}
    <Card>
      <SectionTitle>{t('hf.sig')}</SectionTitle>
      <Field label={t('hf.fullName')} value={name} onChangeText={setName} hint={t('hf.sigHint')} />
      {unanswered ? <SupportText tone="warning">{t('hf.answerAll')}</SupportText> : null}
      <ActionButton kind="primary" label={saving ? t('cf.saving') : t('cf.save')} disabled={saving || !name.trim() || unanswered || Boolean(needsMigration)} onPress={() => void save()} />
    </Card>
  </Screen>;
}
