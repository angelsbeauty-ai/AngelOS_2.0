import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ErrorState } from '../src/components/ErrorState';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../src/components/ui';
import { ActionButton, Banner, BilingualBlock, Chip } from '../src/components/MessagingBits';
import { dialog } from '../src/lib/dialog';
import { toFriendly } from '../src/lib/friendly-error';
import {
  approveSuggestedReply, getAssistantProfile, getReplyStyle, learnReplyStyleNow, listSuggestedReplies, rejectSuggestedReply,
  updateAssistantProfile, updateAssistantRoles, updateReplyStyle, type AssistantProfile, type AssistantRole, type AssistantRoleKey, type ReplyStyle
} from '../src/lib/ai';
import { translateText, type SavedReply } from '../src/lib/messaging';
import { getActiveWorkspace } from '../src/lib/workspace';
import { tokens } from '../src/design/theme';

const ROLE_COPY: Array<{ key: AssistantRoleKey; label: string; description: string }> = [
  { key: 'personal_assistant', label: 'Personal assistant', description: 'Organises your day and priorities.' },
  { key: 'social_media_marketer', label: 'Social media marketer', description: 'What to post and when.' },
  { key: 'content_creator', label: 'Content creator', description: 'Captions, Reels and Stories.' },
  { key: 'business_manager', label: 'Business manager', description: 'Clients, bookings and follow-ups.' },
  { key: 'business_advisor', label: 'Business advisor', description: 'Offers, prices and growth.' },
  { key: 'consultant', label: 'Consultant', description: 'Bigger decisions and trade-offs.' }
];
const OWNER_TONES = [['warm_professional', 'Warm & professional'], ['friendly', 'Friendly'], ['calm', 'Calm'], ['direct', 'Direct']] as const;
const REPLY_TONES = [['casual_friendly', 'Casual & friendly'], ['warm_polite', 'Warm & polite'], ['professional', 'Professional'], ['playful', 'Playful']] as const;
const EMOJI = [['none', 'No emoji'], ['light', 'A little ✨'], ['lots', 'Lots 🌸']] as const;
const LENGTH = [['short', 'Short'], ['medium', 'Medium'], ['detailed', 'Detailed']] as const;
const FORMALITY: Record<string, string> = { casual: 'casual', polite: 'polite', formal: 'formal' };

