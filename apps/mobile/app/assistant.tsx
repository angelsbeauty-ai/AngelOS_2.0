import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton } from '../src/components/MessagingBits';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../src/components/ui';
import { addAssistantSkill, getAssistantProfile, listAssistantMemory, retireAssistantSkill, type AssistantProfile } from '../src/lib/ai';
import { createAutomationFromTask, listAutomationRules, updateAutomationRule, type AutomationRule } from '../src/lib/automations';
import { dialog } from '../src/lib/dialog';
import { getActiveWorkspace } from '../src/lib/workspace';
import { tokens } from '../src/design/theme';
import { useAppearance } from '../src/design/appearance';
import { useTranslation } from 'react-i18next';
import { friendlyText } from '../src/lib/friendly-error';

/** AngelOS V1: automations are not part of the launch, so the section is hidden (code kept). */
const V1_AUTOMATIONS = false;

const WHEN: Record<string, string> = {
  appointment_confirmed: 'After a booking is confirmed',
  appointment_completed: 'After an appointment is done',
  followup_due: 'When a follow-up is due',
  manual: 'Only when you start it'
};
const TONES: Record<string, string> = { warm_professional: 'Warm & professional', direct: 'Direct', calm: 'Calm', friendly: 'Friendly', custom: 'Custom' };
const PROACTIVE: Record<string, string> = { low: 'Only when asked', balanced: 'Balanced', high: 'Very proactive' };

