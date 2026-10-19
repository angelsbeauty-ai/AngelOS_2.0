import { Platform } from 'react-native';
import { AudioSession, registerGlobals } from '@livekit/react-native';

try {
  registerGlobals();
} catch {
  // Never let a native globals registration kill the app on import.
}

/** Speaker, then an active session, before getUserMedia. LiveKit's WebRTC crashes on iPhone if the mic opens first. */
export async function startVoiceAudio(): Promise<{ ok: boolean; error?: string }> {
  try {
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
