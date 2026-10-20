import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BrandLogo } from './BrandBadge';
import { PostThumb } from './PostThumb';
import { useToast } from './Toast';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import { ApiError } from '../lib/api';
import { dialog } from '../lib/dialog';
import { useOnline } from '../lib/offline';
import { bestTimes, BEST_TIME_SOURCE, cancelScheduledVariant, scheduleContentVariant, type ContentPost, type SchedulingStatus } from '../lib/content';

export type SchedState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; status: SchedulingStatus };

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dayText = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const haptic = (k: 'success' | 'error') => void Haptics.notificationAsync(k === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);

/** Human label for a post's state. Never a raw status key on screen. */
export function postStatusLabel(p: ContentPost, t: (k: string, d: string) => string) {
  const vs = p.variants ?? [];
  if (vs.some((v) => v.status === 'failed')) return t('sched.stFailed', "Didn't post");
  if (vs.some((v) => v.status === 'publishing')) return t('sched.stPosting', 'Posting…');
  if (vs.length && vs.every((v) => v.status === 'published')) return t('sched.stPosted', 'Posted');
  if (vs.some((v) => v.status === 'scheduled')) return t('sched.stScheduled', 'Scheduled');
  if (vs.some((v) => v.status === 'approved') || p.status === 'approved') return t('sched.stApproved', 'Approved · no time set');
  return t('sched.stDraft', 'Draft');
}

