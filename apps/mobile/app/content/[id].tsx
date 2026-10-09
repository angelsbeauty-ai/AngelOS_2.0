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
import {
  approveContentPost, copyCaptionAndOpen, getContentPost, getLineEstimate, markVariantPosted, platformLabel, scheduleContentVariant,
  sendLineBroadcast, updateContentVariant, type ContentPost, type ContentVariant, type LineEstimate
} from '../../src/lib/content';
import { getMediaViewUrl } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';

const STATUS: Record<string, string> = { draft: 'Draft', prepared: 'Draft', approved: 'Approved', scheduled: 'Scheduled', publishing: 'Posting…', published: 'Posted', failed: 'Needs attention', archived: 'Archived' };
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Please try again.');

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
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
      const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws);
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
    catch (e) { void dialog.notify('That did not work', errText(e)); }
    finally { setBusy(false); }
  }

  if (state === 'error') return <Screen><ErrorState title="We couldn't load this post" message="Check your connection and try again." onRetry={() => { setState('loading'); void load(); }} /></Screen>;
  if (!post || !workspaceId) return <Screen><Card><SupportText>Loading post…</SupportText></Card></Screen>;
  const approvedPost = ['approved', 'scheduled', 'publishing', 'published', 'failed'].includes(post.status);
  const tomorrow = addDayString(dayString(new Date()), 1);

  return <Screen>
    <View style={styles.titleRow}><View style={{ flex: 1, gap: 6 }}><Pill tone="gold">{STATUS[post.status] ?? post.status}</Pill><ScreenTitle>{post.title}</ScreenTitle></View></View>
    <SupportText>Nothing is posted by AngelOS on its own. You approve, then post (or send) each version.</SupportText>

    {post.variants?.map((variant) => {
      const isLine = variant.platform === 'line';
      const en = (variant as any).capabilities_snapshot?.translation_en as string | undefined;
      const slot = when[variant.id] ?? { day: variant.scheduled_for ? dayString(new Date(variant.scheduled_for)) : tomorrow, time: variant.scheduled_for ? new Date(variant.scheduled_for).toTimeString().slice(0, 5) : '19:00' };
      const ready = ['approved', 'scheduled', 'failed'].includes(variant.status) && approvedPost;
      const full = [variant.hook, variant.caption, variant.cta, variant.hashtags.join(' ')].filter(Boolean).join('\n\n');
      return <Card key={variant.id}>
        <View style={styles.head}><PlatformBadge platform={variant.platform.split('_')[0]} label={isLine ? 'LINE broadcast' : platformLabel(variant.platform)} /><Text style={styles.status}>{STATUS[variant.status] ?? variant.status}{variant.scheduled_for ? ` · ${new Date(variant.scheduled_for).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</Text></View>

        {isLine ? <>
          <BilingualBlock ja={variant.caption} en={en ?? meaning[variant.id] ?? null} labelJa="日本語 (sent to LINE friends)" />
          <SupportText>To change the words, ask AngelOS for a new LINE draft (so the English meaning always matches).</SupportText>
        </> : <>
          <View style={styles.preview}>
            <View style={styles.previewHead}><View style={styles.dot} /><Text style={styles.previewName}>your_studio</Text></View>
            {preview ? <Image source={{ uri: preview }} style={styles.previewImage} accessibilityLabel="Post photo" /> : <View style={[styles.previewImage, styles.noPhoto]}><SupportText>No photo yet</SupportText></View>}
            <Text numberOfLines={3} style={styles.previewCaption}>{variant.caption}</Text>
            <Text style={styles.more}>… more</Text>
          </View>
          <Text style={styles.label}>Caption ({variant.caption.length}/2200)</Text>
          <TextInput accessibilityLabel="Caption" defaultValue={variant.caption} multiline editable={variant.status !== 'published'} onEndEditing={(e) => void run(() => updateContentVariant(workspaceId, variant.id, { caption: e.nativeEvent.text }))} style={[styles.input, styles.caption]} />
          {variant.caption.length > 2200 ? <Banner tone="warning"><SupportText>Instagram allows 2,200 characters. Shorten it before posting.</SupportText></Banner> : null}
          {variant.hashtags.length ? <SupportText>{variant.hashtags.join(' ')}{variant.hashtags.length > 30 ? '  (Instagram allows 30)' : ''}</SupportText> : null}
        </>}

        {variant.status !== 'published' && approvedPost ? <View style={{ gap: 8 }}>
          <DateField label="Post on" value={slot.day} min={dayString(new Date())} onChange={(day) => setWhen((c) => ({ ...c, [variant.id]: { ...slot, day } }))} />
          <TimeField label="Time (best: 19:00–21:00)" value={slot.time} onChange={(time) => setWhen((c) => ({ ...c, [variant.id]: { ...slot, time } }))} />
          <ActionButton label={variant.status === 'scheduled' ? 'Change time' : 'Schedule'} disabled={busy} onPress={() => void run(() => scheduleContentVariant(workspaceId, variant.id, toIso(slot.day, slot.time)), 'Scheduled. AngelOS will remind you; it will not post by itself.')} />
        </View> : null}

        {ready && isLine ? <View style={{ gap: 8 }}>
          <SupportText>{estimate?.text ?? 'Checking LINE…'}</SupportText>
          {estimate?.connected ? <ActionButton kind="primary" label="Send to LINE friends" disabled={busy} onPress={() => void (async () => {
            const ok = await dialog.confirm({ title: 'Send this LINE broadcast?', message: `${estimate.text}\n\nEnglish meaning:\n${en ?? ''}`, confirmText: 'Send now', cancelText: 'Not yet' });
            if (ok) await run(() => sendLineBroadcast(workspaceId, variant.id), 'Sent to your LINE friends.');
          })()} /> : <>
            <ActionButton kind="primary" label="Copy & open LINE" onPress={() => void copyCaptionAndOpen(variant.caption, 'line')} />
            <ActionButton label="I sent it" disabled={busy} onPress={() => void run(() => markVariantPosted(workspaceId, variant.id), 'Marked as sent.')} />
          </>}
        </View> : null}

        {ready && !isLine ? <View style={{ gap: 8 }}>
          <ActionButton kind="primary" label={`Copy caption & open ${platformLabel(variant.platform)}`} onPress={() => void copyCaptionAndOpen(full, variant.platform)} />
          <TextInput accessibilityLabel="Link to the post" value={links[variant.id] ?? ''} onChangeText={(v) => setLinks((c) => ({ ...c, [variant.id]: v }))} placeholder="Paste the post link (optional)" autoCapitalize="none" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
          <ActionButton label="Mark as posted" disabled={busy} onPress={() => void run(() => markVariantPosted(workspaceId, variant.id, links[variant.id]?.trim() || undefined), 'Marked as posted.')} />
        </View> : null}
        {variant.status === 'published' && variant.live_url ? <SupportText>Link: {variant.live_url}</SupportText> : null}
      </Card>;
    })}

    {!approvedPost ? <ActionButton kind="primary" label={busy ? 'Approving…' : 'Approve post'} disabled={busy} onPress={() => void run(() => approveContentPost(workspaceId, id), 'Approved. Now schedule it or post it yourself.')} /> : null}
    <ActionButton label="Ask AngelOS about this post" onPress={() => router.push({ pathname: '/ai', params: { contextEntityType: 'content_post', contextEntityId: post.id, contextScreen: 'content' } } as any)} />
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
