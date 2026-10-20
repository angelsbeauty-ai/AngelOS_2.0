import { useRef, useState } from 'react';
import { setAudioModeAsync } from 'expo-audio';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

/**
 * Hold-to-dictate for the chat composer. Speech is turned into text and only fills the draft field.
 * It never sends: sending stays a separate tap on the send button. No audio is saved.
 */
export function useDictation(getText: () => string, setText: (text: string) => void, lang: 'en' | 'ja') {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useRef('');
  const active = useRef(false);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => { active.current = false; setListening(false); void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined); });
  useSpeechRecognitionEvent('result', (event) => {
    if (!active.current && !listening) return;
    const said = event.results?.[0]?.transcript?.trim() ?? '';
    if (!said) return;
    const prefix = base.current.trim();
    setText(prefix ? `${prefix}${lang === 'ja' ? '' : ' '}${said}` : said);
  });
  useSpeechRecognitionEvent('error', (event) => {
    active.current = false; setListening(false);
    if (event.error !== 'aborted' && event.error !== 'no-speech') setError(event.error === 'not-allowed' ? 'permission' : 'failed');
  });

  async function start() {
    setError(null);
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setError('permission'); return; }
      await setAudioModeAsync({ allowsRecording: true }).catch(() => undefined);
      base.current = getText();
      active.current = true;
      ExpoSpeechRecognitionModule.start({ lang: lang === 'ja' ? 'ja-JP' : 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
    } catch { active.current = false; setListening(false); setError('failed'); }
  }

  function stop() {
    if (!active.current && !listening) return;
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  }

  return { listening, error, start, stop, clearError: () => setError(null) };
}