/** Calendar post sheet (P16/P17/P20/P22/P25): change time → Approve, Cancel → confirm → Undo. */
export function PostScheduleSheet({ ws, post, at, sched, onChanged, onClose, onRetryStatus }: { ws: string; post: ContentPost; at: Date; sched: SchedState; onChanged: () => void; onClose: () => void; onRetryStatus: () => void }) {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const toast = useToast();
  const online = useOnline();
  const red = night ? '#FF453A' : '#D70015';
  const vs = post.variants ?? [];
  const platforms = Array.from(new Set(vs.map((v) => v.platform.split('_')[0])));
  const scheduled = vs.filter((v) => v.status === 'scheduled');
  const movable = vs.filter((v) => ['scheduled', 'approved', 'failed'].includes(v.status));
  const failed = vs.some((v) => v.status === 'failed');
  const live = vs.find((v) => v.live_url)?.live_url;
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState<Date>(() => (at.getTime() > Date.now() ? at : new Date(Math.ceil((Date.now() + 3600000) / 900000) * 900000)));
  const [busy, setBusy] = useState(false);
  const [inline, setInline] = useState<string | null>(null);

  const st = sched.kind === 'ok' ? sched.status : null;
  const missing = st?.keyValid ? platforms.filter((p) => p !== 'line' && !st.channels.some((c) => c.startsWith(p))) : [];
  const banner = !online ? { title: t('sched.offlineTitle', "You're offline"), body: t('sched.offlineSheet', 'Changes wait until you are back online. Nothing is sent without you.'), action: null }
    : sched.kind === 'loading' ? { title: t('sched.checking', 'Checking scheduling…'), body: '', action: null }
    : sched.kind === 'error' ? { title: t('sched.statusErr', "Couldn't check scheduling"), body: '', action: { label: t('sched.tryAgain', 'Try again'), run: onRetryStatus } }
    : !st?.configured ? { title: t('sched.notConnected', "Scheduling isn't connected yet"), body: t('sched.notConnectedBody', 'Posts stay on your calendar but will not post by themselves. Post them yourself at the time.'), action: null }
    : !st.keyValid ? { title: t('sched.expired', 'Scheduling login expired'), body: t('sched.expiredBody', 'Sign in to the posting service again so scheduled posts go out.'), action: { label: t('sched.reconnect', 'Reconnect'), run: () => { onClose(); router.push('/social' as any); } } }
    : missing.length ? { title: t('sched.disconnected', { defaultValue: '{{p}} is disconnected', p: missing.map(name).join(', ') }), body: t('sched.disconnectedBody', 'Nothing is posted to the other platforms without asking you first.'), action: { label: t('sched.reconnect', 'Reconnect'), run: () => { onClose(); router.push('/social' as any); } } }
    : null;

  function errText(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 0) return t('sched.offlineBody', 'Nothing was scheduled or posted. Try again when you are back online.');
      if (e.status === 401) return t('sched.loginExpired', 'Your login expired. Sign in again.');
      if (e.status >= 400 && e.status < 500 && e.message) return e.message;
    }
    return t('sched.failedBody', "It couldn't be scheduled. Your post is kept as approved.");
  }

  async function scheduleAll(target: Date, ids: string[]) {
    let ok = 0; let msg: string | null = null;
    for (const id of ids) { try { await scheduleContentVariant(ws, id, target.toISOString()); ok += 1; } catch (e) { msg = errText(e); } }
    return { ok, msg };
  }

  async function approveTime() {
    setInline(null);
    if (when.getTime() <= Date.now() + 60000) { haptic('error'); setInline(t('sched.past', 'That time has passed. Pick a time later than now.')); return; }
    if (!online) { setInline(t('sched.offlineBody', 'Nothing was scheduled or posted. Try again when you are back online.')); return; }
    const before = scheduled.map((v) => ({ id: v.id, at: v.scheduled_for }));
    setBusy(true);
    const r = await scheduleAll(when, movable.map((v) => v.id));
    setBusy(false);
    if (!r.ok) { haptic('error'); setInline(r.msg); return; }
    haptic('success');
    setEditing(false); onChanged(); onClose();
    toast.show({ title: t('sched.movedTo', { defaultValue: 'Moved to {{when}}', when: `${dayText(when)}, ${hhmm(when)}` }), message: r.msg ? t('sched.partialShort', { defaultValue: '{{ok}} of {{all}} platforms moved.', ok: r.ok, all: movable.length }) : undefined, tone: r.msg ? 'info' : 'success', action: before.length ? { label: t('sched.undo', 'Undo'), onPress: () => { void (async () => {
      for (const b of before) if (b.at && new Date(b.at).getTime() > Date.now()) await scheduleContentVariant(ws, b.id, b.at).catch(() => undefined);
      onChanged(); toast.show({ title: t('sched.undone', 'Schedule undone'), tone: 'info' });
    })(); } } : undefined });
  }

  async function cancelPost() {
    const yes = await dialog.confirm({ title: t('sched.cancelTitle', 'Cancel this post?'), message: t('sched.cancelBody', 'It will not be posted. The approved draft stays in Social.'), confirmText: t('sched.cancelPost', 'Cancel post'), cancelText: t('sched.keep', 'Keep'), destructive: true });
    if (!yes) return;
    setBusy(true);
    const done: Array<{ id: string; at: string | null }> = []; let msg: string | null = null;
    for (const v of scheduled) { try { const r = await cancelScheduledVariant(ws, v.id); done.push({ id: v.id, at: r.previousScheduledFor ?? v.scheduled_for }); } catch (e) { msg = errText(e); } }
    setBusy(false);
    if (!done.length) { haptic('error'); setInline(msg); return; }
    onChanged(); onClose();
    toast.show({ title: t('sched.cancelled', 'Post cancelled'), message: msg ? t('sched.partialCancel', { defaultValue: '{{ok}} of {{all}} platforms cancelled.', ok: done.length, all: scheduled.length }) : undefined, tone: 'info', action: { label: t('sched.undo', 'Undo'), onPress: () => { void (async () => {
      let back = 0; for (const d of done) if (d.at && new Date(d.at).getTime() > Date.now()) { try { await scheduleContentVariant(ws, d.id, d.at); back += 1; } catch { /* reported below */ } }
      onChanged();
      toast.show(back === done.length ? { title: t('sched.restored', 'Post scheduled again'), tone: 'success' } : { title: t('sched.undoFailed', "Couldn't undo"), message: t('sched.undoPast', 'Pick a new time with Change time.'), tone: 'error' });
    })(); } } });
  }

  async function retry() {
    const target = at.getTime() > Date.now() + 60000 ? at : null;
    if (!target) { setEditing(true); setInline(t('sched.pickNew', 'Pick a new time, then Approve.')); return; }
    setBusy(true); const r = await scheduleAll(target, vs.filter((v) => v.status === 'failed').map((v) => v.id)); setBusy(false);
    if (r.ok) { haptic('success'); onChanged(); onClose(); toast.show({ title: t('sched.savedToCalendar', 'Saved to calendar'), tone: 'success' }); }
    else { haptic('error'); setInline(r.msg); }
  }

  const best = bestTimes(platforms, when);
  const setTimeStr = (s: string) => { const [h, m] = s.split(':').map(Number); setWhen(new Date(when.getFullYear(), when.getMonth(), when.getDate(), h, m)); setInline(null); };
  const shift = (mins: number) => { setWhen(new Date(when.getTime() + mins * 60000)); setInline(null); };
  const txt = { color: palette.text }; const mut = { color: palette.muted }; const line = { borderColor: night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' };

  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <PostThumb workspaceId={ws} post={post} size={88} radius={16} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityRole="header" numberOfLines={2} style={[s.title, txt]}>{post.title || t('sched.post', 'Post')}</Text>
        <Text numberOfLines={3} style={[s.sub, mut]}>{vs[0]?.caption ?? ''}</Text>
      </View>
    </View>
    <View style={[s.card, line]}>
      <Row k={t('sched.status', 'Status')} v={postStatusLabel(post, (k, d) => t(k, d))} />
      <Row k={t('sched.when', 'When')} v={`${dayText(at)}, ${hhmm(at)}`} />
      <View style={[s.row, line]} accessible accessibilityLabel={`${t('sched.where', 'Where')}: ${platforms.map(name).join(', ')}`}>
        <Text style={[s.k, txt]}>{t('sched.where', 'Where')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>{platforms.map((p) => <BrandLogo key={p} platform={p} size={22} />)}</View>
      </View>
    </View>
    {banner ? <View accessibilityLiveRegion="polite" style={[s.banner, { backgroundColor: palette.fill }]}>
      <Text style={[s.bTitle, txt]}>{banner.title}</Text>
      {banner.body ? <Text style={[s.sub, mut]}>{banner.body}</Text> : null}
      {banner.action ? <Pressable accessibilityRole="button" onPress={banner.action.run} style={s.link}><Text style={[s.linkText, txt]}>{banner.action.label}</Text></Pressable> : null}
    </View> : null}
    {failed ? <View style={[s.banner, { backgroundColor: palette.fill }]}>
      <Text style={[s.bTitle, { color: red }]}>{t('sched.stFailed', "Didn't post")}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void retry()} style={s.link}><Text style={[s.linkText, txt]}>{t('sched.tryAgain', 'Try again')}</Text></Pressable>
    </View> : null}
    {live ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(live)} style={s.link}><Text style={[s.linkText, txt]}>{t('sched.viewLive', 'View the live post')}</Text></Pressable> : null}

    {editing ? <View style={[s.card, line, { padding: 12, gap: 10 }]}>
      <View style={s.stepRow}>
        <Step label="‹" a11y={t('sched.prevDay', 'Previous day')} onPress={() => shift(-1440)} />
        <Text accessibilityLiveRegion="polite" style={[s.big, txt]}>{dayText(when)} · {hhmm(when)}</Text>
        <Step label="›" a11y={t('sched.nextDay', 'Next day')} onPress={() => shift(1440)} />
      </View>
      <View style={s.stepRow}>
        <Step label="−1h" a11y={t('sched.minusHour', 'One hour earlier')} onPress={() => shift(-60)} />
        <Step label="−15m" a11y={t('sched.minus15', '15 minutes earlier')} onPress={() => shift(-15)} />
        <Step label="+15m" a11y={t('sched.plus15', '15 minutes later')} onPress={() => shift(15)} />
        <Step label="+1h" a11y={t('sched.plusHour', 'One hour later')} onPress={() => shift(60)} />
      </View>
      {Platform.OS !== 'web' ? <DateTimePicker value={when} mode="datetime" display={Platform.OS === 'ios' ? 'compact' : 'default'} is24Hour locale="en-GB" minuteInterval={15} minimumDate={new Date()} themeVariant={night ? 'dark' : 'light'} onChange={(_e, d) => { if (d) { setWhen(d); setInline(null); } }} /> : null}
      <Text style={[s.k, txt]}>{t('sched.bestTime', 'Best time')}{best.goodDay ? '' : ` · ${t('sched.quietDay', 'quieter day')}`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {best.times.map((b) => { const on = hhmm(when) === b; return <Pressable key={b} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t('sched.bestAt', { defaultValue: 'Best time {{t}}', t: b })} onPress={() => setTimeStr(b)} style={[s.chip, { borderColor: palette.border }, on && { backgroundColor: palette.text }]}><Text style={[s.chipText, { color: on ? palette.bg : palette.text }]}>✦ {b}</Text></Pressable>; })}
      </View>
      <Text style={[s.small, mut]}>{t('sched.bestSource', { defaultValue: 'From: {{src}}', src: BEST_TIME_SOURCE })}</Text>
    </View> : null}
    {inline ? <Text accessibilityLiveRegion="assertive" style={[s.sub, { color: red }]}>{inline}</Text> : null}

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Btn label={t('sched.edit', 'Edit')} onPress={() => { onClose(); router.push(`/content/${post.id}` as any); }} />
      {movable.length ? (editing
        ? <Btn primary label={busy ? t('sched.saving', 'Saving…') : t('sched.approveTime', 'Approve')} a11y={t('sched.approveA11y', { defaultValue: 'Approve and schedule for {{when}}', when: `${dayText(when)} ${hhmm(when)}` })} disabled={busy} onPress={() => void approveTime()} />
        : <Btn label={t('sched.changeTime', 'Change time')} onPress={() => { setEditing(true); void Haptics.selectionAsync().catch(() => undefined); }} />) : null}
    </View>
    {scheduled.length ? <Pressable accessibilityRole="button" accessibilityLabel={t('sched.cancelPost', 'Cancel post')} disabled={busy} onPress={() => void cancelPost()} style={s.link}><Text style={[s.linkText, { color: red }]}>{t('sched.cancelPost', 'Cancel post')}</Text></Pressable> : null}
  </View>;

  function Row({ k, v }: { k: string; v: string }) { return <View style={[s.row, line]} accessible accessibilityLabel={`${k}: ${v}`}><Text style={[s.k, txt]}>{k}</Text><Text style={[s.v, mut]}>{v}</Text></View>; }
  function Step({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => { onPress(); void Haptics.selectionAsync().catch(() => undefined); }} style={[s.step, { borderColor: palette.border }]}><Text style={[s.chipText, txt]}>{label}</Text></Pressable>; }
  function Btn({ label, a11y, onPress, primary, disabled }: { label: string; a11y?: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
    return <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.btn, { borderColor: palette.border }, primary && { backgroundColor: palette.text, borderColor: palette.text }, disabled && { opacity: 0.5 }]}><Text style={[s.btnText, { color: primary ? palette.bg : palette.text }]}>{label}</Text></Pressable>;
  }
}
function name(p: string) { return p === 'instagram' ? 'Instagram' : p === 'facebook' ? 'Facebook' : p === 'tiktok' ? 'TikTok' : p === 'line' ? 'LINE' : p; }

const s = StyleSheet.create({
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  sub: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: tokens.font.ui, fontSize: 13 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  k: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  v: { flexShrink: 1, textAlign: 'right', fontFamily: tokens.font.ui, fontSize: 16 },
  banner: { borderRadius: 14, padding: 12, gap: 4 },
  bTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontFamily: tokens.font.uiSemibold, fontSize: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  step: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  big: { flexShrink: 1, textAlign: 'center', fontFamily: tokens.font.uiSemibold, fontSize: 17 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  btn: { flex: 1, minHeight: 48, paddingVertical: 10, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: tokens.font.uiSemibold, fontSize: 16 }
});
