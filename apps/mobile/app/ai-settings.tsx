import { router } from 'expo-router';
import { ListRow } from '../src/components/ui';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ErrorState } from '../src/components/ErrorState';
import { AccentSwitch, Card, ScreenTitle, SectionTitle, SupportText, ui } from '../src/components/ui';
import { ActionButton, Banner, BilingualBlock, Chip } from '../src/components/MessagingBits';
import { dialog } from '../src/lib/dialog';
import { friendlyText } from '../src/lib/friendly-error';
import {
  approveSuggestedReply, getAssistantProfile, getBrainSummaries, getReplyStyle, learnReplyStyleNow, listSuggestedReplies, rejectSuggestedReply,
  updateAssistantProfile, updateAssistantRoles, updateReplyStyle, type AssistantProfile, type AssistantRole, type AssistantRoleKey, type BrainSummary, type ReplyStyle
} from '../src/lib/ai';
import { translateText, type SavedReply } from '../src/lib/messaging';
import { getActiveWorkspace } from '../src/lib/workspace';
import { D, N, tokens } from '../src/design/theme';
import { useAppearance } from '../src/design/appearance';
import { Eye } from 'phosphor-react-native/src/icons/Eye';

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
  const { t, i18n } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfile | null>(null);
  const [roles, setRoles] = useState<AssistantRole[]>([]);
  const [style, setStyle] = useState<ReplyStyle | null>(null);
  const [styleMigration, setStyleMigration] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SavedReply[]>([]);
  const [memory, setMemory] = useState<{ summaries: BrainSummary[]; needsMigration: string | null } | null>(null);
  const [notes, setNotes] = useState('');
  const [personality, setPersonality] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string; bodyEn: string; bodyJa: string; checkedJa?: string } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws);
      const [data, styleResult, suggestions, brain] = await Promise.all([
        getAssistantProfile(ws), getReplyStyle(ws).catch(() => null), listSuggestedReplies(ws).catch(() => ({ replies: [], needsMigration: null })),
        getBrainSummaries(ws).catch(() => null)
      ]);
      setMemory(brain);
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
    catch (error) { const g = friendlyText(error, { action: 'save' }); void dialog.notify(g.title, g.message); }
    finally { setBusy(false); }
  }
  const saveProfile = (patch: Record<string, unknown>) => workspaceId && act(() => updateAssistantProfile(workspaceId, patch), setProfile);
  const saveStyle = (patch: Record<string, unknown>) => workspaceId && act(() => updateReplyStyle(workspaceId, patch), setStyle);

  if (state === 'error' || !profile || !workspaceId) return <Screen>
    <ScreenTitle>{t('aiset.s1')}</ScreenTitle>
    <SupportText>{t('aiset.introV1', "How your assistant sounds, and when it speaks up.")}</SupportText>
    {state === 'error' ? <ErrorState title={t('aiset.s23')} message={t('aiset.s24')} onRetry={() => { setState('loading'); void load(); }} /> : <Card><SupportText>{t('aiset.signedOut', "These settings appear once you are signed in to your studio.")}</SupportText></Card>}
  </Screen>;
  const learned = style?.learned ?? {};

  return <Screen>
    <ScreenTitle>{t('aiset.s1')}</ScreenTitle>
    <SupportText>{t('aiset.s2')}</SupportText>

    <ListRow leading={<AccessIcon />} title={t('aiAccess.title', 'What AngelOS can see')} subtitle={t('aiAccess.rowSub', 'Areas it can read in chat and voice')} onPress={() => router.push('/ai-access' as any)} />

    <Card premium>
      <SectionTitle>{t('aiset.s3')}</SectionTitle>
      <Text style={styles.label}>{t('aiset.w.name')}</Text>
      <TextInput accessibilityLabel={t('aiset.s25')} value={name} onChangeText={setName} onBlur={() => { if (name.trim() && name.trim() !== profile.display_name) void saveProfile({ displayName: name.trim() }); }} style={styles.input} />
      <Text style={styles.label}>{t('aiset.s4')}</Text>
      <View style={styles.chips}>{OWNER_TONES.map(([key, label]) => <Chip key={key} label={t(`aiset.opt.${key}`, label)} selected={profile.tone === key} onPress={() => void saveProfile({ tone: key })} />)}</View>
      <Text style={styles.label}>{t('aiset.s5')}</Text>
      <TextInput accessibilityLabel={t('aiset.s26')} value={personality} onChangeText={setPersonality} multiline placeholder={t('aiset.s27')} placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      {personality !== (profile.personality_prompt ?? '') ? <ActionButton label={t('aiset.s28')} disabled={busy} onPress={() => void saveProfile({ personalityPrompt: personality.trim() })} /> : null}
      <Text style={styles.label}>{t('aiset.s6')}</Text>
      <View style={styles.chips}>{(['low', 'balanced', 'high'] as const).map((value) => <Chip key={value} label={value === 'low' ? t('aiset.proLow', "Only when asked") : value === 'balanced' ? t('aiset.proBal', "Balanced") : t('aiset.proHigh', "Very proactive")} selected={profile.proactivity === value} onPress={() => void saveProfile({ proactivity: value })} />)}</View>
    </Card>

    <Card>
      <SectionTitle>{t('aiset.s7')}</SectionTitle>
      <SupportText>{t('aiset.s8')}</SupportText>
      {styleMigration ? <Banner tone="warning"><SupportText tone="warning">These settings need the database update {styleMigration}. It is waiting for your yes. Until then drafts use "Casual & friendly".</SupportText></Banner> : null}
      <Text style={styles.label}>{t('aiset.w.tone')}</Text>
      <View style={styles.chips}>{REPLY_TONES.map(([key, label]) => <Chip key={key} label={t(`aiset.opt.${key}`, label)} selected={style?.reply_tone === key} onPress={() => void saveStyle({ replyTone: key })} />)}</View>
      <Text style={styles.label}>{t('aiset.w.emoji')}</Text>
      <View style={styles.chips}>{EMOJI.map(([key, label]) => <Chip key={key} label={t(`aiset.opt.${key}`, label)} selected={style?.emoji_level === key} onPress={() => void saveStyle({ emojiLevel: key })} />)}</View>
      <Text style={styles.label}>{t('aiset.w.length')}</Text>
      <View style={styles.chips}>{LENGTH.map(([key, label]) => <Chip key={key} label={t(`aiset.opt.${key}`, label)} selected={style?.reply_length === key} onPress={() => void saveStyle({ replyLength: key })} />)}</View>
      <Text style={styles.label}>{t('aiset.s9')}</Text>
      <TextInput accessibilityLabel={t('aiset.s9')} value={notes} onChangeText={setNotes} multiline placeholder='e.g. "Always thank them for choosing Angels Beauty. Never use 様, use さん."' placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      {notes !== (style?.style_notes ?? '') ? <ActionButton label={t('aiset.s29')} disabled={busy} onPress={() => void saveStyle({ styleNotes: notes })} /> : null}
    </Card>

    <Card>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}><SectionTitle>{t('aiset.s10')}</SectionTitle><SupportText>{t('aiset.s11')}</SupportText></View>
        <AccentSwitch accessibilityLabel={t('aiset.s10')} value={style?.learn_from_replies ?? true} disabled={busy || Boolean(styleMigration)} onValueChange={(value) => void saveStyle({ learnFromReplies: value })} />
      </View>
      {learned.sampleCount ? <View style={styles.learned}>
        <Text style={styles.learnedTitle}>{t('aiset.learnedFrom', { defaultValue: "What it learned from {{n}} replies", n: learned.sampleCount })}</Text>
        <SupportText>{t('aiset.learnedLang', { defaultValue: "\u2022 Languages: {{ja}} Japanese, {{en}} English", ja: learned.languageMix?.ja ?? 0, en: learned.languageMix?.en ?? 0 })}</SupportText>
        <SupportText>{t('aiset.learnedStyle', { defaultValue: "\u2022 Usually {{len}} replies, {{tone}} tone, about {{emoji}} emoji each", len: t(`aiset.len_${learned.lengthBand}`, String(learned.lengthBand ?? '')), tone: t(`aiset.form_${learned.formality ?? 'polite'}`, FORMALITY[learned.formality ?? 'polite'] ?? 'polite'), emoji: learned.emojiPerReply ?? 0 })}{learned.topEmojis?.length ? ` (${learned.topEmojis.join(' ')})` : ''}</SupportText>
        {learned.usesClientName ? <SupportText>{t('aiset.s12')}</SupportText> : null}
        {learned.greetings?.length ? <SupportText>{t('aiset.openings', "\u2022 Openings: ")}{learned.greetings.join(' / ')}</SupportText> : null}
        {learned.closings?.length ? <SupportText>{t('aiset.closings', "\u2022 Closings: ")}{learned.closings.join(' / ')}</SupportText> : null}
        {style?.learned_at ? <SupportText>{t('aiset.lastLearned', { defaultValue: "Last learned {{when}}", when: new Date(style.learned_at).toLocaleString(i18n.language?.startsWith('ja') ? 'ja-JP' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) })}</SupportText> : null}
      </View> : <SupportText>{t('aiset.s13')}</SupportText>}
      <ActionButton label={busy ? t('aiset.learning', "Learning\u2026") : t('aiset.learnNow', "Learn now")} disabled={busy || Boolean(styleMigration) || style?.learn_from_replies === false} onPress={() => void act(() => learnReplyStyleNow(workspaceId), (result) => { void load(); void dialog.notify(t('aiset.done', "Done"), result.newSuggestions ? t('aiset.newSugg', { defaultValue: "{{n}} new repeated reply suggestions below.", n: result.newSuggestions }) : t('aiset.upToDate', "Your style summary is up to date.")); })} />
    </Card>

    <Card>
      <SectionTitle>{t('aiset.s14')}</SectionTitle>
      <SupportText>{t('aiset.s15')}</SupportText>
      {suggested.length === 0 ? <SupportText>{t('aiset.s16')}</SupportText> : null}
      {suggested.map((item) => editing?.id === item.id ? <View key={item.id} style={styles.suggestion}>
        <TextInput accessibilityLabel={t('aiset.s30')} value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} style={styles.input} />
        {item.body_ja !== null ? <><Text style={styles.label}>日本語</Text><TextInput accessibilityLabel={t('aiset.s31')} value={editing.bodyJa} onChangeText={(bodyJa) => setEditing({ ...editing, bodyJa })} multiline style={[styles.input, styles.multi]} /></> : null}
        <Text style={styles.label}>{t('aiset.english', "English")}</Text>
        <TextInput accessibilityLabel={t('aiset.s32')} value={editing.bodyEn} onChangeText={(bodyEn) => setEditing({ ...editing, bodyEn })} multiline style={[styles.input, styles.multi]} />
        {item.body_ja !== null && editing.bodyJa !== item.body_ja ? <ActionButton label={t('aiset.s33')} disabled={busy || !editing.bodyJa.trim()} onPress={() => void act(() => translateText(workspaceId, editing.bodyJa.trim(), 'en'), (result) => setEditing({ ...editing, bodyEn: result.translation, checkedJa: editing.bodyJa }))} /> : null}
        <View style={styles.chips}>
          <ActionButton kind="primary" label={t('aiset.s34')} disabled={busy || (item.body_ja !== null && editing.bodyJa !== item.body_ja && editing.checkedJa !== editing.bodyJa)} onPress={() => void act(() => approveSuggestedReply(workspaceId, item.id, { title: editing.title, bodyEn: editing.bodyEn, ...(item.body_ja !== null ? { bodyJa: editing.bodyJa } : {}) }), () => { setEditing(null); void load(); })} />
          <ActionButton kind="quiet" label={t('aiset.s35')} onPress={() => setEditing(null)} />
        </View>
      </View> : <View key={item.id} style={styles.suggestion}>
        <View style={styles.toggleRow}><Text style={styles.learnedTitle}>{item.title}</Text><SupportText>sent {item.occurrences ?? 3}×</SupportText></View>
        {item.body_ja ? <BilingualBlock ja={item.body_ja} en={item.body_en} labelJa="日本語" labelEn={t('aiset.englishMeaning', "English meaning")} /> : <Text style={styles.body}>{item.body_en}</Text>}
        <View style={styles.chips}>
          <ActionButton kind="primary" label={t('aiset.s34')} disabled={busy} onPress={() => void act(() => approveSuggestedReply(workspaceId, item.id), () => void load())} />
          <ActionButton label={t('aiset.s36')} onPress={() => setEditing({ id: item.id, title: item.title, bodyEn: item.body_en ?? '', bodyJa: item.body_ja ?? '' })} />
          <ActionButton kind="quiet" label={t('aiset.s37')} disabled={busy} onPress={() => void act(() => rejectSuggestedReply(workspaceId, item.id), () => void load())} />
        </View>
      </View>)}
    </Card>

    <Card>
      <SectionTitle>{t('aiset.roles', "Roles")}</SectionTitle>
      {ROLE_COPY.map((role) => <View key={role.key} style={styles.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}><Text style={styles.learnedTitle}>{t(`aiset.role.${role.key}.l`, role.label)}</Text><SupportText>{t(`aiset.role.${role.key}.d`, role.description)}</SupportText></View>
        <AccentSwitch accessibilityLabel={t(`aiset.role.${role.key}.l`, role.label)} value={roleMap.get(role.key) ?? true} disabled={busy} onValueChange={(value) => void act(() => updateAssistantRoles(workspaceId, { [role.key]: value }), (result) => setRoles(result.roles))} />
      </View>)}
    </Card>

    <Card>
      <SectionTitle>{t('aiset.s17')}</SectionTitle>
      <SupportText>{t('aiset.s18')}</SupportText>
      {memory?.needsMigration ? <Banner><SupportText>Memory starts after a database update ({memory.needsMigration}).</SupportText></Banner> : null}
      {memory && !memory.needsMigration && memory.summaries.length === 0 ? <SupportText>{t('aiset.s19')}</SupportText> : null}
      {(memory?.summaries ?? []).slice(0, 8).map((item) => <View key={`${item.kind}:${item.topic}`} style={styles.memoryRow}>
        <Text style={[styles.body, { flex: 1 }]}>{item.summary}</Text>
        <Text style={styles.count}>{item.request_count}×</Text>
      </View>)}
    </Card>

    <Card>
      <SectionTitle>{t('aiset.s20')}</SectionTitle>
      <View style={styles.toggleRow}><View style={{ flex: 1 }}><Text style={styles.learnedTitle}>{t('aiset.s21')}</Text></View><AccentSwitch accessibilityLabel={t('aiset.s21')} value={profile.guidance_questions_enabled} onValueChange={(value) => void saveProfile({ guidanceQuestionsEnabled: value })} /></View>
      <View style={styles.toggleRow}><View style={{ flex: 1 }}><Text style={styles.learnedTitle}>{t('aiset.s22')}</Text></View><AccentSwitch accessibilityLabel={t('aiset.s22')} value={profile.explain_recommendations} onValueChange={(value) => void saveProfile({ explainRecommendations: value })} /></View>
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
  body: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21, color: ui.colors.primaryText },
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border },
  count: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: ui.colors.secondaryText }
});

/** Leading icon for "What AngelOS can see" (was a plain letter 'W'): the line eye from the app's icon set on a neutral disc. */
function AccessIcon() {
  const { palette, mode } = useAppearance();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === 'night' ? N.card : D.fill }}><Eye size={22} color={palette.text} /></View>;
}
