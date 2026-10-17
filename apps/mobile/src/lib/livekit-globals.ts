import { Platform } from 'react-native';
import { AudioSession, registerGlobals } from '@livekit/react-native';

registerGlobals();

/** Speaker, then an active session, before getUserMedia. LiveKit's WebRTC crashes on iPhone if the mic opens first. */
export async function startVoiceAudio() {
  if (Platform.OS === 'ios') await AudioSession.configureAudio({ ios: { defaultOutput: 'speaker' } });
  await AudioSession.startAudioSession();
}

export async function stopVoiceAudio() {
  await AudioSession.stopAudioSession();
}
