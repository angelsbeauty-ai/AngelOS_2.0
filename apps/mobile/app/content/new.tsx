import { useTranslation } from 'react-i18next';
import { SatinGlyph } from '../../src/components/SatinGlyph';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import * as ImagePicker from 'expo-image-picker';
import { importMedia } from '../../src/lib/media';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getContentAccounts, getInsights, type ContentAccountStatus } from '../../src/lib/social';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenTitle, SupportText } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { tokens } from '../../src/design/theme';
import { BrandLogo } from '../../src/components/BrandBadge';
import { ApiError } from '../../src/lib/api';
import * as Haptics from 'expo-haptics';
import { useOnline } from '../../src/lib/offline';
import { fromJ, ymd } from '../../src/lib/jst';
import { approveContentPost, publishContentVariant, isNotConnected, scheduleContentVariant, cancelScheduledVariant, bestTimes, BEST_TIME_SOURCE, ownBestTimes, createComposerDraft, draftCaption, listHashtagSets, type CaptionTone, type HashtagSet, type ContentFormat, type ContentObjective, type ContentPlatform } from '../../src/lib/content';
import { dialog } from '../../src/lib/dialog';
import { toFriendly, friendlyText } from '../../src/lib/friendly-error';
import { getMediaViewUrl, listMedia, type MediaAsset } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { useAppearance } from '../../src/design/appearance';
import { translateText } from '../../src/lib/messaging';

const colors = tokens.color;
const radius = tokens.radius;
const gap = 10;

type Language = 'en' | 'ja' | 'both';

const GOALS: { label: string; objective: ContentObjective; goal: string }[] = [
  { label: 'Bookings', objective: 'bookings', goal: 'bookings' },
  { label: 'Trust', objective: 'trust', goal: 'trust' },
  { label: 'Reach', objective: 'reach', goal: 'reach' },
  { label: 'Engagement', objective: 'engagement', goal: 'engagement' },
];

/** LINE is not a post platform. */
const PLATFORMS: { id: ContentPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
];