export default function AiSettingsScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfile | null>(null);
  const [roles, setRoles] = useState<AssistantRole[]>([]);
  const [style, setStyle] = useState<ReplyStyle | null>(null);
  const [styleMigration, setStyleMigration] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SavedReply[]>([]);
  const [notes, setNotes] = useState('');
  const [personality, setPersonality] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string; bodyEn: string; bodyJa: string; checkedJa?: string } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws);
      const [data, styleResult, suggestions] = await Promise.all([
        getAssistantProfile(ws), getReplyStyle(ws).catch(() => null), listSuggestedReplies(ws).catch(() => ({ replies: [], needsMigration: null }))
      ]);
      setProfile(data.profile); setRoles(data.roles); setName(data.profile.display_name); setPersonality(data.profile.personality_prompt ?? '');
      if (styleResult) { setStyle(styleResult.style); setStyleMigration(styleResult.needsMigration); setNotes(styleResult.style.style_notes ?? ''); }
      setSuggested(suggestions.replies);
      setState('ready');
    } catch { setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.role_key, role.enabled])), [roles]);

  async function act<T>(task: () => Promise<T>, after?: (value: T) => void) {
    setBusy(true);
    try { const value = await task(); after?.(value); }
    catch (error) { const f = toFriendly(error, { action: 'save' }); void dialog.notify(f.title, error instanceof Error && error.message ? error.message : f.message); }
    finally { setBusy(false); }
  }
  const saveProfile = (patch: Record<string, unknown>) => workspaceId && act(() => updateAssistantProfile(workspaceId, patch), setProfile);
  const saveStyle = (patch: Record<string, unknown>) => workspaceId && act(() => updateReplyStyle(workspaceId, patch), setStyle);

  if (state === 'error') return <Screen><ErrorState title="We couldn't load assistant settings" message="Check your connection and try again." onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!profile || !workspaceId) return <Screen><Card><SupportText>Loading assistant settings…</SupportText></Card></Screen>;
  const learned = style?.learned ?? {};

  return <Screen>
    <ScreenTitle>Assistant settings</ScreenTitle>
    <SupportText>How AngelOS talks to you, and how it writes to your clients.</SupportText>

    <Card premium>
      <SectionTitle>Your assistant</SectionTitle>
      <Text style={styles.label}>Name</Text>
      <TextInput accessibilityLabel="Assistant name" value={name} onChangeText={setName} onBlur={() => { if (name.trim() && name.trim() !== profile.display_name) void saveProfile({ displayName: name.trim() }); }} style={styles.input} />
      <Text style={styles.label}>How it talks to you</Text>
      <View style={styles.chips}>{OWNER_TONES.map(([key, label]) => <Chip key={key} label={label} selected={profile.tone === key} onPress={() => void saveProfile({ tone: key })} />)}</View>
      <Text style={styles.label}>Personality (optional)</Text>
      <TextInput accessibilityLabel="Assistant personality" value={personality} onChangeText={setPersonality} multiline placeholder="Warm, calm, short answers." placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      {personality !== (profile.personality_prompt ?? '') ? <ActionButton label="Save personality" disabled={busy} onPress={() => void saveProfile({ personalityPrompt: personality.trim() })} /> : null}
      <Text style={styles.label}>How much should it lead?</Text>
      <View style={styles.chips}>{(['low', 'balanced', 'high'] as const).map((value) => <Chip key={value} label={value === 'low' ? 'Only when asked' : value === 'balanced' ? 'Balanced' : 'Very proactive'} selected={profile.proactivity === value} onPress={() => void saveProfile({ proactivity: value })} />)}</View>
    </Card>

    <Card>
      <SectionTitle>Replies to clients</SectionTitle>
      <SupportText>Used for every AI reply draft. Japanese drafts stay in a friendly salon tone and never mix in English.</SupportText>
      {styleMigration ? <Banner tone="warning"><SupportText tone="warning">These settings need the database update {styleMigration}. It is waiting for your yes. Until then drafts use "Casual & friendly".</SupportText></Banner> : null}
      <Text style={styles.label}>Tone</Text>
      <View style={styles.chips}>{REPLY_TONES.map(([key, label]) => <Chip key={key} label={label} selected={style?.reply_tone === key} onPress={() => void saveStyle({ replyTone: key })} />)}</View>
      <Text style={styles.label}>Emoji</Text>
      <View style={styles.chips}>{EMOJI.map(([key, label]) => <Chip key={key} label={label} selected={style?.emoji_level === key} onPress={() => void saveStyle({ emojiLevel: key })} />)}</View>
      <Text style={styles.label}>Length</Text>
      <View style={styles.chips}>{LENGTH.map(([key, label]) => <Chip key={key} label={label} selected={style?.reply_length === key} onPress={() => void saveStyle({ replyLength: key })} />)}</View>
      <Text style={styles.label}>Style notes</Text>
      <TextInput accessibilityLabel="Style notes" value={notes} onChangeText={setNotes} multiline placeholder='e.g. "Always thank them for choosing Angels Beauty. Never use 様, use さん."' placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      {notes !== (style?.style_notes ?? '') ? <ActionButton label="Save notes" disabled={busy} onPress={() => void saveStyle({ styleNotes: notes })} /> : null}
    </Card>

    <Card>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}><SectionTitle>Learn from my replies</SectionTitle><SupportText>AngelOS looks at replies you write or edit, and slowly learns your style. It keeps a short summary, not your messages.</SupportText></View>
        <Switch accessibilityLabel="Learn from my replies" value={style?.learn_from_replies ?? true} disabled={busy || Boolean(styleMigration)} onValueChange={(value) => void saveStyle({ learnFromReplies: value })} trackColor={{ false: ui.colors.border, true: ui.colors.softGold }} thumbColor={(style?.learn_from_replies ?? true) ? tokens.color.tide : ui.colors.secondaryText} />
      </View>
      {learned.sampleCount ? <View style={styles.learned}>
        <Text style={styles.learnedTitle}>What it learned from {learned.sampleCount} replies</Text>
        <SupportText>• Languages: {learned.languageMix?.ja ?? 0} Japanese, {learned.languageMix?.en ?? 0} English</SupportText>
        <SupportText>• Usually {learned.lengthBand} replies, {FORMALITY[learned.formality ?? 'polite']} tone, about {learned.emojiPerReply ?? 0} emoji each {learned.topEmojis?.length ? `(${learned.topEmojis.join(' ')})` : ''}</SupportText>
        {learned.usesClientName ? <SupportText>• You use the client's name</SupportText> : null}
        {learned.greetings?.length ? <SupportText>• Openings: {learned.greetings.join(' / ')}</SupportText> : null}
        {learned.closings?.length ? <SupportText>• Closings: {learned.closings.join(' / ')}</SupportText> : null}
        {style?.learned_at ? <SupportText>Last learned {new Date(style.learned_at).toLocaleString()}</SupportText> : null}
      </View> : <SupportText>Nothing learned yet. It starts after you approve a few replies you wrote or edited yourself.</SupportText>}
      <ActionButton label={busy ? 'Learning…' : 'Learn now'} disabled={busy || Boolean(styleMigration) || style?.learn_from_replies === false} onPress={() => void act(() => learnReplyStyleNow(workspaceId), (result) => { void load(); void dialog.notify('Done', result.newSuggestions ? `${result.newSuggestions} new repeated reply suggestion(s) below.` : 'Your style summary is up to date.'); })} />
    </Card>

    <Card>
      <SectionTitle>Repeated replies AngelOS noticed</SectionTitle>
      <SupportText>Replies you sent 3 or more times (for example aftercare). Approve one to make it a saved reply the AI can use.</SupportText>
      {suggested.length === 0 ? <SupportText>None right now.</SupportText> : null}
      {suggested.map((item) => editing?.id === item.id ? <View key={item.id} style={styles.suggestion}>
        <TextInput accessibilityLabel="Title" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} style={styles.input} />
        {item.body_ja !== null ? <><Text style={styles.label}>日本語</Text><TextInput accessibilityLabel="Japanese text" value={editing.bodyJa} onChangeText={(bodyJa) => setEditing({ ...editing, bodyJa })} multiline style={[styles.input, styles.multi]} /></> : null}
        <Text style={styles.label}>English</Text>
        <TextInput accessibilityLabel="English text" value={editing.bodyEn} onChangeText={(bodyEn) => setEditing({ ...editing, bodyEn })} multiline style={[styles.input, styles.multi]} />
        {item.body_ja !== null && editing.bodyJa !== item.body_ja ? <ActionButton label="Update English meaning" disabled={busy || !editing.bodyJa.trim()} onPress={() => void act(() => translateText(workspaceId, editing.bodyJa.trim(), 'en'), (result) => setEditing({ ...editing, bodyEn: result.translation, checkedJa: editing.bodyJa }))} /> : null}
        <View style={styles.chips}>
          <ActionButton kind="primary" label="Approve" disabled={busy || (item.body_ja !== null && editing.bodyJa !== item.body_ja && editing.checkedJa !== editing.bodyJa)} onPress={() => void act(() => approveSuggestedReply(workspaceId, item.id, { title: editing.title, bodyEn: editing.bodyEn, ...(item.body_ja !== null ? { bodyJa: editing.bodyJa } : {}) }), () => { setEditing(null); void load(); })} />
          <ActionButton kind="quiet" label="Cancel" onPress={() => setEditing(null)} />
        </View>
      </View> : <View key={item.id} style={styles.suggestion}>
        <View style={styles.toggleRow}><Text style={styles.learnedTitle}>{item.title}</Text><SupportText>sent {item.occurrences ?? 3}×</SupportText></View>
        {item.body_ja ? <BilingualBlock ja={item.body_ja} en={item.body_en} labelJa="日本語" labelEn="English meaning" /> : <Text style={styles.body}>{item.body_en}</Text>}
        <View style={styles.chips}>
          <ActionButton kind="primary" label="Approve" disabled={busy} onPress={() => void act(() => approveSuggestedReply(workspaceId, item.id), () => void load())} />
          <ActionButton label="Edit" onPress={() => setEditing({ id: item.id, title: item.title, bodyEn: item.body_en ?? '', bodyJa: item.body_ja ?? '' })} />
          <ActionButton kind="quiet" label="Reject" disabled={busy} onPress={() => void act(() => rejectSuggestedReply(workspaceId, item.id), () => void load())} />
        </View>
      </View>)}
    </Card>

    <Card>
      <SectionTitle>Roles</SectionTitle>
      {ROLE_COPY.map((role) => <View key={role.key} style={styles.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}><Text style={styles.learnedTitle}>{role.label}</Text><SupportText>{role.description}</SupportText></View>
        <Switch accessibilityLabel={role.label} value={roleMap.get(role.key) ?? true} disabled={busy} onValueChange={(value) => void act(() => updateAssistantRoles(workspaceId, { [role.key]: value }), (result) => setRoles(result.roles))} trackColor={{ false: ui.colors.border, true: ui.colors.softGold }} thumbColor={(roleMap.get(role.key) ?? true) ? tokens.color.tide : ui.colors.secondaryText} />
      </View>)}
    </Card>

    <Card>
      <SectionTitle>Everyday guidance</SectionTitle>
      <View style={styles.toggleRow}><View style={{ flex: 1 }}><Text style={styles.learnedTitle}>Ask useful follow-up questions</Text></View><Switch accessibilityLabel="Ask useful follow-up questions" value={profile.guidance_questions_enabled} onValueChange={(value) => void saveProfile({ guidanceQuestionsEnabled: value })} /></View>
      <View style={styles.toggleRow}><View style={{ flex: 1 }}><Text style={styles.learnedTitle}>Explain recommendations</Text></View><Switch accessibilityLabel="Explain recommendations" value={profile.explain_recommendations} onValueChange={(value) => void saveProfile({ explainRecommendations: value })} /></View>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText, marginTop: 4 },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, fontFamily: tokens.font.ui },
  multi: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  learned: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: tokens.color.glassTint },
  learnedTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: ui.colors.primaryText },
  suggestion: { gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border },
  body: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21, color: ui.colors.primaryText }
});
