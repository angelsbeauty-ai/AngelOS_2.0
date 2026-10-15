import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { importMedia } from '../../src/lib/media';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card, Pill, PrimaryActionLabel, SecondaryActionLabel, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { tokens } from '../../src/design/theme';
import { ApiError } from '../../src/lib/api';
import { approveContentPost, scheduleContentVariant, createComposerDraft, listHashtagSets, type HashtagSet, type ContentFormat, type ContentObjective, type ContentPlatform } from '../../src/lib/content';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import { getMediaViewUrl, listMedia, type MediaAsset } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';

const colors = tokens.color;
const radius = tokens.radius;
const gap = 10;

type Language = 'en' | 'ja' | 'both';

const GOALS: { label: string; objective: ContentObjective; goal: string }[] = [
  { label: 'Bookings', objective: 'bookings', goal: 'bookings' },
  { label: 'Academy students', objective: 'education', goal: 'academy_students' },
  { label: 'Trust', objective: 'trust', goal: 'trust' },
  { label: 'Reach', objective: 'reach', goal: 'reach' },
  { label: 'Engagement', objective: 'engagement', goal: 'engagement' },
];

const PLATFORMS: { id: ContentPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'line', label: 'LINE' },
];

const FORMATS: { id: ContentFormat; label: string }[] = [
  { id: 'photo', label: 'Photo' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'reel', label: 'Reel' },
  { id: 'story', label: 'Story' },
];

const TIMES = ['10:00', '12:00', '18:00', '19:00', '20:00', '21:00'];
const IG_CAPTION_LIMIT = 2200;
const HASHTAG_LIMIT = 30;

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function parseDayParam(value?: string) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return startOfDay(new Date());
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function parseHashtags(text: string) { return Array.from(new Set(text.split(/[\s,、]+/).map((tag) => tag.trim()).filter(Boolean).map((tag) => `#${tag.replace(/^#+/, '')}`))); }
function isMarketingReady(asset: MediaAsset) {
  return asset.media_type === 'image' && asset.upload_status === 'uploaded' && asset.lifecycle_status === 'active' && (asset.marketing_permission === 'marketing_approved' || asset.marketing_permission === 'limited');
}

