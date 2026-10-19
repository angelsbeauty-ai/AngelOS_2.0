import { Platform } from 'react-native';
import { AudioSession, registerGlobals } from '@livekit/react-native';

let globalsReady = false;

function ensureGlobals() {
  if (globalsReady) return;
  try {
    registerGlobals();
    globalsReady = true;
  } catch {
    // Leave globalsReady false so a later start can retry.
  }
}

/** Speaker, then an active session, before getUserMedia. LiveKit's WebRTC crashes on iPhone if the mic opens first. */
export async function startVoiceAudio(): Promise<{ ok: boolean; error?: string }> {
  try {
    ensureGlobals();
    if (Platform.OS === 'ios') {
      await AudioSession.configureAudio({ ios: { defaultOutput: 'speaker' } });
    }
    await AudioSession.startAudioSession();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not start the microphone.' };
  }
}

export async function stopVoiceAudio() {
  try {
    await AudioSession.stopAudioSession();
  } catch {
    /* ignore */
  }
}
