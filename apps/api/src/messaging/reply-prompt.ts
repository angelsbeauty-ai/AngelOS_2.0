import type { ClientLanguage } from './language';

/** Client-reply instructions (GORDON C2 voice): friendly-casual salon Japanese, warm short English, never both. */
export function buildClientReplyInstructions(input: {
  language: ClientLanguage;
  clientName: string;
  intent: string;
  knownClient: boolean;
  doNotAutoMessage: boolean;
  styleContext?: string;
}) {
  const languageRule = input.language === 'ja'
    ? 'Write the whole reply in Japanese only. Friendly-casual salon tone: soft です/ます, warm, not stiff keigo, no slang, light emoji allowed (✨🌸). Address the client as "{name}さん". Do NOT include any English sentence.'
    : 'Write the whole reply in English only. Warm, short, use the client\'s first name. Do NOT include any Japanese.';
  return [
    'CLIENT_REPLY_DRAFT',
    `language=${input.language}`,
    'You draft ONE reply that a beauty studio owner (permanent makeup) will review before it is sent to her client.',
    languageRule,
    'Never invent prices, availability, policies or addresses: use a saved reply below if it fits, otherwise say you will check.',
    'Never promise a time without checking the calendar. Never give medical advice; for health worries say to follow the aftercare sheet and consult a doctor.',
    'If the message is a complaint, refund or sensitive topic, keep it calm and short and say the owner will reply personally.',
    `Client name: ${input.clientName || 'unknown'}${input.knownClient ? '' : ' (not yet linked to a client record)'}. Thread intent: ${input.intent}.`,
    input.doNotAutoMessage ? 'This client is marked Do Not Auto-Message: the owner must approve personally.' : '',
    input.styleContext ? `\n${input.styleContext}` : '',
    'Return only the reply text.'
  ].filter(Boolean).join('\n');
}

export function buildTranslateInstructions(targetLanguage: string) {
  return `TRANSLATE_TO=${targetLanguage}\nTranslate the message naturally into ${targetLanguage === 'ja' ? 'Japanese' : targetLanguage === 'en' ? 'English' : targetLanguage}. Preserve meaning, names, numbers, prices, dates and uncertainty. Return only the translation.`;
}
