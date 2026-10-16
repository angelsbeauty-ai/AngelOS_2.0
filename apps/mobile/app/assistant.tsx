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

const WHEN: Record<string, string> = {
  appointment_confirmed: 'After a booking is confirmed',
  appointment_completed: 'After an appointment is done',
  followup_due: 'When a follow-up is due',
  manual: 'Only when you start it'
};

export default function AssistantWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfile | null>(null);
  const [skills, setSkills] = useState<Array<{ id: string; content: string }>>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [skill, setSkill] = useState('');
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const ws = (await getActiveWorkspace()).id;
    setWorkspaceId(ws);
    const [who, memory, automations] = await Promise.all([
      getAssistantProfile(ws),
      listAssistantMemory(ws).catch(() => []),
      listAutomationRules(ws).catch(() => [] as AutomationRule[])
    ]);
    setProfile(who.profile);
    setSkills(memory.filter((item) => item.category === 'workflow' && item.status === 'approved'));
    setRules(automations);
  }, []);
  useFocusEffect(useCallback(() => { void load().catch((error) => void dialog.notify('Could not open the assistant', error instanceof Error ? error.message : '')); }, [load]));

  async function addSkill() {
    if (!workspaceId || skill.trim().length < 2) return;
    setBusy(true);
    try { await addAssistantSkill(workspaceId, skill.trim()); setSkill(''); await load(); }
    catch (error) { void dialog.notify('Could not add that skill', error instanceof Error ? error.message : ''); }
    finally { setBusy(false); }
  }
  async function addTask() {
    if (!workspaceId || task.trim().length < 4) return;
    setBusy(true);
    try { await createAutomationFromTask(workspaceId, task.trim()); setTask(''); await load(); void dialog.notify('Saved', 'It is off until you turn it on. Nothing repeats yet.'); }
    catch (error) { void dialog.notify('Could not save that automation', error instanceof Error ? error.message : ''); }
    finally { setBusy(false); }
  }

  return <Screen onRefresh={() => load()}>
    <ScreenTitle>{profile?.display_name ?? 'Assistant'}</ScreenTitle>
    <SupportText>This is her workspace. Personality, rules, skills, and the repeating tasks she can keep.</SupportText>

    <Card>
      <SectionTitle>Personality</SectionTitle>
      <Text style={styles.line}>{profile ? `${profile.display_name} · ${profile.tone.replaceAll('_', ' ')} · ${profile.proactivity}` : 'Loading…'}</Text>
      <SupportText>{profile?.personality_prompt?.trim() || 'No extra personality note yet.'}</SupportText>
      <ActionButton label="Edit personality and reply style" onPress={() => router.push('/ai-settings' as any)} />
    </Card>

    <Card>
      <SectionTitle>Instructions</SectionTitle>
      <SupportText>She helps with the studio: bookings, messages, posts, and questions.</SupportText>
      <SupportText>She looks up the real number before she answers. She does not guess.</SupportText>
      <SupportText>In voice she can read unread messages and send a reply after you say yes.</SupportText>
    </Card>

    <Card>
      <SectionTitle>Rules</SectionTitle>
      <SupportText>She does not change settings, the password, billing, or connected apps.</SupportText>
      <SupportText>She does not invent a count, a price, or a client fact.</SupportText>
      <SupportText>A new automation is saved off. Nothing repeats until you turn it on.</SupportText>
      <SupportText>She does not send a client message until you say yes.</SupportText>
    </Card>

    <Card>
      <SectionTitle>Skills</SectionTitle>
      <SupportText>A skill is something she should know how to do. She reads these every time you talk to her.</SupportText>
      {skills.length === 0 ? <SupportText>No skills yet.</SupportText> : null}
      {skills.map((item) => <View key={item.id} style={styles.row}>
        <Text style={styles.line}>{item.content}</Text>
        <ActionButton kind="quiet" label="Remove" disabled={busy} onPress={() => { if (workspaceId) void retireAssistantSkill(workspaceId, item.id).then(load).catch((error) => void dialog.notify('Could not remove that skill', error instanceof Error ? error.message : '')); }} />
      </View>)}
      <TextInput accessibilityLabel="New skill" value={skill} onChangeText={setSkill} placeholder="Example: Reply to unread messages one by one" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton kind="primary" label="Add skill" disabled={busy || skill.trim().length < 2} onPress={() => void addSkill()} />
    </Card>

    <Card>
      <SectionTitle>Automations</SectionTitle>
      <SupportText>Tell her a task that repeats. It is saved off. Turn it on only when you want it to run. She can also make one from chat after you approve the card.</SupportText>
      {rules.length === 0 ? <SupportText>No automations yet.</SupportText> : null}
      {rules.map((rule) => <View key={rule.id} style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.line}>{rule.name}</Text>
          <SupportText>{WHEN[rule.trigger_type] ?? rule.trigger_type}</SupportText>
        </View>
        <Switch accessibilityLabel={`${rule.name} on`} value={rule.enabled} disabled={busy} onValueChange={(enabled) => { if (workspaceId) void updateAutomationRule(workspaceId, rule.id, { enabled }).then(load).catch((error) => void dialog.notify('Could not update that automation', error instanceof Error ? error.message : '')); }} />
      </View>)}
      <TextInput accessibilityLabel="Repeating task" value={task} onChangeText={setTask} placeholder="Example: Remind me the day before each booking" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <ActionButton kind="primary" label="Save automation, off" disabled={busy || task.trim().length < 4} onPress={() => void addTask()} />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  line: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, fontFamily: tokens.font.ui }
});