export default function NewPostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string; title?: string; goal?: string; mediaId?: string; caption?: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [goalIndex, setGoalIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<Language>('ja');
  const [caption, setCaption] = useState('');
  const [hashtagText, setHashtagText] = useState('');
  const [format, setFormat] = useState<ContentFormat>('photo');
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(['instagram']);
  const [day, setDay] = useState<Date>(() => parseDayParam(params.date));
  const [time, setTime] = useState('19:00');
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadMedia(); }, []);
  useEffect(() => { if (params.date) setDay(parseDayParam(params.date)); }, [params.date]);
  // Prefill from ideas / before-after maker.
  useEffect(() => {
    if (params.title) setTitle(String(params.title));
    if (params.caption) setCaption(String(params.caption));
    if (params.goal) { const i = GOALS.findIndex((g) => g.objective === params.goal || g.goal === params.goal); setGoalIndex(i >= 0 ? i : 0); }
    if (params.mediaId) setSelectedMedia([String(params.mediaId)]);
  }, [params.title, params.caption, params.goal, params.mediaId]);
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
  useEffect(() => { if (workspaceId) listHashtagSets(workspaceId).then((r) => setHashtagSets(r.sets)).catch(() => undefined); }, [workspaceId]);

  async function loadMedia() {
    setMediaState('loading');
    try {
      const workspace = await getActiveWorkspace();
      setWorkspaceId(workspace.id);
      const ready = (await listMedia(workspace.id)).filter(isMarketingReady).slice(0, 24);
      setMedia(ready);
      const urls = await Promise.all(ready.map(async (asset) => {
        try { return [asset.id, (await getMediaViewUrl(workspace.id, asset.id)).url] as const; } catch { return [asset.id, ''] as const; }
      }));
      setPreviews(Object.fromEntries(urls.filter(([, url]) => url)));
      setMediaState('ready');
    } catch {
      setMediaState('error');
    }
  }

  const hashtags = useMemo(() => parseHashtags(hashtagText), [hashtagText]);
  const plannedAt = useMemo(() => {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  }, [day, time]);
  const today = startOfDay(new Date());
  const captionTooLongForInstagram = platforms.includes('instagram') && caption.length > IG_CAPTION_LIMIT;
  const canSave = Boolean(workspaceId && goalIndex !== null && caption.trim() && platforms.length && !busy);

  function togglePlatform(id: ContentPlatform) {
    setPlatforms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleMedia(id: string) {
    setSelectedMedia((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 10 ? current : [...current, id]);
  }

  async function addFromPhone() {
    if (!workspaceId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { void dialog.notify(t('imp.photosPerm'), t('imp.photosPermMsg')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setBusy(true);
    try {
      // Angel picks this photo herself for a public post, so it is saved as approved for marketing.
      const asset = await importMedia(workspaceId, { uri: a.uri, filename: a.fileName || `post_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', sizeBytes: a.fileSize, width: a.width, height: a.height, source: 'phone_photos' }, { role: 'other', marketingPermission: 'marketing_approved' });
      setMedia((m) => [asset, ...m.filter((x) => x.id !== asset.id)]);
      setPreviews((p) => ({ ...p, [asset.id]: a.uri }));
      setSelectedMedia((cur) => [asset.id, ...cur].slice(0, 10));
      setMediaState('ready');
    } catch (e) { void dialog.notify(t('imp.fail'), e instanceof Error ? e.message : t('imp.unknown')); }
    finally { setBusy(false); }
  }

  async function save(schedule = false) {
    if (!workspaceId || goalIndex === null || !caption.trim() || !platforms.length) return;
    const goal = GOALS[goalIndex];
    setBusy(true);
    try {
      if (schedule && plannedAt.getTime() <= Date.now() + 60000) { void dialog.notify(t('sml.pastTitle'), t('sml.pastBody')); return; }
      const draft = await createComposerDraft(workspaceId, {
        title: title.trim() || undefined,
        objective: goal.objective,
        goal: goal.goal,
        language,
        caption: caption.trim(),
        hashtags: hashtags.slice(0, HASHTAG_LIMIT),
        format,
        platforms,
        plannedFor: plannedAt.toISOString(),
        mediaAssetIds: selectedMedia.length ? selectedMedia : undefined,
      });
      if (schedule) {
        await approveContentPost(workspaceId, draft.id);
        for (const v of draft.variants ?? []) await scheduleContentVariant(workspaceId, v.id, plannedAt.toISOString());
      }
      toast.show({ title: schedule ? t('sml.scheduled') : t('cnew.s34'), message: t('sml.onCalendar', { when: `${plannedAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}` }), tone: 'success' });
      if (router.canGoBack()) router.back();
      else router.replace('/social');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 409) && error.message) {
        void dialog.notify("That didn't save", error.message);
      } else {
        const friendly = toFriendly(error, { action: 'save', thing: 'draft' });
        void dialog.notify(friendly.title, friendly.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pill tone="gold">Social</Pill>
      <ScreenTitle>{t('cnew.s0')}</ScreenTitle>
      <SupportText>{t('sml.composerSub')}</SupportText>

      <Card>
        <SectionTitle>{t('cnew.s1')}</SectionTitle>
        <View style={styles.chips}>
          {GOALS.map((item, index) => (
            <Chip key={item.goal} label={item.label} selected={goalIndex === index} onPress={() => setGoalIndex(index)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{t('cnew.s2')}</SectionTitle>
        <View style={styles.chips}>
          <Chip label="日本語" selected={language === 'ja'} onPress={() => setLanguage('ja')} />
          <Chip label={t('cnew.s13')} selected={language === 'en'} onPress={() => setLanguage('en')} />
          <Chip label={t('cnew.s14')} selected={language === 'both'} onPress={() => setLanguage('both')} />
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('cnew.s15')}
          placeholderTextColor={colors.charcoal3}
          maxLength={160}
          accessibilityLabel={t('cnew.s16')}
          maxFontSizeMultiplier={1.3}
          style={styles.input}
        />
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={language === 'en' ? 'Write your caption…' : 'キャプションを書いてください…'}
          placeholderTextColor={colors.charcoal3}
          multiline
          maxLength={5000}
          accessibilityLabel={t('cnew.s2')}
          maxFontSizeMultiplier={1.3}
          style={styles.captionInput}
        />
        <SupportText tone={captionTooLongForInstagram ? 'critical' : 'secondary'}>
          {caption.length} characters{platforms.includes('instagram') ? ` · Instagram limit ${IG_CAPTION_LIMIT}` : ''}
        </SupportText>
        <TextInput
          value={hashtagText}
          onChangeText={setHashtagText}
          placeholder={t('cnew.s17')}
          placeholderTextColor={colors.charcoal3}
          autoCapitalize="none"
          accessibilityLabel={t('cnew.s18')}
          maxFontSizeMultiplier={1.3}
          style={styles.input}
        />
        <SupportText tone={hashtags.length > HASHTAG_LIMIT ? 'critical' : 'secondary'}>
          {hashtags.length} hashtag{hashtags.length === 1 ? '' : 's'} · max {HASHTAG_LIMIT}
        </SupportText>
        {hashtagSets.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{hashtagSets.map((set) => (
          <Pressable key={set.id} accessibilityRole="button" accessibilityLabel={`Add hashtag set ${set.name}`} onPress={() => setHashtagText((t) => Array.from(new Set([...parseHashtags(t), ...set.tags])).join(' '))} style={styles.chip}><Text style={{ fontFamily: tokens.font.uiSemibold, fontSize: 14, color: colors.charcoal }}>+ {set.name}</Text></Pressable>
        ))}</View> : null}
      </Card>

      <Card>
        <SectionTitle>{t('cnew.s3')}</SectionTitle>
        <View style={styles.chips}>
          {PLATFORMS.map((item) => (
            <Chip key={item.id} label={item.label} selected={platforms.includes(item.id)} onPress={() => togglePlatform(item.id)} />
          ))}
        </View>
        <View style={styles.chips}>
          {FORMATS.map((item) => (
            <Chip key={item.id} label={item.label} selected={format === item.id} onPress={() => setFormat(item.id)} />
          ))}
        </View>
        <SupportText>{t('cnew.s4')}</SupportText>
        {platforms.includes('line') ? <SupportText tone="warning">{t('cnew.s5')}</SupportText> : null}
      </Card>

      <Card>
        <SectionTitle>{t('cnew.s6')}</SectionTitle>
        <View style={styles.dayRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s19')} onPress={() => setDay((current) => addDays(current, -1))} style={styles.dayNav}>
            <Text style={styles.dayNavText}>‹</Text>
          </Pressable>
          <Text maxFontSizeMultiplier={1.3} style={styles.dayLabel}>
            {day.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s20')} onPress={() => setDay((current) => addDays(current, 1))} style={styles.dayNav}>
            <Text style={styles.dayNavText}>›</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          <Chip label={t('cnew.s21')} selected={sameDay(day, today)} onPress={() => setDay(today)} />
          <Chip label={t('cnew.s22')} selected={sameDay(day, addDays(today, 1))} onPress={() => setDay(addDays(today, 1))} />
          <Chip label={t('cnew.s23')} selected={sameDay(day, addDays(today, 7))} onPress={() => setDay(addDays(today, 7))} />
        </View>
        <View style={styles.chips}>
          {TIMES.map((value) => <Chip key={value} label={value} selected={time === value} onPress={() => setTime(value)} />)}
        </View>
        <SupportText>{t('cnew.s7')}</SupportText>
      </Card>

      <Card>
        <SectionTitle>{t('sml.photos')}</SectionTitle>
        <Pressable accessibilityRole="button" disabled={busy || !workspaceId} onPress={() => void addFromPhone()}><Text style={styles.link}>{t('sml.addFromPhone')}</Text></Pressable>
        {mediaState === 'loading' ? <SupportText>{t('cnew.s8')}</SupportText> : null}
        {mediaState === 'error' ? (
          <Pressable accessibilityRole="button" onPress={() => void loadMedia()}>
            <SupportText tone="critical">{t('cnew.s9')}</SupportText>
          </Pressable>
        ) : null}
        {mediaState === 'ready' && !media.length ? (
          <View style={styles.emptyMedia}>
            <SupportText>{t('cnew.s10')}</SupportText>
            <Link href="/media" asChild><Pressable accessibilityRole="link"><Text style={styles.link}>{t('cnew.s11')}</Text></Pressable></Link>
          </View>
        ) : null}
        {media.length ? (
          <View style={styles.grid}>
            {media.map((asset) => {
              const order = selectedMedia.indexOf(asset.id);
              return (
                <Pressable
                  key={asset.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: order >= 0 }}
                  accessibilityLabel={asset.original_filename}
                  onPress={() => toggleMedia(asset.id)}
                  style={[styles.tile, order >= 0 && styles.tileSelected]}
                >
                  {previews[asset.id] ? <Image source={{ uri: previews[asset.id] }} style={styles.tileImage} /> : <Text numberOfLines={2} style={styles.tileName}>{asset.original_filename}</Text>}
                  {order >= 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{order + 1}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>

      <View style={styles.actions}>
        {!canSave && !busy ? <SupportText>{t('cnew.s12')}</SupportText> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('sml.schedule')} disabled={!canSave} onPress={() => void save(true)} style={!canSave ? styles.disabled : null}>
          <PrimaryActionLabel>{busy ? t('sml.saving') : t('sml.schedule')}</PrimaryActionLabel>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s24')} disabled={!canSave} onPress={() => void save(false)} style={[styles.secondaryBtn, !canSave ? styles.disabled : null]}>
          <SecondaryActionLabel>{t('sml.saveDraft')}</SecondaryActionLabel>
        </Pressable>
      </View>
    </Screen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.hairline },
  chipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  chipText: { color: colors.charcoal, fontFamily: tokens.font.uiSemibold, fontSize: 14 },
  chipTextSelected: { color: colors.onCharcoal },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.block, paddingHorizontal: 14, marginVertical: 6, color: colors.charcoal, backgroundColor: colors.raised, fontFamily: tokens.font.ui, fontSize: 16 },
  captionInput: { minHeight: 140, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.block, padding: 14, marginVertical: 6, color: colors.charcoal, backgroundColor: colors.raised, fontFamily: tokens.font.ui, fontSize: 16, textAlignVertical: 'top' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dayNavText: { color: colors.tide, fontSize: 26, fontFamily: tokens.font.uiSemibold },
  dayLabel: { flex: 1, textAlign: 'center', color: colors.charcoal, fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap },
  tile: { width: '31%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.pearl, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  tileSelected: { borderColor: colors.tide },
  tileImage: { width: '100%', height: '100%' },
  tileName: { color: colors.charcoal2, fontSize: 11, padding: 6, textAlign: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.tide, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onCharcoal, fontFamily: tokens.font.uiBold, fontSize: 12 },
  emptyMedia: { gap: 6 },
  link: { color: colors.tide, fontFamily: tokens.font.uiBold, fontSize: 15 },
  actions: { gap: 8, marginTop: 8, marginBottom: 48 },
  disabled: { opacity: 0.45 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
});
