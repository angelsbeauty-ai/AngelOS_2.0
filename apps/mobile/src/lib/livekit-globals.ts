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

/** Play the assistant through the main loudspeaker (iPhone defaults voice calls to the quiet earpiece). */
export function setLoudSpeaker(on: boolean) {
  if (Platform.OS === 'web') return;
  try {
    const InCallManager = require('react-native-incall-manager').default;
    if (on) { InCallManager.start({ media: 'audio' }); InCallManager.setForceSpeakerphoneOn(true); }
    else { InCallManager.setForceSpeakerphoneOn(false); InCallManager.stop(); }
  } catch { /* never crash voice over speaker routing */ }
}

export async function stopVoiceAudio() {
  setLoudSpeaker(false);
}
