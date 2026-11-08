import { installCrashGuard, crumb } from '../lib/crash-guard';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { ActionButton, Banner } from './MessagingBits';
import { Card, Pill, SectionTitle, SupportText } from './ui';
import { approveAiAction, cancelAiAction, createVoiceSession, getVoiceStatus, proposeVoiceAction, updateAssistantProfile } from '../lib/ai';
import { getHomeSummary } from '../lib/home';
import { apiFetch } from '../lib/api';
import type { ToolCard } from './AnswerCard';
import { approveReply, createMessageReply } from '../lib/messaging';
import { setLoudSpeaker, startVoiceAudio, stopVoiceAudio } from '../lib/livekit-globals';

type State = 'idle' | 'connecting' | 'live' | 'error';

function voiceToolCall(ev: any): { name: string; callId: string; args: string } | null {
  if (ev?.type === 'response.function_call_arguments.done' && ev.name && ev.call_id) return { name: ev.name, callId: ev.call_id, args: ev.arguments ?? '{}' };
  const item = ev?.item ?? ev?.output_item;
  if (item?.type === 'function_call' && item.name && item.call_id && item.arguments && /output_item\.done$/.test(ev?.type ?? '')) return { name: item.name, callId: item.call_id, args: item.arguments };
  return null;
}

export type VoiceDraftState = 'ready' | 'sending' | 'sent' | 'manual' | 'error' | 'editing' | 'preparing' | 'checking';
export type VoiceDraft = {
  messageId: string; threadId: string; body: string; meaning?: string; state: VoiceDraftState;
  recipient?: string; channel?: string; deferred?: boolean;
  previous?: { body: string; meaning?: string };
};
export type VoiceNotice = 'thinking' | 'didnt-catch' | 'quiet-pause' | 'barge-in' | null;

/** An Approve card from voice (same approve-gated tools as text chat). Nothing changes until she taps Approve. */
export type VoiceAction = { id: string; summary: string; state: 'ready' | 'saving' | 'done' | 'error' };

type ToolKind = 'read' | 'draft' | 'propose' | 'summary';

async function runVoiceTool(workspaceId: string, name: string, raw: string, kinds: Map<string, ToolKind>, onDraft?: (d: VoiceDraft) => void, onCard?: (c: ToolCard) => void, chatThreadId?: string, onAction?: (a: VoiceAction) => void): Promise<string> {
  let args: any = {};
  try { args = raw ? JSON.parse(raw) : {}; } catch { args = {}; }
  // The server picks the tools (same set as text chat); the phone only runs what that session was given.
  // An older API without the tool list: the original voice tools (read tools, look_up_studio, draft_reply).
  const kind = kinds.size ? kinds.get(name) : name === 'draft_reply' ? 'draft' : name === 'look_up_studio' ? 'summary' : /^(get_|list_|search_|read_)/.test(name) ? 'read' : undefined;
  try {
    if (!kind) return JSON.stringify({ error: 'Unknown voice tool.' });
    if (kind === 'propose') {
      const { action } = await proposeVoiceAction(workspaceId, name, args ?? {});
      onAction?.({ id: action.id, summary: action.summary ?? name, state: 'ready' });
      return JSON.stringify({ proposed: true, saved: false, sent: false, summary: action.summary, note: 'An Approve card is on her screen. Nothing is saved or changed until she taps Approve.' });
    }
    if (name === 'look_up_studio') {
      const home = await getHomeSummary(workspaceId, 'day');
      if (args.topic === 'today') {
        return JSON.stringify({
          bookings: home.schedule.total,
          next: home.schedule.next ? { client: home.schedule.next.client, service: home.schedule.next.service, start: home.schedule.next.start_at } : null,
          items: home.schedule.items.slice(0, 8).map((item) => ({ client: item.client, service: item.service, start: item.start_at, status: item.status }))
        });
      }
      const conversations = home.messages.alerts.filter((item) => item.unread || item.needsReply).slice(0, 7).map((item) => ({ threadId: item.id, name: item.name, platform: item.platform, preview: item.preview, unread: item.unread, needsReply: item.needsReply }));
      return JSON.stringify({ unread: home.messages.unread, needsReply: home.messages.needsReply, conversations });
    }
    if (kind === 'read') {
      // Same shared read tools and switches as text chat. The card is drawn from this JSON, not from speech.
      const data = await apiFetch<Record<string, any>>(`/workspaces/${workspaceId}/ai/tools/${name}`, { method: 'POST', body: JSON.stringify(args ?? {}) });
      if (!data?.off) onCard?.({ tool: name, data });
      return JSON.stringify(data);
    }
    if (name === 'draft_reply') {
      const threadId = String(args.threadId ?? '');
      const body = String(args.body ?? '').trim();
      if (!threadId || !body) return JSON.stringify({ drafted: false, error: 'Missing the conversation or the reply.' });
      const meaning = String(args.meaning ?? '').trim() || undefined;
      if (chatThreadId && (threadId !== chatThreadId || !meaning)) return JSON.stringify({ drafted: false, error: 'Use the open conversation and include its plain English meaning.' });
      // Voice may only save a draft. Sending happens only when she taps Approve on the card.
      const result = await createMessageReply(workspaceId, threadId, body, false);
      onDraft?.({ messageId: result.message.id, threadId, body, meaning, state: 'ready' });
      return JSON.stringify({ drafted: true, sent: false, note: 'Draft saved. It is on her screen with an Approve button. It is not sent until she taps Approve.' });
    }
    return JSON.stringify({ error: 'Unknown voice tool.' });
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : 'That did not work.' });
  }
}

