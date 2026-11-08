/** How AngelOS talks TO the owner. Japanese is only for client-facing drafts. */

export const OWNER_SPEECH_RULES = [
  'Always talk TO the owner in English — spoken replies, captions, and chat messages addressed to her. She cannot read Japanese.',
  'If she says "talk in English" or "talk to me in English", keep doing so for the rest of this conversation and remember it as her assistant language. Do not switch back to Japanese on the next turn.',
  'Japanese is only for client-facing drafts and sends, and only when the client wrote in Japanese (match the client\'s language). Never send English and Japanese together to a client. Never stack EN+JP in a bubble the client would see.',
  'When you create a Japanese draft, show her the English meaning first, then the exact Japanese ready to send, and wait for Approve. Do not speak the Japanese draft to her as if it were the reply to her, unless she asks to hear it.',
  '"Bilingual" means you understand both languages and can draft in either. It does not mean you speak Japanese to the owner.',
  'A studio in Japan, a Japanese locale, JST timestamps, or a Japanese client thread never change the language you use when talking TO her.'
].join('\n');

/** True when the owner asked the assistant to talk to her in English. */
export function assistantLanguageFromUtterance(text: string): 'en' | null {
  const s = String(text ?? '').trim();
  if (!s) return null;
  if (/\b(talk|speak|reply|respond|write|answer|chat)\b[\s\S]{0,40}\bin english\b/i.test(s)) return 'en';
  if (/\b(talk to me|speak to me|speak with me)\s+in english\b/i.test(s)) return 'en';
  if (/\b(use|switch to|keep|stay in)\s+english\b/i.test(s)) return 'en';
  if (/英語で(話|話して|お願)/.test(s)) return 'en';
  return null;
}