export default function AssistantWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfile | null>(null);
  const [skills, setSkills] = useState<Array<{ id: string; content: string }>>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [skill, setSkill] = useState('');
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const { t } = useTranslation();
  const { mode } = useAppearance();
  const night = mode === 'night';
  const line = { color: night ? '#F4F4F5' : ui.colors.primaryText };
  const field = night ? { backgroundColor: '#161618', color: '#F4F4F5', borderColor: 'rgba(255,255,255,0.14)' } : null;
  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id;
      setWorkspaceId(ws);
      const [who, memory, automations] = await Promise.all([
        getAssistantProfile(ws),
        listAssistantMemory(ws).catch(() => []),
        V1_AUTOMATIONS ? listAutomationRules(ws).catch(() => [] as AutomationRule[]) : Promise.resolve([] as AutomationRule[])
      ]);
      setProfile(who.profile);
      setSkills(memory.filter((item) => item.category === 'workflow' && item.status === 'approved'));
      setRules(automations);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function addSkill() {
    if (!workspaceId || skill.trim().length < 2) return;
    setBusy(true);
    try { await addAssistantSkill(workspaceId, skill.trim()); setSkill(''); await load(); }
    catch (error) { const f = friendlyText(error, { action: 'save' }, t('asst.addFail', "Could not add that skill")); void dialog.notify(f.title, f.message); }
    finally { setBusy(false); }
  }
  async function addTask() {
    if (!workspaceId || task.trim().length < 4) return;
    setBusy(true);
    try { await createAutomationFromTask(workspaceId, task.trim()); setTask(''); await load(); void dialog.notify(t('asst.saved', "Saved"), t('asst.savedOff', "It is off until you turn it on. Nothing repeats yet.")); }
    catch (error) { const f = friendlyText(error, { action: 'save' }, t('asst.autoFail', "Could not save that automation")); void dialog.notify(f.title, f.message); }
    finally { setBusy(false); }
  }

  return <Screen onRefresh={() => load()}>
    <ScreenTitle>{t('asst.title', "Assistant")}</ScreenTitle>
    {failed ? <Card><SupportText>{t('asst.loadFail', "The assistant settings could not load. Pull to try again, or open the assistant chat from the logo.")}</SupportText><ActionButton kind="primary" label={t('asst.openChat', "Open assistant chat")} onPress={() => router.push('/ai' as any)} /></Card> : null}
    <SupportText>{t('asst.intro', "How your assistant works: personality, rules and skills.")}</SupportText>

    <Card>
      <SectionTitle>{t('asst.personality', "Personality")}</SectionTitle>
      <Text style={[styles.line, line]}>{profile ? `${profile.display_name} · ${t(`asst.tone_${profile.tone}`, TONES[profile.tone] ?? TONES.custom)} · ${t(`asst.pro_${profile.proactivity}`, PROACTIVE[profile.proactivity] ?? PROACTIVE.balanced)}` : t('asst.loading', "Loading\u2026")}</Text>
      <SupportText>{profile?.personality_prompt?.trim() || t('asst.noNote', "No extra personality note yet.")}</SupportText>
      <ActionButton label={t('asst.settings', "AI Assistant settings")} onPress={() => router.push('/ai-settings' as any)} />
    </Card>

    <Card>
      <SectionTitle>{t('asst.instructions', "Instructions")}</SectionTitle>
      <SupportText>{t('asst.i1', "Your assistant helps with the studio: messages, posts, and questions.")}</SupportText>
      <SupportText>{t('asst.i2', "It looks up the real number before it answers. It does not guess.")}</SupportText>
      <SupportText>{t('asst.i3', "In voice it can read unread messages and send a reply after you say yes.")}</SupportText>
    </Card>

    <Card>
      <SectionTitle>{t('asst.rules', "Rules")}</SectionTitle>
      <SupportText>{t('asst.r1', "It does not change settings, the password, billing, or connected apps.")}</SupportText>
      <SupportText>{t('asst.r2', "It does not invent a count, a price, or a client fact.")}</SupportText>
      {V1_AUTOMATIONS ? <SupportText>{t('asst.r3', "A new automation is saved off. Nothing repeats until you turn it on.")}</SupportText> : null}
      <SupportText>{t('asst.r4', "It does not send a client message until you say yes.")}</SupportText>
    </Card>

    <Card>
      <SectionTitle>{t('asst.skills', "Skills")}</SectionTitle>
      <SupportText>{t('asst.s1', "A skill is something your assistant should know how to do. It reads these every time you talk to it.")}</SupportText>
      {skills.length === 0 ? <SupportText>{t('asst.s2', "No skills yet.")}</SupportText> : null}
      {skills.map((item) => <View key={item.id} style={styles.row}>
        <Text style={[styles.line, line]}>{item.content}</Text>
        <ActionButton kind="quiet" label={t('asst.remove', "Remove")} disabled={busy} onPress={() => { if (workspaceId) void retireAssistantSkill(workspaceId, item.id).then(load).catch((error) => { const f = friendlyText(error, { action: 'save' }, t('asst.removeFail', "Could not remove that skill")); void dialog.notify(f.title, f.message); }); }} />
      </View>)}
      <TextInput accessibilityLabel={t('asst.newSkill', "New skill")} value={skill} onChangeText={setSkill} placeholder={t('asst.skillPh', "Example: Reply to unread messages one by one")} placeholderTextColor={night ? '#9A9A9F' : ui.colors.secondaryText} style={[styles.input, field]} />
      <ActionButton kind="primary" label={t('asst.addSkill', "Add skill")} disabled={busy || skill.trim().length < 2} onPress={() => void addSkill()} />
    </Card>

    {V1_AUTOMATIONS ? <Card>
      <SectionTitle>{t('asst.automations', "Automations")}</SectionTitle>
      <SupportText>{t('asst.a1', "Tell it a task that repeats. It is saved off. Turn it on only when you want it to run.")}</SupportText>
      {rules.length === 0 ? <SupportText>{t('asst.a2', "No automations yet.")}</SupportText> : null}
      {rules.map((rule) => <View key={rule.id} style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.line, line]}>{rule.name}</Text>
          <SupportText>{WHEN[rule.trigger_type] ?? WHEN.manual}</SupportText>
        </View>
        <Switch accessibilityLabel={`${rule.name} on`} value={rule.enabled} disabled={busy} onValueChange={(enabled) => { if (workspaceId) void updateAutomationRule(workspaceId, rule.id, { enabled }).then(load).catch((error) => { const f = friendlyText(error, { action: 'save' }, t('asst.updFail', "Could not update that automation")); void dialog.notify(f.title, f.message); }); }} />
      </View>)}
      <TextInput accessibilityLabel={t('asst.repeatTask', "Repeating task")} value={task} onChangeText={setTask} placeholder={t('asst.taskPh', "Example: Every Monday, remind me to plan the week's posts")} placeholderTextColor={night ? '#9A9A9F' : ui.colors.secondaryText} style={[styles.input, field]} />
      <ActionButton kind="primary" label={t('asst.saveAuto', "Save automation, off")} disabled={busy || task.trim().length < 4} onPress={() => void addTask()} />
    </Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  line: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, fontFamily: tokens.font.ui }
});
