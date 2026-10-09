/** Small, dependency-free language helpers for client-facing messages (EN / JA only in V1). */
const JA_CHARS = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/g;
const LATIN_WORDS = /[A-Za-z]{2,}/g;

export type ClientLanguage = 'en' | 'ja';

export function detectLanguage(text: string | null | undefined): ClientLanguage | null {
  const value = String(text ?? '');
  const ja = (value.match(JA_CHARS) ?? []).length;
  const latin = (value.match(LATIN_WORDS) ?? []).length;
  if (ja === 0 && latin === 0) return null;
  if (ja >= 2) return 'ja';
  return latin > 0 ? 'en' : null;
}

/** The reply language always matches the client: their latest message first, then their profile. */
export function chooseReplyLanguage(latestInbound: string | null | undefined, clientLanguage: string | null | undefined): ClientLanguage {
  const detected = detectLanguage(latestInbound);
  if (detected) return detected;
  return String(clientLanguage ?? '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/**
 * True when a client message mixes English and Japanese (Angel's rule: never both in one message).
 * Brand names or a booking link are fine; a run of 4+ English words in a Japanese message is not,
 * and any Japanese in an English message is not.
 */
export function mixesLanguages(text: string, language: ClientLanguage): boolean {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, ' ');
  if (language === 'en') return (withoutUrls.match(JA_CHARS) ?? []).length > 0;
  return /[A-Za-z]{2,}[,.!?]?(\s+[A-Za-z]{2,}[,.!?]?){3,}/.test(withoutUrls);
}

export function firstName(displayName: string | null | undefined): string {
  const value = String(displayName ?? '').trim();
  if (!value) return '';
  if (detectLanguage(value) === 'ja') return value.split(/[\s\u3000]+/)[0];
  return value.split(/\s+/)[0];
}
