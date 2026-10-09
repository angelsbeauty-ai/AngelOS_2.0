/**
 * C2: one short "brand voice" line built from her reply style settings (and what AngelOS learned from her replies).
 * Added to captions, LINE broadcasts and assistant drafts so everything sounds like her. Pure function.
 */
export interface VoiceSettings { reply_tone?: string | null; emoji_level?: string | null; reply_length?: string | null; style_notes?: string | null; learned?: any; learn_from_replies?: boolean | null }

const TONES: Record<string, string> = { casual_friendly: 'casual and friendly', warm_polite: 'warm and polite', professional: 'calm and professional', playful: 'playful and fun' };
const EMOJI: Record<string, string> = { none: 'no emoji', light: '1-2 emoji at most', lots: 'a few emoji are welcome' };
const LENGTH: Record<string, string> = { short: 'keep it short', medium: 'medium length', detailed: 'a bit more detail is fine' };

export function brandVoiceLine(style: VoiceSettings | null | undefined): string {
  if (!style) return '';
  const parts = [
    TONES[style.reply_tone ?? ''] ? `tone: ${TONES[style.reply_tone!]}` : '',
    EMOJI[style.emoji_level ?? ''] ? EMOJI[style.emoji_level!] : '',
    LENGTH[style.reply_length ?? ''] ? LENGTH[style.reply_length!] : ''
  ].filter(Boolean);
  const learned = style.learn_from_replies === false ? null : style.learned;
  if (learned?.topEmojis?.length && style.emoji_level !== 'none') parts.push(`her usual emoji: ${learned.topEmojis.slice(0, 3).join(' ')}`);
  const notes = String(style.style_notes ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (notes) parts.push(`her notes: ${notes}`);
  return parts.length ? `BRAND VOICE (write like the owner): ${parts.join('; ')}.` : '';
}
