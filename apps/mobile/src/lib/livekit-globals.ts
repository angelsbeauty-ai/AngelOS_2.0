import { Platform } from 'react-native';

/** OpenAI Realtime voice. No LiveKit. WebRTC globals come from react-native-webrtc on iOS. */
export async function startVoiceAudio(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (Platform.OS !== 'web') {
      const webrtc = await import('react-native-webrtc');
      if (typeof (webrtc as any).registerGlobals === 'function') {
        (webrtc as any).registerGlobals();
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not start the microphone.' };
  }
}

export async function stopVoiceAudio() {
  // No LiveKit audio session to stop.
}
