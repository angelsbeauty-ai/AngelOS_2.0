import { AudioSession, registerGlobals } from '@livekit/react-native';

registerGlobals();

export async function startVoiceAudio() {
  await AudioSession.startAudioSession();
}

export async function stopVoiceAudio() {
  await AudioSession.stopAudioSession();
}
