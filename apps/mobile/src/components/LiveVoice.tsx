import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ActionButton, Banner } from './MessagingBits';
import { Card, Pill, SectionTitle, SupportText } from './ui';
import { createVoiceSession, getVoiceStatus } from '../lib/ai';

type State = 'idle' | 'connecting' | 'live' | 'error';

/**
 * Live voice with AngelOS (web). The server mints a 2-minute key; the browser talks to OpenAI directly over WebRTC.
 * Nothing is recorded: no MediaRecorder, no transcript events kept, nothing saved by AngelOS.
 */
export function LiveVoice({ workspaceId, screen }: { workspaceId: string; screen?: string }) {
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const pc = useRef<any>(null);
  const mic = useRef<any>(null);
  const audio = useRef<any>(null);

  useEffect(() => { void getVoiceStatus(workspaceId).then(setStatus).catch(() => setStatus({ available: false, reason: 'Voice status is not available right now.' })); return () => stop(); }, [workspaceId]);

  function stop() {
    try { mic.current?.getTracks?.().forEach((t: any) => t.stop()); } catch { /* ignore */ }
    try { pc.current?.close?.(); } catch { /* ignore */ }
    if (audio.current) { audio.current.srcObject = null; audio.current.remove?.(); }
    pc.current = null; mic.current = null; audio.current = null;
    setState('idle');
  }

  async function start() {
    setError(null); setState('connecting');
    try {
      const g: any = globalThis as any;
      if (!g.RTCPeerConnection || !g.navigator?.mediaDevices?.getUserMedia) throw new Error('This browser does not support live voice.');
      const session = await createVoiceSession(workspaceId, screen);
      if (!session.available || !session.clientSecret) throw new Error(session.reason ?? 'Live voice is off.');
      const peer = new g.RTCPeerConnection();
      pc.current = peer;
      const el = g.document.createElement('audio'); el.autoplay = true; audio.current = el;
      peer.ontrack = (e: any) => { el.srcObject = e.streams[0]; };
      const stream = await g.navigator.mediaDevices.getUserMedia({ audio: true });
      mic.current = stream;
      stream.getTracks().forEach((t: any) => peer.addTrack(t, stream));
      peer.createDataChannel('oai-events'); // events are not saved anywhere
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const res = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${session.clientSecret}`, 'Content-Type': 'application/sdp' } });
      if (!res.ok) throw new Error(`Voice could not connect (${res.status}).`);
      await peer.setRemoteDescription({ type: 'answer', sdp: await res.text() });
      peer.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) stop(); };
      setState('live');
    } catch (e) {
      stop(); setState('error');
      setError(e instanceof Error ? e.message : 'Voice could not start.');
    }
  }

  return <Card>
    <SectionTitle>Talk to AngelOS</SectionTitle>
    {Platform.OS !== 'web' ? <SupportText>Live voice works in the web app for now (the phone app needs a native audio module first).</SupportText> : null}
    {Platform.OS === 'web' && status && !status.available ? <Banner>{status.reason ?? 'Live voice is off.'}</Banner> : null}
    {Platform.OS === 'web' && status?.available ? <>
      {state === 'live' ? <Pill tone="success">Listening… speak any time</Pill> : null}
      <ActionButton kind={state === 'live' ? 'secondary' : 'primary'} label={state === 'live' ? 'Stop' : state === 'connecting' ? 'Connecting…' : 'Start talking'} disabled={state === 'connecting'} accessibilityHint="Uses your microphone. Nothing is recorded or saved." onPress={() => (state === 'live' ? stop() : void start())} />
    </> : null}
    {error ? <SupportText tone="warning">{error}</SupportText> : null}
    <SupportText>Your voice is never recorded or saved, and no transcript is kept. To change bookings, money or posts, type it in the chat so you get an approval card.</SupportText>
  </Card>;
}