/** Realtime voice over WebRTC. Nothing is recorded or saved by AngelOS. */
export function useLiveVoice(workspaceId: string | null, screen?: string, context?: string, threadId?: string) {
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const pcRef = useRef<any>(null); const micRef = useRef<any>(null); const outRef = useRef<any>(null);
  const levelRef = useRef(0); const meterRef = useRef<{ stop: () => void } | null>(null);
  const mutedRef = useRef(false);
  const generation = useRef(0);
  const [drafts, setDrafts] = useState<VoiceDraft[]>([]);
  const [cards, setCards] = useState<ToolCard[]>([]);
  const addCard = useCallback((c: ToolCard) => setCards((list) => [...list.slice(-2), c]), []);
  const addDraft = useCallback((d: VoiceDraft) => setDrafts((list) => [...list.filter((x) => x.messageId !== d.messageId), d]), []);
  const patchDraft = (id: string, state: VoiceDraft['state']) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, state } : x)));
  async function approveDraft(id: string) {
    if (!workspaceId) return;
    patchDraft(id, 'sending');
    try { const r = await approveReply(workspaceId, id); patchDraft(id, r.sent ? 'sent' : 'manual'); } catch { patchDraft(id, 'error'); }
  }
  const dismissDraft = (id: string) => setDrafts((list) => list.filter((x) => x.messageId !== id));
  const deferDraft = (id: string) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, deferred: true } : x)));
  const restoreDraft = (id: string) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, deferred: false } : x)));
  const beginEdit = (id: string) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, state: 'editing', deferred: false, previous: x.previous ?? { body: x.body, meaning: x.meaning } } : x)));
  const cancelEdit = (id: string) => setDrafts((list) => list.map((x) => {
    if (x.messageId !== id) return x;
    const prev = x.previous;
    return { ...x, state: 'ready', body: prev?.body ?? x.body, meaning: prev?.meaning ?? x.meaning, previous: undefined };
  }));
  const setDraftMeaning = (id: string, meaning: string) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, meaning } : x)));
  const applyRevision = (id: string, body: string, meaning: string) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, body, meaning, state: 'ready', previous: undefined, deferred: false } : x)));
  const markDraft = (id: string, state: VoiceDraft['state']) => patchDraft(id, state);
  const annotateDraft = (id: string, extra: Partial<Pick<VoiceDraft, 'recipient' | 'channel'>>) => setDrafts((list) => list.map((x) => (x.messageId === id ? { ...x, ...extra } : x)));
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const addAction = useCallback((a: VoiceAction) => setActions((list) => [...list.filter((x) => x.id !== a.id), a]), []);
  const patchAction = (id: string, state: VoiceAction['state']) => setActions((list) => list.map((x) => (x.id === id ? { ...x, state } : x)));
  async function approveAction(id: string) {
    if (!workspaceId) return;
    patchAction(id, 'saving');
    try { await approveAiAction(workspaceId, id); patchAction(id, 'done'); } catch { patchAction(id, 'error'); }
  }
  function dismissAction(id: string) {
    setActions((list) => list.filter((x) => x.id !== id));
    if (workspaceId) void cancelAiAction(workspaceId, id).catch(() => undefined);
  }
  const kindsRef = useRef<Map<string, ToolKind>>(new Map());
  const sessionThreadRef = useRef(threadId);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<VoiceNotice>(null);
  const [ownerCaption, setOwnerCaption] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const dcRef = useRef<any>(null);
  const speakingRef = useRef(false);
  const processingRef = useRef(false);
  const getLevel = useCallback(() => levelRef.current, []);

  useEffect(() => {
    if (state !== 'live' || speaking || processing || paused) return;
    const timer = setTimeout(() => setNotice('quiet-pause'), 12000);
    return () => clearTimeout(timer);
  }, [state, speaking, processing, paused, ownerCaption, caption]);

  const sendEvent = useCallback((payload: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    try { dc.send(JSON.stringify(payload)); return true; } catch { return false; }
  }, []);

  const interrupt = useCallback(() => {
    sendEvent({ type: 'response.cancel' });
    speakingRef.current = false;
    processingRef.current = false;
    setSpeaking(false);
    setProcessing(false);
    setNotice('barge-in');
  }, [sendEvent]);

  const pause = useCallback(() => {
    try { micRef.current?.getTracks?.().forEach((t: any) => { t.enabled = false; }); } catch { /* keep paused */ }
    try { const out = outRef.current; if (out) { out.muted = true; out.pause?.(); } } catch { /* keep paused */ }
    speakingRef.current = false;
    processingRef.current = false;
    setSpeaking(false);
    setProcessing(false);
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!mutedRef.current) {
      try { micRef.current?.getTracks?.().forEach((t: any) => { t.enabled = true; }); } catch { /* stay paused visually if tracks fail */ }
    }
    try { const out = outRef.current; if (out) { out.muted = false; out.play?.(); } } catch { /* ignore */ }
    setPaused(false);
    setNotice(null);
  }, []);

  const teardown = useCallback(() => {
    // Invalidate pending session/mic requests as well as an established call.
    generation.current += 1;
    const meter = meterRef.current; const mic = micRef.current; const peer = pcRef.current; const out = outRef.current;
    meterRef.current = null; micRef.current = null; pcRef.current = null; outRef.current = null; dcRef.current = null;
    levelRef.current = 0;
    speakingRef.current = false; processingRef.current = false;
    setPaused(false); setProcessing(false); setNotice(null);
    // Detach first: native close events can arrive synchronously and re-enter cleanup.
    try { meter?.stop(); } catch { /* continue cleanup */ }
    try { mic?.getTracks?.().forEach((t: any) => t.stop()); } catch { /* continue cleanup */ }
    try { peer?.close?.(); } catch { /* continue cleanup */ }
    try { if (out) { out.srcObject = null; out.remove?.(); } } catch { /* continue cleanup */ }
    void stopVoiceAudio().catch(() => undefined);
    setMutedState(false); mutedRef.current = false;
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    teardown();
    setState('idle');
  }, [teardown]);

  const fail = useCallback((message: string) => {
    teardown();
    setState('error');
    setError(message);
  }, [teardown]);

  function setMuted(m: boolean) {
    setMutedState(m); mutedRef.current = m;
    try { micRef.current?.getTracks?.().forEach((t: any) => { t.enabled = !m; }); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!workspaceId) return;
    void getVoiceStatus(workspaceId)
      .then((session) => setStatus({ available: session.available, reason: session.reason }))
      .catch(() => setStatus({ available: false, reason: 'Voice status is not available right now.' }));
    return () => stop();
  }, [workspaceId, stop]);

  async function startOpenAI(secret: string, run: number) {
    const ensureCurrent = () => { if (generation.current !== run) throw new Error('Voice session closed.'); };
    const g: any = globalThis as any;
    await crumb('webrtc load');
    ensureCurrent();
    const audio = await startVoiceAudio();
    ensureCurrent();
    if (!audio.ok) throw new Error(audio.error ?? 'Could not start the microphone. Check Settings.');
    if (!g.RTCPeerConnection || !g.navigator?.mediaDevices?.getUserMedia) throw new Error('This device does not support live voice.');
    await crumb('new peer');
    ensureCurrent();
    const peer = new g.RTCPeerConnection({ iceServers: [] });
    pcRef.current = peer;
    if (Platform.OS === 'web') { const el = g.document.createElement('audio'); el.autoplay = true; outRef.current = el; peer.ontrack = (e: any) => { el.srcObject = e.streams[0]; }; }
    // iOS: open the play-and-record audio session before asking for the mic, or the track comes back silent.
    setLoudSpeaker(true);
    await crumb('mic');
    ensureCurrent();
    let stream: any;
    try { stream = await g.navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
    catch { throw new Error('Microphone is off for AngelOS. Turn it on in Settings, then try again.'); }
    if (generation.current !== run) { stream.getTracks().forEach((t: any) => t.stop()); ensureCurrent(); }
    if (mutedRef.current) stream.getTracks().forEach((t: any) => { t.enabled = false; });
    micRef.current = stream;
    await crumb('add track');
    ensureCurrent();
    stream.getTracks().forEach((t: any) => peer.addTrack(t, stream));
    await crumb('data channel');
    ensureCurrent();
    const dc = peer.createDataChannel('oai-events', { ordered: true, protocol: 'oai' });
    dcRef.current = dc;
    const answered = new Set<string>();
    dc.onmessage = (e: any) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'input_audio_buffer.speech_started') {
          if (speakingRef.current || processingRef.current) {
            sendEvent({ type: 'response.cancel' });
            speakingRef.current = false;
            processingRef.current = false;
            setSpeaking(false);
            setProcessing(false);
            setNotice('barge-in');
          } else {
            setNotice(null);
          }
        }
        if (ev.type === 'response.created' || ev.type === 'response.function_call_arguments.delta') {
          processingRef.current = true;
          setProcessing(true);
          setNotice('thinking');
        }
        if (/transcript(ion)?\.(done|completed)$/.test(ev.type ?? '')) {
          const spoken = typeof ev.transcript === 'string' ? ev.transcript.trim() : '';
          const isOwner = /input_audio_transcription/.test(ev.type ?? '');
          if (isOwner && !spoken) setNotice('didnt-catch');
          if (spoken) {
            if (isOwner) {
              setOwnerCaption(spoken);
              setNotice(null);
            } else {
              setCaption(spoken);
            }
            if (workspaceId && isOwner && (/\b(talk|speak|reply|respond|write|answer|chat)\b[\s\S]{0,40}\bin english\b/i.test(spoken) || /\b(use|switch to|keep|stay in)\s+english\b/i.test(spoken))) {
              void updateAssistantProfile(workspaceId, { primaryLanguage: 'en' }).catch(() => undefined);
            }
          }
        }
        if (ev.type === 'response.audio_transcript.delta' || ev.type === 'response.output_audio_transcript.delta') {
          if (typeof ev.delta === 'string' && ev.delta) setCaption((c) => (c ?? '') + ev.delta);
        }
        if (ev.type === 'output_audio_buffer.started' || ev.type === 'response.output_audio.delta' || ev.type === 'response.audio.delta') {
          speakingRef.current = true; processingRef.current = false;
          setSpeaking(true); setProcessing(false); setNotice(null);
        }
        if (ev.type === 'output_audio_buffer.stopped' || ev.type === 'response.done' || ev.type === 'response.output_audio.done') {
          speakingRef.current = false; processingRef.current = false;
          setSpeaking(false); setProcessing(false);
        }
        const call = voiceToolCall(ev);
        if (generation.current !== run || !call || !workspaceId || answered.has(call.callId)) return;
        answered.add(call.callId);
        const studioId = workspaceId;
        void runVoiceTool(studioId, call.name, call.args, kindsRef.current, addDraft, addCard, sessionThreadRef.current, addAction).then((output) => {
          if (dc.readyState !== 'open') return;
          dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output } }));
          dc.send(JSON.stringify({ type: 'response.create' }));
        }).catch(() => undefined);
      } catch { /* ignore */ }
    };
    await crumb('offer');
    ensureCurrent();
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    ensureCurrent();
    await peer.setLocalDescription(offer);
    ensureCurrent();
    await crumb('openai call');
    ensureCurrent();
    const res = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' } });
    ensureCurrent();
    if (!res.ok) throw new Error(`Voice could not connect (${res.status}).`);
    const answer = await res.text();
    ensureCurrent();
    await crumb('answer');
    ensureCurrent();
    await peer.setRemoteDescription(Platform.OS === 'web' ? { type: 'answer', sdp: answer } : new g.RTCSessionDescription({ type: 'answer', sdp: answer }));
    ensureCurrent();
    await crumb('meter');
    ensureCurrent();
    meterRef.current = startMeter({ pc: peer, mic: stream, out: () => outRef.current?.srcObject ?? null }, levelRef, mutedRef);
    peer.addEventListener?.('connectionstatechange', () => { if (pcRef.current === peer && ['failed', 'closed'].includes(peer.connectionState)) fail('Voice connection was interrupted.'); });
    await crumb('live');
    ensureCurrent();
    setLoudSpeaker(true);
    setState('live');
  }

  async function start(next?: { screen?: string; context?: string; threadId?: string }) {
    stop();
    const run = generation.current;
    const s = next?.screen ?? screen;
    const c = next?.context ?? context;
    const t = next?.threadId ?? threadId;
    sessionThreadRef.current = t;
    installCrashGuard();
    setError(null);
    setSpeaking(false);
    setPaused(false);
    setNotice(null);
    setProcessing(false);
    setState('connecting');
    try {
      if (!workspaceId) throw new Error('No studio selected.');
      await crumb('session');
      const session = await createVoiceSession(workspaceId, s, c, t);
      if (generation.current !== run) return;
      setStatus({ available: session.available, reason: session.reason });
      if (!session.available) throw new Error(session.reason ?? 'Live voice is off.');
      if (!session.clientSecret) throw new Error('Voice is not available right now.');
      kindsRef.current = new Map((session.tools ?? []).map((t) => [t.name, t.kind] as [string, ToolKind]));
      await startOpenAI(session.clientSecret, run);
    } catch (e) {
      if (generation.current !== run) return;
      await crumb(`caught: ${e instanceof Error ? e.message : String(e)}`);
      if (generation.current !== run) return;
      stop();
      setState('error');
      setError(e instanceof Error ? e.message : 'Voice could not start. Check microphone permission in Settings.');
    }
  }

  return { status, state, error, start, stop, interrupt, pause, resume, paused, notice, processing, ownerCaption, muted, setMuted, caption, speaking, getLevel, drafts, approveDraft, dismissDraft, deferDraft, restoreDraft, beginEdit, cancelEdit, setDraftMeaning, applyRevision, markDraft, annotateDraft, cards, actions, approveAction, dismissAction };
}

