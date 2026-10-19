/** OpenAI Realtime voice. No LiveKit, no react-native-webrtc. Web uses the browser; iOS relies on any globals already present. */
export async function startVoiceAudio(): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function stopVoiceAudio() {
  // nothing to stop
}