type Kind = 'story' | 'post' | 'carousel' | 'reel' | 'live' | 'thread';
/** AngelOS V1 offers only the types it can save and post; Live and Threads stay in code (Meta cannot schedule them). */
const KINDS: Kind[] = ['story', 'post', 'carousel', 'reel'];

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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string; title?: string; goal?: string; mediaId?: string; caption?: string; format?: string; time?: string }>();
  const online = useOnline();
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
  const [time, setTime] = useState(() => (params.time && /^\d{2}:\d{2}$/.test(String(params.time)) ? String(params.time) : '19:00'));
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [captionEn, setCaptionEn] = useState('');
  const [captionNote, setCaptionNote] = useState<string | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  const [review, setReview] = useState<'now' | 'schedule' | null>(null);
  const [inlineErr, setInlineErr] = useState<string | null>(null);

  useEffect(() => { void loadMedia(); }, []);
  useEffect(() => { if (params.date) setDay(parseDayParam(params.date)); }, [params.date]);
  useEffect(() => {
    if (params.title) setTitle(String(params.title));
    if (params.caption) setCaption(String(params.caption));
    if (params.goal) { const i = GOALS.findIndex((g) => g.objective === params.goal || g.goal === params.goal); setGoalIndex(i >= 0 ? i : 0); }
    if (params.mediaId) setSelectedMedia([String(params.mediaId)]);
  }, [params.title, params.caption, params.goal, params.mediaId]);
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
  const { mode: look, palette } = useAppearance(); const night = look === 'night';
  const styles = useStyles();
  const [own, setOwn] = useState<{ times: string[]; posts: number } | null>(null);
  const [pickDate, setPickDate] = useState(false);
  // S02: each platform shows whether its account is connected.
  const [acct, setAcct] = useState<Record<string, ContentAccountStatus> | null>(null);
  useEffect(() => { if (!workspaceId) return; void getContentAccounts(workspaceId).then((rows) => setAcct(Object.fromEntries(rows.map((r) => [r.platform, r.status])))).catch(() => setAcct(null)); }, [workspaceId]);
  const mainPlat = platforms.map((p) => p.split('_')[0]).find((p) => p !== 'line') ?? null;
  useEffect(() => { let live = true; setOwn(null); if (!workspaceId || !mainPlat) return;
    void getInsights(workspaceId, mainPlat).then((r) => { if (live) setOwn(ownBestTimes(r.top?.interactions ?? [])); }).catch(() => undefined);
    return () => { live = false; }; }, [workspaceId, mainPlat]);
  const [revEn, setRevEn] = useState('');
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
  // C06: a Japanese caption gets an English meaning line in the review sheet.
  useEffect(() => { const c = (caption.trim() || postedCaption.trim()).slice(0, 600); setRevEn(''); const en = captionEn.trim(); if (!review || !workspaceId || (en && en !== c && !/[\u3040-\u30ff\u4e00-\u9faf]/.test(en)) || !/[\u3040-\u30ff\u4e00-\u9faf]/.test(c)) return; let live = true; translateText(workspaceId, c, 'en').then((r) => { if (live) setRevEn(r.translation); }).catch(() => undefined); return () => { live = false; }; }, [review, workspaceId, caption, captionEn, postedCaption]);
  const plannedAt = useMemo(() => {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  }, [day, time]);
  const today = startOfDay(new Date());
  // P23: files the platforms won't take (Instagram: photos up to 8 MB, videos up to 650 MB).
  const tooLarge = media.filter((m) => selectedMedia.includes(m.id) && (m.size_bytes ?? 0) > (m.media_type === 'video' ? 650 : 8) * 1024 * 1024);
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
    } catch (e) { void dialog.notify(t('imp.fail'), friendlyText(e, { action: 'save' }).message); }
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

  async function save(mode: 'now' | 'schedule' | 'draft') {
    const fmt: ContentFormat | null = kind === 'post' ? 'photo' : kind === 'story' || kind === 'carousel' || kind === 'reel' ? kind : null;
    if (!workspaceId || !fmt || !platforms.length) return;
    const goal = GOALS[goalIndex ?? 0];
    const when = mode === 'now' ? new Date() : fromJ(plannedAt);
    const text = postedCaption.trim() || ' ';
    if (!online) { void dialog.notify(t('sched.offlineTitle', "You're offline"), t('sched.offlineBody', 'Nothing was scheduled or posted. Try again when you are back online.')); return; }
    if (mode === 'schedule' && when.getTime() <= Date.now() + 60000) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined); setInlineErr(t('sched.past', 'That time has passed. Pick a time later than now.')); return; }
    if (tooLarge.length && mode !== 'draft') { setInlineErr(t('sched.tooLargeFirst', 'Remove the file that is too large first.')); return; }
    setBusy(true); setInlineErr(null);
    try {
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
      if (mode === 'draft') {
        setReview(null);
        toast.show({ title: t('sched.draftSaved', 'Draft saved'), tone: 'success', action: { label: t('sched.open', 'Open'), onPress: () => router.push(`/content/${draft.id}` as any) } });
        if (router.canGoBack()) router.back(); else router.replace('/social');
        return;
      }
      await approveContentPost(workspaceId, draft.id);
      if (mode === 'schedule') {
        const ok: string[] = []; let failedMsg: string | null = null;
        for (const v of draft.variants ?? []) {
          try { await scheduleContentVariant(workspaceId, v.id, when.toISOString()); ok.push(v.id); }
          catch (e) { failedMsg = e instanceof ApiError && e.status !== 0 && e.status < 500 && e.message ? e.message : t('sched.failedBody', "It couldn't be scheduled. Your post is kept as approved."); }
        }
        if (!ok.length) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined); setInlineErr(failedMsg); return; }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        const short = `${plannedAt.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`;
        const ws = workspaceId;
        setReview(null);
        toast.show({ title: failedMsg ? t('sched.partialToast', { defaultValue: 'Scheduled {{ok}} of {{all}} for {{when}}', ok: ok.length, all: (draft.variants ?? []).length, when: short }) : t('sched.scheduledFor', { defaultValue: 'Scheduled for {{when}}', when: short }), tone: 'success', action: { label: t('sched.undo', 'Undo'), onPress: () => { void (async () => {
          let undone = 0; for (const id of ok) { try { await cancelScheduledVariant(ws, id); undone += 1; } catch { /* keep going */ } }
          toast.show(undone === ok.length ? { title: t('sched.undone', 'Schedule undone'), message: t('sched.keptApproved', 'Your post is kept as approved.'), tone: 'info' } : { title: t('sched.undoFailed', "Couldn't undo"), message: t('sched.undoFailedBody', 'Open the post in Calendar and cancel it there.'), tone: 'error' });
        })(); } } });
        router.replace({ pathname: '/calendar', params: { day: ymd(plannedAt), at: `${String(plannedAt.getHours()).padStart(2, '0')}:00` } } as any);
        return;
      }
      let posted = 0; let failed: string | null = null;
      for (const v of draft.variants ?? []) {
        try { const r = await publishContentVariant(workspaceId, v.id); if (r.published) posted += 1; }
        catch (e) { failed = isNotConnected(e) ? t('sched.ncInline') : e instanceof ApiError && e.message ? e.message : t('cnew.postFailed'); }
      }
      setReview(null);
      if (failed) { void dialog.notify(posted ? t('cnew.postedSome', { count: posted }) : t('cnew.notPosted'), `${failed}\n${t('cnew.keptApproved')}`); }
      else toast.show({ title: t('cnew.posted'), message: t('cnew.postedN', { count: posted }), tone: 'success' });
      if (router.canGoBack()) router.back();
      else router.replace('/social');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 409) && error.message) setInlineErr(error.message);
      else { const friendly = toFriendly(error, { action: 'save', thing: 'draft' }); setInlineErr(`${friendly.title}. ${friendly.message}`); }
    } finally {
      setBusy(false);
    }
  }

  const captionTooLongForInstagram = platforms.includes('instagram') && postedCaption.length > IG_CAPTION_LIMIT;
  const kindLabel = (id: Kind) => id === 'story' ? t('cnew.story', 'Story') : id === 'post' ? t('cnew.post') : id === 'carousel' ? t('cnew.carousel', 'Carousel') : id === 'reel' ? t('cnew.reel', 'Reel') : id === 'live' ? t('cnew.live') : t('cnew.thread');

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
            <View>
              <Text style={styles.platText}>{item.label}</Text>
              {acct ? <Text style={[styles.platState, { color: palette.muted }]}>{acct[item.id.split('_')[0]] === 'connected' ? t('cnew.connected') : acct[item.id.split('_')[0]] === 'needs_reconnect' ? t('cnew.reconnect') : t('cnew.notConnected')}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
      {acct && platforms.some((p) => acct[p.split('_')[0]] !== 'connected') ? <Pressable accessibilityRole="link" onPress={() => router.push('/settings/connections' as any)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.link, { textDecorationLine: 'underline' }]}>{t('cnew.connectLink')}</Text></Pressable> : null}
      {platforms.some((p) => p.startsWith('instagram')) ? <Pressable accessibilityRole="button" accessibilityHint={t('grid.previewSub')} onPress={() => router.push({ pathname: '/content/grid', params: { ...(selectedMedia[0] ? { pendingAsset: selectedMedia[0] } : {}), pendingAt: plannedAt.toISOString(), pendingKind: kind } } as any)} style={styles.gridRow}>
        <SatinGlyph name="grid" size={22} color={tokens.color.roseGold} />
        <View style={{ flex: 1 }}><Text style={styles.gridRowTitle}>{t('grid.preview')}</Text><Text style={styles.gridRowSub}>{t('grid.previewSub')}</Text></View>
        <CaretRight size={16} color={tokens.color.charcoal2} />
      </Pressable> : null}
      {platforms.includes('tiktok') ? <SupportText>{t('cnew.tiktokAuto')}</SupportText> : null}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder={t('composer.writeHere')}
        placeholderTextColor={colors.charcoal3}
        multiline
        maxLength={5000}
        accessibilityLabel={t('cnew.s2')}
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
        <Switch value={commentsOn} onValueChange={setCommentsOn} trackColor={{ false: night ? '#3A3A3C' : '#E5E5EA', true: palette.text }} thumbColor={night ? '#F4F4F5' : '#FFFFFF'} />
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('sched.pickDate')} accessibilityHint={t('sched.pickDateHint')} onPress={() => setPickDate((v) => !v)} style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.dayLabel}>{day.toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', month: 'long', day: 'numeric' })} · {time}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.s20')} onPress={() => setDay((current) => addDays(current, 1))} style={styles.dayNav}>
          <Text style={styles.dayNavText}>›</Text>
        </Pressable>
      </View>
      {pickDate && Platform.OS !== 'web' ? <DateTimePicker value={new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(time.split(':')[0]), Number(time.split(':')[1]))} mode="datetime" display={Platform.OS === 'ios' ? 'inline' : 'default'} is24Hour locale={i18n.language === 'ja' ? 'ja-JP' : 'en-GB'} minuteInterval={15} minimumDate={new Date()} themeVariant={night ? 'dark' : 'light'} accentColor={palette.text} onChange={(_e, d) => { if (Platform.OS !== 'ios') setPickDate(false); if (d) { setDay(startOfDay(d)); setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); } }} /> : null}
      <View style={styles.chips}>
        {TIMES.map((value) => <Chip key={value} label={value} selected={time === value} onPress={() => setTime(value)} />)}
      </View>
      {(() => { const rule = bestTimes(platforms, day); const best = own ? { times: own.times, goodDay: rule.goodDay } : rule; return <View style={{ gap: 6 }}>
        <Text style={styles.label}>{t('sched.bestTime', 'Best time')}{best.goodDay ? '' : ` · ${t('sched.quietDay', 'quieter day')}`}</Text>
        <View style={styles.chips}>{best.times.map((value) => <Chip key={`b-${value}`} label={`✦ ${value}`} a11y={t('sched.bestAt', { defaultValue: 'Best time {{t}}', t: value })} selected={time === value} onPress={() => setTime(value)} />)}</View>
        <SupportText>{own ? t('sched.bestOwn', { n: own.posts }) : t('sched.bestRule', { src: t('sched.ruleSrc', BEST_TIME_SOURCE) })}</SupportText>
      </View>; })()}

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

      {tooLarge.map((m) => <View key={m.id} style={styles.tooBig} accessibilityLiveRegion="polite">
        <Text style={styles.tooBigTitle}>{m.media_type === 'video' ? t('sched.videoTooLarge', 'Video is too large for Instagram') : t('sched.photoTooLarge', 'Photo is too large for Instagram')}</Text>
        <SupportText>{t('sched.tooLargeBody', { defaultValue: '{{size}} MB. Instagram allows up to {{max}} MB. Remove it, or pick a smaller copy from your phone.', size: ((m.size_bytes ?? 0) / 1048576).toFixed(1), max: m.media_type === 'video' ? 650 : 8 })}</SupportText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => void fromAlbum()} style={[styles.secondaryBtn, { minHeight: 44 }]}><Text style={styles.secondaryText}>{t('sched.pickSmaller', 'Pick a smaller copy')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => toggleMedia(m.id)} style={[styles.secondaryBtn, { minHeight: 44 }]}><Text style={styles.secondaryText}>{t('sched.remove', 'Remove')}</Text></Pressable>
        </View>
      </View>)}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.postNow')} disabled={!canSave} onPress={() => { setInlineErr(null); setReview('now'); }} style={[styles.primaryBtn, !canSave && styles.disabled]}>
          <Text style={styles.primaryText}>{busy ? t('cnew.saving') : t('cnew.postNow')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cnew.schedule')} disabled={!canSave} onPress={() => { setInlineErr(null); setReview('schedule'); }} style={[styles.secondaryBtn, !canSave && styles.disabled]}>
          <Text style={styles.secondaryText}>{t('cnew.schedule')}</Text>
        </Pressable>
      </View>
      <Modal visible={review !== null} transparent animationType="slide" onRequestClose={() => { if (!busy) setReview(null); }}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>{t('sched.reviewTitle', 'Review your post')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')} disabled={busy} onPress={() => setReview(null)} hitSlop={6} style={styles.sheetClose}><Text style={styles.sheetCloseText}>✕</Text></Pressable>
            </View>
            <View style={styles.revRow}>
              <View style={{ flex: 1 }}><Text style={styles.revMain}>{platforms.map((id) => PLATFORMS.find((x) => x.id === id)?.label ?? id).join(', ')}</Text></View>
              <View style={{ flexDirection: 'row', gap: 6 }}>{platforms.map((id) => <BrandLogo key={id} platform={id} size={22} />)}</View>
            </View>
            <View style={styles.revRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.revMain}>{review === 'now' ? t('cnew.now') : `${plannedAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`}</Text>
                {review !== 'now' ? <Text style={styles.sheetSub}>{(own?.times ?? bestTimes(platforms, day).times).includes(time) ? `${t('sched.bestTime', 'Best time')} · JST` : 'JST · 24h'}</Text> : null}
              </View>
            </View>
            {selectedMedia.length ? <View style={styles.revRow}>
              <Text style={[styles.revMain, { flex: 1 }]}>{t('sched.nPhotos', { defaultValue: '{{count}} photos', count: selectedMedia.length })}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>{selectedMedia.slice(0, 3).map((id) => previews[id] ? <Image key={id} accessibilityIgnoresInvertColors source={{ uri: previews[id] }} style={styles.revThumb} /> : <View key={id} style={[styles.revThumb, { backgroundColor: night ? '#1C1C1E' : '#E4E4E6' }]} />)}</View>
            </View> : null}
            {/* S09: how it will look on each platform (photo crop + caption cut). */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} accessibilityLabel={t('sched.previews')}>
              {platforms.map((pl) => { const k = pl.split('_')[0]; const img = selectedMedia[0] ? previews[selectedMedia[0]] : null; const tall = k === 'tiktok' || kind === 'story' || kind === 'reel'; const w = tall ? 146 : 200; const h = tall ? 260 : k === 'facebook' ? 150 : kind === 'post' ? 250 : 200;
                return <View key={pl} accessible accessibilityLabel={t('sched.previewOn', { p: PLATFORMS.find((x) => x.id === pl)?.label ?? k })} style={{ width: w, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><BrandLogo platform={pl} size={16} /><Text style={styles.sheetSub}>{PLATFORMS.find((x) => x.id === pl)?.label ?? k}</Text></View>
                  {img ? <Image accessibilityIgnoresInvertColors source={{ uri: img }} style={{ width: w, height: h, borderRadius: 12 }} resizeMode="cover" /> : <View style={{ width: w, height: Math.min(h, 120), borderRadius: 12, backgroundColor: night ? '#1C1C1E' : '#E4E4E6', alignItems: 'center', justifyContent: 'center' }}><Text style={styles.sheetSub}>{t('sched.noPhoto')}</Text></View>}
                  <Text numberOfLines={k === 'instagram' ? 2 : 3} style={[styles.sheetSub, { color: palette.text }]}>{caption.trim() || postedCaption.trim()}</Text>
                </View>; })}
            </ScrollView>
            <View style={{ gap: 4 }}>
              <Text numberOfLines={4} style={styles.sheetCaption}>{caption.trim() || postedCaption.trim()}</Text>
              {revEn || (captionEn.trim() && captionEn.trim() !== (caption.trim() || postedCaption.trim())) ? <Text numberOfLines={3} style={styles.sheetSub}>EN: {revEn || captionEn.trim()}</Text> : null}
              {hashtags.length ? <Text numberOfLines={1} style={styles.sheetSub}>{hashtags.slice(0, 3).join(' ')}{hashtags.length > 3 ? ` +${hashtags.length - 3}` : ''}</Text> : null}
            </View>
            <SupportText>{review === 'now' ? t('cnew.reviewNowNote') : t('sched.reviewNote', { defaultValue: 'AngelOS will post this at {{time}} on {{day}}. You can edit or cancel until then.', time, day: plannedAt.toLocaleDateString('en-GB', { weekday: 'long' }) })}</SupportText>
            {inlineErr ? <Text accessibilityLiveRegion="assertive" style={styles.inlineErr}>{inlineErr}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ busy }} disabled={busy} onPress={() => { if (review) void save(review); }} style={styles.approveBtn}>
              {busy ? <ActivityIndicator color={palette.bg} /> : <Text style={styles.primaryText}>{review === 'now' ? t('sched.postNow', 'Post now') : t('sched.approveSchedule', 'Approve & schedule')}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save('draft')} style={styles.draftBtn}><Text style={styles.secondaryText}>{t('sched.saveDraft', 'Save as draft')}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Chip({ label, selected, onPress, a11y }: { label: string; selected: boolean; onPress: () => void; a11y?: string }) {
  const styles = useStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ selected }} hitSlop={6} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>;
}

type Ink = { text: string; muted: string; fill: string; border: string; card: string; onText: string; red: string; redBg: string };
// S10: every colour comes from the Day/Night palette; nothing hard-coded.
function useStyles() {
  const { palette, mode } = useAppearance(); const night = mode === 'night';
  return useMemo(() => makeStyles({ text: palette.text, muted: palette.muted, fill: night ? '#1C1C1E' : '#F2F2F2', border: palette.border, card: night ? '#161618' : '#FFFFFF', onText: palette.bg, red: night ? '#FF453A' : '#D70015', redBg: night ? 'rgba(255,69,58,0.12)' : 'rgba(215,0,21,0.06)' }), [mode, palette]);
}
const makeStyles = (c: Ink) => StyleSheet.create({
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.hairline },
  gridRowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: tokens.color.charcoal },
  gridRowSub: { fontFamily: tokens.font.ui, fontSize: 13, color: tokens.color.charcoal2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap },
  chip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
  chipOn: { backgroundColor: c.text, borderColor: c.text },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: c.text },
  chipTextOn: { color: c.onText },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: c.muted, marginTop: 4 },
  plat: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: c.border },
  platOn: { borderColor: c.text, backgroundColor: c.fill },
  platState: { fontFamily: tokens.font.ui, fontSize: 12 },
  platText: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: c.text },
  captionInput: { minHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, fontFamily: tokens.font.ui, fontSize: 16, color: c.text, backgroundColor: c.card },
  link: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: c.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontFamily: tokens.font.ui, fontSize: 15, color: c.text },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, fontFamily: tokens.font.ui, fontSize: 15, color: c.text, backgroundColor: c.card },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNav: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  dayNavText: { fontSize: 22, color: c.text },
  dayLabel: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: 72, height: 72, borderRadius: 12, backgroundColor: c.fill, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  tileSelected: { borderWidth: 2, borderColor: c.text },
  tileImage: { width: 72, height: 72 },
  tileName: { fontSize: 10, color: c.muted, textAlign: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: c.text, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: c.onText, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: c.text, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: c.onText, fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  secondaryBtn: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: c.text, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: c.text, fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  disabled: { opacity: 0.4 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 40, gap: 14 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 18, color: c.text },
  sheetClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontSize: 15, color: c.text },
  revRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingVertical: 6 },
  revMain: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: c.text },
  revThumb: { width: 36, height: 44, borderRadius: 6 },
  inlineErr: { fontFamily: tokens.font.ui, fontSize: 15, color: c.red },
  approveBtn: { minHeight: 50, borderRadius: 25, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center' },
  draftBtn: { minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  tooBig: { borderRadius: 14, padding: 12, gap: 8, backgroundColor: c.redBg },
  tooBigTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: c.red },
  sheetPreview: { flexDirection: 'row', gap: 12 },
  sheetThumb: { width: 104, height: 128, borderRadius: 12, backgroundColor: c.fill },
  sheetCount: { position: 'absolute', left: 8, bottom: 8, color: '#FFFFFF', fontSize: 12 },
  sheetCaption: { fontFamily: tokens.font.ui, fontSize: 16, lineHeight: 22, color: c.text },
  sheetSub: { fontFamily: tokens.font.ui, fontSize: 13, color: c.muted },
  sheetList: { borderRadius: 12, backgroundColor: c.fill },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14 },
  sheetPlat: { flex: 1, fontFamily: tokens.font.uiSemibold, fontSize: 16, color: c.text },
  sheetWhen: { fontFamily: tokens.font.ui, fontSize: 15, color: c.text }
});