export function LiveVoice({ workspaceId, screen }: { workspaceId: string; screen?: string }) {
  const { t } = useTranslation();
  const { status, state, error, start, stop } = useLiveVoice(workspaceId, screen);
  return <Card>
    <SectionTitle>{t('lv.s0')}</SectionTitle>
    {status && !status.available ? <Banner>{status.reason ?? 'Live voice is off.'}</Banner> : null}
    {status?.available ? <>
      {state === 'live' ? <Pill tone="success">{t('lv.s1')}</Pill> : null}
      <ActionButton kind={state === 'live' ? 'secondary' : 'primary'} label={state === 'live' ? 'Stop' : state === 'connecting' ? 'Connecting…' : 'Start talking'} disabled={state === 'connecting'} accessibilityHint="Uses your microphone. Nothing is recorded or saved." onPress={() => (state === 'live' ? stop() : void start())} />
    </> : null}
    {error ? <>
      <SupportText tone="warning">{error}</SupportText>
      <ActionButton kind="secondary" label="Open Settings" onPress={() => void Linking.openSettings()} />
    </> : null}
    <SupportText>{t('lv.s2')}</SupportText>
  </Card>;
}

export const shape = (a: number) => (Number.isFinite(a) ? Math.min(1, Math.sqrt(Math.max(0, a)) * 1.9) : 0);

