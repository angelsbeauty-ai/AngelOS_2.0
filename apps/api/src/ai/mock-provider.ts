import type { AiProviderRequest } from './ai.types';

/**
 * Deterministic mock outputs for task-shaped prompts (no network, no cost).
 * Returns null when the prompt is not one of the known tasks.
 */
export function mockTaskResponse(request: AiProviderRequest): string | null {
  const instructions = request.instructions ?? '';
  if (instructions.startsWith('TRANSLATE_TO=')) {
    const target = instructions.slice('TRANSLATE_TO='.length).split('\n')[0].trim();
    return `(mock translation to ${target}) ${request.input}`;
  }
  if (instructions.startsWith('CLIENT_REPLY_DRAFT')) {
    const language = /language=(ja|en)/.exec(instructions)?.[1] ?? 'en';
    const name = /Client name: ([^\n.(]*)/.exec(instructions)?.[1]?.trim() ?? '';
    const saved = /SAVED_REPLY_MATCH:\s*(.+)/.exec(instructions)?.[1]?.trim();
    if (saved) return saved.replace(/\{name\}/g, name);
    if (language === 'ja') return `${name ? `${name}さん、` : ''}メッセージありがとうございます✨ 確認してすぐにお返事しますね🌸`;
    return `Hi ${name || 'there'}, thank you for your message! Let me check and get back to you shortly.`;
  }
  if (instructions.startsWith('POST_CAPTION_DRAFT')) {
    const language = /language=(ja|en)/.exec(instructions)?.[1] ?? 'en';
    const angle = /angle=([^\n]+)/.exec(instructions)?.[1]?.trim() ?? 'healed results';
    if (language === 'ja') return `自然な仕上がりの眉で、毎朝のメイクがぐっと楽に✨ ご予約・ご相談はLINEからお気軽にどうぞ🌸`;
    return `Natural, soft results that make mornings easier. Focus: ${angle}. Message us to book your consultation.`;
  }
  return null;
}
