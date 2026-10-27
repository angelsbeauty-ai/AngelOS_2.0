import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, Pill, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Banner, BilingualBlock, PlatformBadge } from '../../src/components/MessagingBits';
import { DateField, TimeField, addDayString, dayString, toIso } from '../../src/components/DateField';
import { tokens } from '../../src/design/theme';
import { dialog } from '../../src/lib/dialog';
import { friendlyText } from '../../src/lib/friendly-error';
import {
  approveContentPost, copyCaptionAndOpen, getContentPost, getLineEstimate, markVariantPosted, platformLabel, scheduleContentVariant,
  sendLineBroadcast, updateContentVariant, type ContentPost, type ContentVariant, type LineEstimate
} from '../../src/lib/content';
import { getMediaViewUrl } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { PublishFailureNote } from '../../src/components/PublishFailureNote';

const STATUS: Record<string, string> = { draft: 'Draft', prepared: 'Draft', approved: 'Approved', scheduled: 'Scheduled', publishing: 'Posting…', published: 'Posted', failed: 'Needs attention', archived: 'Archived' };

export default function ContentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [studioName, setStudioName] = useState<string | null>(null);
  const [post, setPost] = useState<ContentPost | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState<Record<string, { day: string; time: string }>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [estimate, setEstimate] = useState<LineEstimate | null>(null);
  const [meaning, setMeaning] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const active = await getActiveWorkspace(); const ws = active.id; setWorkspaceId(ws); setStudioName(active.name ?? null);
      const data = await getContentPost(ws, id); setPost(data);
      const first = data.media?.[0]?.asset?.id;
      if (first) getMediaViewUrl(ws, first).then((r) => setPreview(r.url)).catch(() => setPreview(null));
      if (data.variants?.some((v) => v.platform === 'line')) getLineEstimate(ws).then(setEstimate).catch(() => setEstimate(null));
      setState('ready');
    } catch { setState('error'); }
  }, [id]);
  useFocusEffect(useCallback(() => { if (id) void load(); }, [id, load]));

  async function run(task: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try { await task(); await load(); if (done) void dialog.notify(done); }
    catch (e) { { const f = friendlyText(e, { action: 'save' }, t('cpost.fail', "That did not work")); void dialog.notify(f.title, f.message); } }
    finally { setBusy(false); }
  }

  if (state === 'error') return <Screen><ErrorState title={t('post.s4')} message={t('post.s5')} onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!post || !workspaceId) return <Screen><Card><SupportText>{t('post.s0')}</SupportText></Card></Screen>;
  const approvedPost = ['approved', 'scheduled', 'publishing', 'published', 'failed'].includes(post.status);
  const tomorrow = addDayString(dayString(new Date()), 1);

  return <Screen>
    <View style={styles.titleRow}><View style={{ flex: 1, gap: 6 }}><Pill tone="gold">{STATUS[post.status] ?? post.status}</Pill><ScreenTitle>{post.title}</ScreenTitle></View></View>
    <SupportText>{t('cpost.note', "Nothing is posted by AngelOS on its own. You approve, then post (or send) each version.")}</SupportText>

    {post.variants?.map((variant) => {
      const isLine = variant.platform === 'line';
      const en = (variant as any).capabilities_snapshot?.translation_en as string | undefined;
      const slot = when[variant.id] ?? { day: variant.scheduled_for ? dayString(new Date(variant.scheduled_for)) : tomorrow, time: variant.scheduled_for ? new Date(variant.scheduled_for).toTimeString().slice(0, 5) : '19:00' };
      const ready = ['approved', 'scheduled', 'failed'].includes(variant.status) && approvedPost;
      const full = [variant.hook, variant.caption, variant.cta, variant.hashtags.join(' ')].filter(Boolean).join('\n\n');
      return <Card key={variant.id}>
        <View style={styles.head}><PlatformBadge platform={variant.platform.split('_')[0]} label={isLine ? 'LINE broadcast' : platformLabel(variant.platform)} /><Text style={styles.status}>{STATUS[variant.status] ?? variant.status}{variant.scheduled_for ? ` · ${new Date(variant.scheduled_for).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</Text></View>

        {variant.status === 'failed' ? <PublishFailureNote ws={workspaceId} variants={[variant]} onChanged={() => void load()} /> : null}
        {isLine ? <>
          <BilingualBlock ja={variant.caption} en={en ?? meaning[variant.id] ?? null} labelJa="日本語 (sent to LINE friends)" />
          <SupportText>{t('cpost.lineNote', "To change the words, ask AngelOS for a new LINE draft (so the English meaning always matches).")}</SupportText>
        </> : <>
          <View style={styles.preview}>
            {studioName ? <View style={styles.previewHead}><View style={styles.dot} /><Text numberOfLines={1} style={styles.previewName}>{studioName}</Text></View> : null}
            {preview ? <Image source={{ uri: preview }} style={styles.previewImage} accessibilityLabel={t('post.s6')} /> : <View style={[styles.previewImage, styles.noPhoto]}><SupportText>{t('post.s1')}</SupportText></View>}
            <Text numberOfLines={3} style={styles.previewCaption}>{variant.caption}</Text>
            <Text style={styles.more}>{t('post.s2')}</Text>
          </View>
          <Text style={styles.label}>Caption ({variant.caption.length}/2200)</Text>
          <TextInput accessibilityLabel={t('post.s7')} defaultValue={variant.caption} multiline editable={variant.status !== 'published'} onEndEditing={(e) => void run(() => updateContentVariant(workspaceId, variant.id, { caption: e.nativeEvent.text }))} style={[styles.input, styles.caption]} />
          {variant.caption.length > 2200 ? <Banner tone="warning"><SupportText>{t('post.s3')}</SupportText></Banner> : null}
          {variant.hashtags.length ? <SupportText>{variant.hashtags.join(' ')}{variant.hashtags.length > 30 ? '  (Instagram allows 30)' : ''}</SupportText> : null}
        </>}

        {variant.status !== 'published' && approvedPost ? <View style={{ gap: 8 }}>
          <DateField label={t('post.s8')} value={slot.day} min={dayString(new Date())} onChange={(day) => setWhen((c) => ({ ...c, [variant.id]: { ...slot, day } }))} />
          <TimeField label={t('post.s9')} value={slot.time} onChange={(time) => setWhen((c) => ({ ...c, [variant.id]: { ...slot, time } }))} />
          <ActionButton label={variant.status === 'scheduled' ? t('cpost.changeTime', "Change time") : t('cpost.schedule', "Schedule")} disabled={busy} onPress={() => void run(() => scheduleContentVariant(workspaceId, variant.id, toIso(slot.day, slot.time)), t('cpost.scheduled', "Scheduled. AngelOS will remind you; it will not post by itself."))} />
        </View> : null}

        {ready && isLine ? <View style={{ gap: 8 }}>
          <SupportText>{estimate?.text ?? 'Checking LINE…'}</SupportText>
          {estimate?.connected ? <ActionButton kind="primary" label={t('post.s10')} disabled={busy} onPress={() => void (async () => {
            const ok = await dialog.confirm({ title: t('post.s17'), message: `${estimate.text}\n\nEnglish meaning:\n${en ?? ''}`, confirmText: t('post.s18'), cancelText: t('post.s19') });
            if (ok) await run(() => sendLineBroadcast(workspaceId, variant.id), t('cpost.lineSent', "Sent to your LINE friends."));
          })()} /> : <>
            <ActionButton kind="primary" label={t('post.s11')} onPress={() => void copyCaptionAndOpen(variant.caption, 'line')} />
            <ActionButton label={t('post.s12')} disabled={busy} onPress={() => void run(() => markVariantPosted(workspaceId, variant.id), t('cpost.markedSent', "Marked as sent."))} />
          </>}
        </View> : null}

        {ready && !isLine ? <View style={{ gap: 8 }}>
          <ActionButton kind="primary" label={`Copy caption & open ${platformLabel(variant.platform)}`} onPress={() => void copyCaptionAndOpen(full, variant.platform)} />
          <TextInput accessibilityLabel={t('post.s13')} value={links[variant.id] ?? ''} onChangeText={(v) => setLinks((c) => ({ ...c, [variant.id]: v }))} placeholder={t('post.s14')} autoCapitalize="none" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
          <ActionButton label={t('post.s15')} disabled={busy} onPress={() => void run(() => markVariantPosted(workspaceId, variant.id, links[variant.id]?.trim() || undefined), t('cpost.markedPosted', "Marked as posted."))} />
        </View> : null}
        {variant.status === 'published' && variant.live_url ? <SupportText>Link: {variant.live_url}</SupportText> : null}
      </Card>;
    })}

    {!approvedPost ? <ActionButton kind="primary" label={busy ? t('cpost.approving', "Approving\u2026") : t('cpost.approve', "Approve post")} disabled={busy} onPress={() => void run(() => approveContentPost(workspaceId, id), t('cpost.approved', "Approved. Now schedule it or post it yourself."))} /> : null}
    <ActionButton label={t('post.s16')} onPress={() => router.push({ pathname: '/ai', params: { contextEntityType: 'content_post', contextEntityId: post.id, contextScreen: 'content' } } as any)} />
  </Screen>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText, flexShrink: 1, textAlign: 'right' },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText },
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 16, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: 12, fontSize: 15, fontFamily: tokens.font.ui },
  caption: { minHeight: 120, textAlignVertical: 'top' },
  preview: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', maxWidth: 420 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: ui.colors.softGold },
  previewName: { fontFamily: tokens.font.uiBold, fontSize: 13, color: '#222' },
  previewImage: { width: '100%', aspectRatio: 4 / 5, backgroundColor: tokens.color.glassTint },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  previewCaption: { padding: 10, paddingBottom: 0, fontSize: 14, color: '#222', fontFamily: tokens.font.ui },
  more: { paddingHorizontal: 10, paddingBottom: 10, color: '#8e8e8e', fontSize: 13 }
});