function startMeter(src: { pc?: any; mic?: any; out?: () => any }, level: { current: number }, muted: { current: boolean }) {
  const g: any = globalThis as any; let stopped = false; const cleanups: Array<() => void> = [];
  let web: { read: () => number } | null = null;
  if (Platform.OS === 'web' && src.pc && g.AudioContext) {
    try {
      const ctx = new g.AudioContext(); cleanups.push(() => void ctx.close());
      const make = (stream: any) => { const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize); return () => { an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]; return Math.sqrt(sum / buf.length) * 2.2; }; };
      const mic = src.mic ? make(src.mic) : () => 0; let out: (() => number) | null = null;
      web = { read: () => { if (!out) { const st = src.out?.(); if (st) { try { out = make(st); } catch { out = () => 0; } } } return Math.max(muted.current ? 0 : mic(), out ? out() : 0); } };
    } catch { web = null; }
  }
  const tick = async () => {
    if (stopped) return;
    try {
      if (web) level.current = shape(web.read());
      else if (src.pc?.getStats && src.pc.connectionState !== 'closed' && src.pc.signalingState !== 'closed') {
        const stats = await src.pc.getStats(); let mic = 0; let out = 0;
        stats.forEach((r: any) => { if (r.kind !== 'audio' && r.mediaType !== 'audio') return; if (r.type === 'media-source' && typeof r.audioLevel === 'number') mic = r.audioLevel; if (r.type === 'inbound-rtp' && typeof r.audioLevel === 'number') out = r.audioLevel; });
        level.current = shape(Math.max(muted.current ? 0 : mic, out));
      }
    } catch { /* keep last level */ }
    if (!stopped) timer = setTimeout(() => void tick(), web ? 16 : 50);
  };
  let timer: any = setTimeout(() => void tick(), 0);
  return { stop: () => { stopped = true; clearTimeout(timer); cleanups.forEach((f) => f()); level.current = 0; } };
}
