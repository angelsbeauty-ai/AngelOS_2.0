import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Room, RoomEvent, Track } from 'livekit-client';
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

/**
 * Live voice. With LiveKit keys the server opens a LiveKit room; otherwise it mints a 2-minute OpenAI Realtime key and
 * the device talks to OpenAI directly over WebRTC.
 * Nothing is recorded or saved by AngelOS.
 */
export function useLiveVoice(workspaceId: string | null, screen?: string, context?: string) {
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const pcRef = useRef<any>(null); const micRef = useRef<any>(null); const outRef = useRef<any>(null);
  const audioRef = useRef<HTMLMediaElement[]>([]);

  function stop() {
    const room = roomRef.current;
    roomRef.current = null;
    audioRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioRef.current = [];
    void room?.disconnect();
    try { micRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch { /* ignore */ }
    try { pcRef.current?.close?.(); } catch { /* ignore */ }
    if (outRef.current) { outRef.current.srcObject = null; outRef.current.remove?.(); }
    pcRef.current = null; micRef.current = null; outRef.current = null;
    void stopVoiceAudio();
    setMutedState(false);
    setState('idle');
  }

  /** Mute only the microphone; the session stays open. */
  function setMuted(m: boolean) {
    setMutedState(m);
    try { micRef.current?.getTracks?.().forEach((t: any) => { t.enabled = !m; }); } catch { /* ignore */ }
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!m).catch(() => undefined);
  }

  useEffect(() => {
    if (!workspaceId) return;
    void getVoiceStatus(workspaceId)
      .then((session) => setStatus({ available: session.available, reason: session.reason }))
      .catch(() => setStatus({ available: false, reason: 'Voice status is not available right now.' }));
    return () => stop();
  }, [workspaceId]);

  /** OpenAI Realtime over WebRTC: the browser's WebRTC on web, LiveKit's native react-native-webrtc on iPhone (globals registered). */
  async function startOpenAI(secret: string) {
    const g: any = globalThis as any;
    if (!g.RTCPeerConnection || !g.navigator?.mediaDevices?.getUserMedia) throw new Error('This device does not support live voice.');
    await startVoiceAudio();
    const peer = new g.RTCPeerConnection();
    pcRef.current = peer;
    if (Platform.OS === 'web') { const el = g.document.createElement('audio'); el.autoplay = true; outRef.current = el; peer.ontrack = (e: any) => { el.srcObject = e.streams[0]; }; }
    // On iPhone the remote audio track plays through the audio session automatically.
    const stream = await g.navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micRef.current = stream;
    stream.getTracks().forEach((t: any) => peer.addTrack(t, stream));
    const dc = peer.createDataChannel('oai-events');
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
        });
      } catch { /* ignore */ }
    };
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    const res = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' } });
    if (!res.ok) throw new Error(`Voice could not connect (${res.status}).`);
    const answer = await res.text();
    await peer.setRemoteDescription(Platform.OS === 'web' ? { type: 'answer', sdp: answer } : new g.RTCSessionDescription({ type: 'answer', sdp: answer }));
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
      if (session.clientSecret) { await startOpenAI(session.clientSecret); return; }
      if (!session.url || !session.token) throw new Error(session.reason ?? 'Live voice is off.');
      await startVoiceAudio();
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio || Platform.OS !== 'web') return;
        const el = track.attach();
        el.autoplay = true;
        document.body.appendChild(el);
        audioRef.current.push(el);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) stop();
      });
      await room.connect(session.url, session.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setState('live');
    } catch (e) {
      stop();
      setState('error');
      setError(e instanceof Error ? e.message : 'Voice could not start.');
    }
  }

  return { status, state, error, start, stop, muted, setMuted, caption };
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
    {error ? <SupportText tone="warning">{error}</SupportText> : null}
    <SupportText>{t('lv.s2')}</SupportText>
  </Card>;
}
