import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { importMedia } from '../../src/lib/media';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenTitle, SupportText } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { tokens } from '../../src/design/theme';
import { BrandLogo } from '../../src/components/BrandBadge';
import { ApiError } from '../../src/lib/api';
import { approveContentPost, scheduleContentVariant, createComposerDraft, draftCaption, listHashtagSets, type CaptionTone, type HashtagSet, type ContentFormat, type ContentObjective, type ContentPlatform } from '../../src/lib/content';
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

/** LINE is not a post platform. TikTok posts automatically once Postiz is wired. */
const PLATFORMS: { id: ContentPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
];

type Kind = 'story' | 'post' | 'carousel' | 'reel' | 'live' | 'thread';
const KINDS: Kind[] = ['story', 'post', 'carousel', 'reel', 'live', 'thread'];

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
  const params = useLocalSearchParams<{ date?: string; title?: string; goal?: string; mediaId?: string; caption?: string; format?: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [goalIndex, setGoalIndex] = useState<number | null>(0);
  const [language, setLanguage] = useState<Language>('ja');
  const [caption, setCaption] = useState('');
  const [hashtagText, setHashtagText] = useState('');
  const [kind, setKind] = useState<Kind>(params.format === 'story' || params.format === 'reel' || params.format === 'carousel' ? params.format : 'post');
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(['instagram']);
  const [commentsOn, setCommentsOn] = useState(true);
  const [link, setLink] = useState('');
  const [showRepost, setShowRepost] = useState(false);
  const [day, setDay] = useState<Date>(() => parseDayParam(params.date));
  const [time, setTime] = useState('19:00');
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [captionEn, setCaptionEn] = useState('');
  const [captionNote, setCaptionNote] = useState<string | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => { void loadMedia(); }, []);
  useEffect(() => { if (params.date) setDay(parseDayParam(params.date)); }, [params.date]);
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
  const postedCaption = useMemo(() => {
    const primary = caption.trim();
    const english = captionEn.trim();
    const text = language === 'both' && english && !primary.includes(english) ? `${primary}\n\n${english}`.trim() : primary;
    return [text, link.trim()].filter(Boolean).join('\n');
  }, [caption, captionEn, language, link]);
  const plannedAt = useMemo(() => {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  }, [day, time]);
  const today = startOfDay(new Date());
  const savable = kind === 'post' || kind === 'story' || kind === 'carousel' || kind === 'reel';
  const canSave = Boolean(workspaceId && savable && platforms.length && (postedCaption.trim() || selectedMedia.length) && !busy && !captionBusy);

  function togglePlatform(id: ContentPlatform) {
    setPlatforms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleMedia(id: string) {
    setSelectedMedia((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 10 ? current : [...current, id]);
  }

  async function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    if (!workspaceId || !assets.length) return;
    setBusy(true);
    try {
      const saved: string[] = [];
      for (const a of assets.slice(0, 10)) {
        const asset = await importMedia(workspaceId, { uri: a.uri, filename: a.fileName || `post_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', sizeBytes: a.fileSize, width: a.width, height: a.height, source: 'phone_photos' }, { role: 'other', marketingPermission: 'marketing_approved' });
        setMedia((m) => [asset, ...m.filter((x) => x.id !== asset.id)]);
        setPreviews((p) => ({ ...p, [asset.id]: a.uri }));
        saved.push(asset.id);
      }
      setSelectedMedia((cur) => [...saved, ...cur].slice(0, 10));
      setMediaState('ready');
    } catch (e) { void dialog.notify(t('imp.fail'), e instanceof Error ? e.message : t('imp.unknown')); }
    finally { setBusy(false); }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { void dialog.notify(t('imp.photosPerm'), t('imp.photosPermMsg')); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) await addAssets(result.assets);
  }

  async function fromAlbum() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { void dialog.notify(t('imp.photosPerm'), t('imp.photosPermMsg')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) await addAssets(result.assets);
  }

  async function writeCaption(tone: CaptionTone) {
    if (goalIndex === null) { void dialog.notify(t('cnew.s38'), t('cnew.s1')); return; }
    if (!workspaceId || captionBusy) return;
    if ((tone === 'write' || tone === 'again') && (caption.trim() || captionEn.trim())) {
      const ok = await dialog.confirm({ title: t('cnew.s35'), message: t('cnew.s47'), confirmText: t('cnew.s45') });
      if (!ok) return;
    }
    const nextSeed = tone === 'write' || tone === 'again' ? seed + 1 : seed;
    setSeed(nextSeed);
    setCaptionBusy(true);
    try {
      const draft = await draftCaption(workspaceId, {
        objective: GOALS[goalIndex].objective,
        language,
        tone,
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        captionEn: captionEn.trim() || undefined,
        seed: nextSeed
      });
      if (language === 'en') setCaption(draft.captionEn || draft.caption);
      else setCaption(draft.captionJa || draft.caption);
      if (language === 'both') setCaptionEn(draft.captionEn);
      if (tone === 'write' || tone === 'again') setHashtagText(draft.hashtags.join(' '));
      setCaptionNote(t('cnew.s37'));
    } catch (error) {
      const friendly = toFriendly(error, { action: 'save', thing: 'draft' });
      void dialog.notify(t('cnew.s46'), friendly.message);
    } finally {
      setCaptionBusy(false);
    }
  }

  async function save(mode: 'now' | 'schedule') {
    const fmt: ContentFormat | null = kind === 'post' ? 'photo' : kind === 'story' || kind === 'carousel' || kind === 'reel' ? kind : null;
    if (!workspaceId || !fmt || !platforms.length) return;
    const goal = GOALS[goalIndex ?? 0];
    const when = mode === 'now' ? new Date() : plannedAt;
    const text = postedCaption.trim() || ' ';
    setBusy(true);
    try {
      if (mode === 'schedule' && when.getTime() <= Date.now() + 60000) { void dialog.notify(t('sml.pastTitle'), t('sml.pastBody')); return; }
      const draft = await createComposerDraft(workspaceId, {
        title: title.trim() || undefined,
        objective: goal.objective,
        goal: goal.goal,
        language,
        caption: text,
        hashtags: hashtags.slice(0, HASHTAG_LIMIT),
        format: fmt,
        platforms,
        plannedFor: when.toISOString(),
        mediaAssetIds: selectedMedia.length ? selectedMedia : undefined,
      });
      if (mode === 'schedule') {
        await approveContentPost(workspaceId, draft.id);
        for (const v of draft.variants ?? []) await scheduleContentVariant(workspaceId, v.id, when.toISOString());
      }
      toast.show({ title: mode === 'now' ? t('cnew.savedHere') : t('sml.scheduled'), message: mode === 'now' ? t('cnew.notSent') : t('sml.onCalendar', { when: `${when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}` }), tone: 'success' });
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

  const captionTooLongForInstagram = platforms.includes('instagram') && postedCaption.length > IG_CAPTION_LIMIT;
  const kindLabel = (id: Kind) => id === 'story' ? 'Story' : id === 'post' ? t('cnew.post') : id === 'carousel' ? 'Carousel' : id === 'reel' ? 'Reel' : id === 'live' ? t('cnew.live') : t('cnew.thread');

  return (
    <Screen>
      <ScreenTitle>{t('cnew.s0')}</ScreenTitle>

      <View style={styles.chips}>
        <Chip label={t('cnew.photo')} selected={false} onPress={() => void takePhoto()} />
        <Chip label={t('cnew.album')} selected={false} onPress={() => void fromAlbum()} />
        <Chip label={t('cnew.repost')} selected={showRepost} onPress={() => setShowRepost((v) => !v)} />
      </View>

      <Text style={styles.label}>{t('cnew.type')}</Text>
      <View style={styles.chips}>
        {KINDS.map((id) => <Chip key={id} label={kindLabel(id)} selected={kind === id} onPress={() => setKind(id)} />)}
      </View>
      {!savable ? <SupportText>{t('cnew.noLive')}</SupportText> : null}

      <Text style={styles.label}>{t('cnew.plats')}</Text>
      <View style={styles.chips}>
        {PLATFORMS.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: platforms.includes(item.id) }} onPress={() => togglePlatform(item.id)} style={[styles.plat, platforms.includes(item.id) && styles.platOn]}>
            <BrandLogo platform={item.id} size={18} />
            <Text style={styles.platText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {platforms.includes('tiktok') ? <SupportText>TikTok posts automatically.</SupportText> : null}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder={language === 'en' ? 'Write here…' : 'ここに書く…'}
        placeholderTextColor={colors.charcoal3}
        multiline
        maxLength={5000}
        accessibilityLabel={t('cnew.s2')}
        maxFontSizeMultiplier={1.3}
        style={styles.captionInput}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s35')} disabled={captionBusy} onPress={() => void writeCaption('write')}>
        <Text style={styles.link}>{captionBusy ? t('cnew.s36') : t('cnew.s35')}</Text>
      </Pressable>
      <SupportText tone={captionTooLongForInstagram ? 'critical' : 'secondary'}>
        {postedCaption.length}{platforms.includes('instagram') ? ` / ${IG_CAPTION_LIMIT}` : ''}
      </SupportText>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('cnew.comments')}</Text>
        <Switch value={commentsOn} onValueChange={setCommentsOn} trackColor={{ false: '#F2F2F2', true: '#151515' }} thumbColor="#FFF" />
      </View>
      {!commentsOn ? <SupportText>{t('cnew.commentsOff')}</SupportText> : null}
      <TextInput value={link} onChangeText={setLink} placeholder={t('cnew.link')} placeholderTextColor={colors.charcoal3} autoCapitalize="none" keyboardType="url" style={styles.input} />

      <Text style={styles.label}>{t('cnew.s18')}</Text>
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
        {hashtags.length} / {HASHTAG_LIMIT}
      </SupportText>

      <Text style={styles.label}>{t('cnew.s6')}</Text>
      <View style={styles.dayRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s19')} onPress={() => setDay((current) => addDays(current, -1))} style={styles.dayNav}>
          <Text style={styles.dayNavText}>‹</Text>
        </Pressable>
        <Text maxFontSizeMultiplier={1.3} style={styles.dayLabel}>
          {day.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s20')} onPress={() => setDay((current) => addDays(current, 1))} style={styles.dayNav}>
          <Text style={styles.dayNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {TIMES.map((value) => <Chip key={value} label={value} selected={time === value} onPress={() => setTime(value)} />)}
      </View>

      {showRepost ? <View style={{ gap: 8 }}>
        <Text style={styles.label}>{t('cnew.repost')}</Text>
        {mediaState === 'loading' ? <SupportText>{t('cnew.s8')}</SupportText> : null}
        {mediaState === 'error' ? <Pressable accessibilityRole="button" onPress={() => void loadMedia()}><SupportText tone="critical">{t('cnew.s9')}</SupportText></Pressable> : null}
        {mediaState === 'ready' && !media.length ? <SupportText>{t('cnew.s10')}</SupportText> : null}
        {media.length ? <View style={styles.grid}>{media.map((asset) => {
          const order = selectedMedia.indexOf(asset.id);
          return <Pressable key={asset.id} accessibilityRole="checkbox" accessibilityState={{ checked: order >= 0 }} onPress={() => toggleMedia(asset.id)} style={[styles.tile, order >= 0 && styles.tileSelected]}>
            {previews[asset.id] ? <Image source={{ uri: previews[asset.id] }} style={styles.tileImage} /> : <Text numberOfLines={2} style={styles.tileName}>{asset.original_filename}</Text>}
            {order >= 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{order + 1}</Text></View> : null}
          </Pressable>;
        })}</View> : null}
      </View> : null}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.postNow')} disabled={!canSave} onPress={() => void save('now')} style={[styles.primaryBtn, !canSave && styles.disabled]}>
          <Text style={styles.primaryText}>{busy ? t('cnew.saving') : t('cnew.postNow')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.schedule')} disabled={!canSave} onPress={() => void save('schedule')} style={[styles.secondaryBtn, !canSave && styles.disabled]}>
          <Text style={styles.secondaryText}>{t('cnew.schedule')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', justifyContent: 'center' },
  chipOn: { backgroundColor: '#151515', borderColor: '#151515' },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#151515' },
  chipTextOn: { color: '#FFFFFF' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: '#6B645B', marginTop: 4 },
  plat: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  platOn: { borderColor: '#151515', backgroundColor: 'rgba(0,0,0,0.04)' },
  platText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  captionInput: { minHeight: 100, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', padding: 12, fontFamily: tokens.font.ui, fontSize: 16, color: '#151515', backgroundColor: '#FFFFFF' },
  link: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontFamily: tokens.font.ui, fontSize: 15, color: '#151515' },
  input: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 12, fontFamily: tokens.font.ui, fontSize: 15, color: '#151515', backgroundColor: '#FFFFFF' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNav: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dayNavText: { fontSize: 22, color: '#151515' },
  dayLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: '#151515' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F2F2F2', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  tileSelected: { borderWidth: 2, borderColor: '#151515' },
  tileImage: { width: 72, height: 72 },
  tileName: { fontSize: 10, color: '#6B645B', textAlign: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#151515', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#151515', justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  secondaryBtn: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#151515', justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#151515', fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  disabled: { opacity: 0.4 }
});
