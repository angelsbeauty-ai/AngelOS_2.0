import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Room, RoomEvent, Track } from 'livekit-client';
import { ActionButton, Banner } from './MessagingBits';
import { Card, Pill, SectionTitle, SupportText } from './ui';
import { createVoiceSession, getVoiceStatus } from '../lib/ai';
import { startVoiceAudio, stopVoiceAudio } from '../lib/livekit-globals';

type State = 'idle' | 'connecting' | 'live' | 'error';

/**
 * Live voice. The server opens a LiveKit room. Deepgram listens, OpenAI answers, Cartesia speaks.
 * Nothing is recorded or saved by AngelOS.
 */
export function useLiveVoice(workspaceId: string | null, screen?: string, context?: string) {
  const [status, setStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLMediaElement[]>([]);

  function stop() {
    const room = roomRef.current;
    roomRef.current = null;
    audioRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioRef.current = [];
    void room?.disconnect();
    void stopVoiceAudio();
    setState('idle');
  }

  useEffect(() => {
    if (!workspaceId) return;
    void getVoiceStatus(workspaceId)
      .then((session) => setStatus({ available: session.available, reason: session.reason }))
      .catch(() => setStatus({ available: false, reason: 'Voice status is not available right now.' }));
    return () => stop();
  }, [workspaceId]);

  async function start() {
    setError(null);
    setState('connecting');
    try {
      if (!workspaceId) throw new Error('No studio selected.');
      const session = await createVoiceSession(workspaceId, screen, context);
      setStatus({ available: session.available, reason: session.reason });
      if (!session.available || !session.url || !session.token) throw new Error(session.reason ?? 'Live voice is off.');
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

  return { status, state, error, start, stop };
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
