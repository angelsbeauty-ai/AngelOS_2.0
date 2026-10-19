import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { ActionButton, Banner } from './MessagingBits';
import { Card, Pill, SectionTitle, SupportText } from './ui';
import { createVoiceSession, getVoiceStatus } from '../lib/ai';
import { getHomeSummary } from '../lib/home';
import { createMessageReply } from '../lib/messaging';
import { startVoiceAudio, stopVoiceAudio } from '../lib/livekit-globals';

type State = 'idle' | 'connecting' | 'live' | 'error';

function voiceToolCall(ev: any): { name: string; callId: string; args: string } | null {
  if (ev?.type === 'response.function_call_arguments.done' && ev.name && ev.call_id) return { name: ev.name, callId: ev.call_id, args: ev.arguments ?? '{}' };
  const item = ev?.item ?? ev?.output_item;
  if (item?.type === 'function_call' && item.name && item.call_id && item.arguments && /output_item\.done$/.test(ev?.type ?? '')) return { name: item.name, callId: item.call_id, args: item.arguments };
  return null;
}

async function runVoiceTool(workspaceId: string, name: string, raw: string): Promise<string> {
  let args: any = {};
  try { args = raw ? JSON.parse(raw) : {}; } catch { args = {}; }
  try {
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
    if (name === 'send_reply') {
      const threadId = String(args.threadId ?? '');
      const body = String(args.body ?? '').trim();
      if (!threadId || !body) return JSON.stringify({ sent: false, error: 'Missing the conversation or the reply.' });
      const result = await createMessageReply(workspaceId, threadId, body, true);
      return JSON.stringify({ sent: result.sent, delivery: result.delivery ?? (result.sent ? 'sent' : 'manual') });
    }
    return JSON.stringify({ error: 'Unknown voice tool.' });
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : 'That did not work.' });
  }
}

/** OpenAI Realtime voice over WebRTC. Nothing is recorded or saved by AngelOS. */
export function useLiveVoice(workspaceId: string | null, screen?: string, context?: string) {
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const pcRef = useRef<any>(null); const micRef = useRef<any>(null); const outRef = useRef<any>(null);
  const levelRef = useRef(0); const meterRef = useRef<{ stop: () => void } | null>(null);
  const mutedRef = useRef(false);
  const getLevel = useCallback(() => levelRef.current, []);

  function stop() {
    meterRef.current?.stop(); meterRef.current = null; levelRef.current = 0;
    try { micRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch { /* ignore */ }
    try { pcRef.current?.close?.(); } catch { /* ignore */ }
    if (outRef.current) { outRef.current.srcObject = null; outRef.current.remove?.(); }
    pcRef.current = null; micRef.current = null; outRef.current = null;
    void stopVoiceAudio().catch(() => undefined);
    setMutedState(false);
    setState('idle');
  }

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
  }, [workspaceId]);

  async function startOpenAI(secret: string) {
    const g: any = globalThis as any;
    const audio = await startVoiceAudio();
    if (!audio.ok) throw new Error(audio.error ?? 'Could not start the microphone. Check Settings.');
    if (!g.RTCPeerConnection || !g.navigator?.mediaDevices?.getUserMedia) throw new Error('This device does not support live voice.');
    const peer = new g.RTCPeerConnection({ iceServers: [] });
    pcRef.current = peer;
    if (Platform.OS === 'web') { const el = g.document.createElement('audio'); el.autoplay = true; outRef.current = el; peer.ontrack = (e: any) => { el.srcObject = e.streams[0]; }; }
    const stream = await g.navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micRef.current = stream;
    stream.getTracks().forEach((t: any) => peer.addTrack(t, stream));
    const dc = peer.createDataChannel('oai-events', { ordered: true, protocol: 'oai' });
    const answered = new Set<string>();
    dc.onmessage = (e: any) => {
      try {
        const ev = JSON.parse(e.data);
        if (/transcript(ion)?\.(done|completed)$/.test(ev.type ?? '') && typeof ev.transcript === 'string' && ev.transcript.trim()) setCaption(ev.transcript.trim());
        const call = voiceToolCall(ev);
        if (!call || !workspaceId || answered.has(call.callId)) return;
        answered.add(call.callId);
        const studioId = workspaceId;
        void runVoiceTool(studioId, call.name, call.args).then((output) => {
          if (dc.readyState !== 'open') return;
          dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output } }));
          dc.send(JSON.stringify({ type: 'response.create' }));
        }).catch(() => undefined);
      } catch { /* ignore */ }
    };
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    const res = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' } });
    if (!res.ok) throw new Error(`Voice could not connect (${res.status}).`);
    const answer = await res.text();
    await peer.setRemoteDescription(Platform.OS === 'web' ? { type: 'answer', sdp: answer } : new g.RTCSessionDescription({ type: 'answer', sdp: answer }));
    meterRef.current = startMeter({ pc: peer, mic: stream, out: () => outRef.current?.srcObject ?? null }, levelRef, mutedRef);
    peer.addEventListener?.('connectionstatechange', () => { if (['failed', 'closed'].includes(peer.connectionState)) stop(); });
    setState('live');
  }

  async function start() {
    setError(null);
    setState('connecting');
    try {
      if (!workspaceId) throw new Error('No studio selected.');
      const session = await createVoiceSession(workspaceId, screen, context);
      setStatus({ available: session.available, reason: session.reason });
      if (!session.available) throw new Error(session.reason ?? 'Live voice is off.');
      if (!session.clientSecret) throw new Error('Voice is not available right now.');
      await startOpenAI(session.clientSecret);
    } catch (e) {
      stop();
      setState('error');
      setError(e instanceof Error ? e.message : 'Voice could not start. Check microphone permission in Settings.');
    }
  }

  return { status, state, error, start, stop, muted, setMuted, caption, getLevel };
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
