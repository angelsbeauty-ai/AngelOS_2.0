/**
 * Starting captions for the post composer. Templates only — no invented prices,
 * client names, dates, or results. A live model may replace the text later;
 * this function is the honest fallback and the thing tests lock.
 */

export const CAPTION_TONES = ['write', 'shorter', 'warmer', 'professional', 'price', 'booking', 'again'] as const;
export type CaptionTone = (typeof CAPTION_TONES)[number];
export type CaptionLanguage = 'en' | 'ja' | 'both';

export interface ComposeCaptionInput {
  objective: string;
  language: CaptionLanguage;
  tone?: CaptionTone;
  title?: string;
  /** Owner's own note. Included only as their words, never expanded into a claim. */
  note?: string;
  caption?: string;
  captionEn?: string;
  seed?: number;
}

export interface ComposeCaptionDraft {
  caption: string;
  captionJa: string;
  captionEn: string;
  hashtags: string[];
  hook: string;
}

const JA: Record<string, [string, string, string]> = {
  bookings: [
    '自然な仕上がりを大切にしています。ご希望を伺ってからご提案しますので、まずはメッセージをどうぞ。',
    '眉・リップ・アイラインのご相談を受けています。初めての方も、リタッチの方も、気軽にメッセージくださいね。',
    '仕上がりのイメージは人それぞれです。カウンセリングでご希望を確認してから進めます。ご予約はメッセージでどうぞ。'
  ],
  education: [
    '施術の前に知っておきたいことを、短くまとめました。気になる点はメッセージで聞いてくださいね。',
    'アートメイクは、肌やご希望によって進め方が変わります。よくある質問にお答えします。',
    '「痛い？」「どれくらい持つ？」は、一人ずつ違います。一般的な流れだけ先にお伝えします。詳しくはご相談ください。'
  ],
  trust: [
    'カウンセリングを大切にしています。合わないときは、無理におすすめしません。',
    '肌とご希望を見てから、進め方をご説明します。納得いただいてから次に進みます。',
    '初めての方こそ、質問の時間が一番大事だと思っています。遠慮なく聞いてくださいね。'
  ],
  reach: [
    'アートメイクのご相談を受け付けています。どんな仕上がりにしたいか、メッセージで教えてください。',
    '眉・リップ・アイライン。まずは「気になっていること」だけ送ってください。',
    'ソフトで自分らしい仕上がりをご希望の方へ。ご相談はメッセージからどうぞ。'
  ],
  availability: [
    '空きができました。気になっていた方は、メッセージで日時を確認してくださいね。',
    '直近のご案内ができます。希望の曜日をメッセージで送ってください。',
    'キャンセルで空きが出ました。ご希望のメニューを書いて送ってください。'
  ],
  engagement: [
    '仕上がりで気になるところはありますか。コメントかメッセージで教えてください。',
    '保存しておくと、次のご来店の参考になります。質問もどうぞ。',
    '眉・リップ・アイライン、どれが気になりますか。一言でも教えてくださいね。'
  ]
};

const EN: Record<string, [string, string, string]> = {
  bookings: [
    'We keep the finish soft and natural. Tell us what you are hoping for, and we will talk it through before anything is booked.',
    'Brows, lips, or liner — first visit or a touch-up. Send a message and we will help you check a time.',
    'Every face is different. We start with a consultation, then decide together. Message us when you are ready.'
  ],
  education: [
    'A short note on what to know before a visit. If something here does not match your situation, just ask.',
    'Permanent makeup depends on your skin and what you want. Here is the general flow — details are always a conversation.',
    'Pain, healing, and how long it lasts are different for everyone. This is the usual outline, not a promise.'
  ],
  trust: [
    'The consultation comes first. If it is not a fit, we will say so instead of pushing a booking.',
    'We look at your skin and what you want, then explain the plan. Nothing starts until you are comfortable.',
    'Questions are welcome, especially on a first visit. Ask anything before you decide.'
  ],
  reach: [
    'Consultations are open. Tell us the look you have in mind and we will reply with the next step.',
    'Brows, lips, or liner. Start with the one thing you are unsure about.',
    'If you want a soft result that still looks like you, send a message and we will talk.'
  ],
  availability: [
    'A time just opened. If you have been waiting, message us to check whether it still fits.',
    'We can look at the next few days. Send the days that work for you.',
    'A cancellation opened a slot. Tell us which service you want and we will confirm what is free.'
  ],
  engagement: [
    'What part of the finish are you most curious about? A comment or a message is enough.',
    'Save this for your next visit. Questions are welcome.',
    'Brows, lips, or liner — which one are you thinking about?'
  ]
};

const TAGS: Record<string, string[]> = {
  bookings: ['#permanentmakeup', '#pmuartist', '#browtattoo'],
  education: ['#pmueducation', '#permanentmakeup', '#browmapping'],
  trust: ['#permanentmakeup', '#pmuartist'],
  reach: ['#permanentmakeup', '#softbrows', '#pmuartist'],
  availability: ['#permanentmakeup', '#pmuartist'],
  engagement: ['#permanentmakeup', '#pmuartist']
};

const JA_TAGS = ['#アートメイク', '#眉アートメイク', '#pmu'];

function bucket(objective: string): keyof typeof JA {
  if (objective in JA) return objective as keyof typeof JA;
  if (objective === 'inquiries' || objective === 'profile_visits') return 'bookings';
  if (objective === 'saves') return 'education';
  return 'reach';
}

function pick(list: [string, string, string], seed: number) {
  const index = ((seed % list.length) + list.length) % list.length;
  return list[index];
}

function stripEmoji(text: string) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}✨🌸😊]/gu, '').replace(/[ ]{2,}/g, ' ').trim();
}

function firstSentence(text: string) {
  const parts = text.split(/(?<=[。．.!?！？])/);
  const first = (parts[0] ?? text).trim();
  return (first || text).slice(0, 180);
}

function withTitle(body: string, title?: string) {
  const label = title?.trim();
  if (!label || body.includes(label)) return body;
  return `${label}\n${body}`;
}

function withNote(body: string, note?: string) {
  const extra = note?.trim();
  if (!extra || body.includes(extra)) return body;
  return `${body}\n${extra}`;
}

function applyTone(text: string, tone: CaptionTone, language: 'ja' | 'en') {
  let next = text.trim();
  if (!next || tone === 'write' || tone === 'again') return next;
  if (tone === 'shorter') return firstSentence(next);
  if (tone === 'professional') return stripEmoji(next).replace(/!+/g, '.').replace(/！+/g, '。');
  if (tone === 'warmer') {
    if (language === 'ja') return next.includes('✨') ? next : `${next} 気になることは、いつでも聞いてくださいね。`;
    return /glad|love|welcome/i.test(next) ? next : `${next} You are welcome to ask anything.`;
  }
  if (tone === 'price') {
    if (/\[価格\]|\[price\]/i.test(next)) return next;
    return language === 'ja'
      ? `${next}\n初回 [価格]円、リタッチ [価格]円（メニューの金額に書き換えてください）。`
      : `${next}\nFirst session [price], touch-up [price] (replace these with your real menu prices).`;
  }
  if (tone === 'booking') {
    if (language === 'ja') return /メッセージ/.test(next) ? next : `${next}\nご予約はメッセージで空きを確認できます。確定するのは、こちらからお返事したあとです。`;
    return /message us/i.test(next) ? next : `${next}\nMessage us to check a time. Nothing is booked until we confirm.`;
  }
  return next;
}

export function composeCaption(input: ComposeCaptionInput): ComposeCaptionDraft {
  const tone: CaptionTone = input.tone ?? 'write';
  const seed = input.seed ?? 0;
  const key = bucket(input.objective);
  const fresh = tone === 'write' || tone === 'again' || !(input.caption ?? '').trim();
  const jaBase = fresh ? pick(JA[key], seed) : (input.caption ?? '').trim();
  const enBase = fresh ? pick(EN[key], seed) : ((input.captionEn ?? '').trim() || (input.language === 'en' ? (input.caption ?? '').trim() : pick(EN[key], seed)));
  let captionJa = applyTone(withNote(withTitle(jaBase, fresh ? input.title : undefined), fresh ? input.note : undefined), tone, 'ja');
  let captionEn = applyTone(withNote(withTitle(enBase, fresh ? input.title : undefined), fresh ? input.note : undefined), tone, 'en');
  if (!fresh && input.language === 'en') {
    captionEn = applyTone(withNote(withTitle((input.caption ?? '').trim(), undefined), undefined), tone, 'en');
  }
  if (!fresh && input.language === 'ja') {
    captionJa = applyTone((input.caption ?? '').trim(), tone, 'ja');
  }
  captionJa = captionJa.slice(0, 2200);
  captionEn = captionEn.slice(0, 2200);
  const caption = input.language === 'en' ? captionEn : captionJa;
  const tags = input.language === 'en' ? TAGS[key] : input.language === 'ja' ? JA_TAGS : [...JA_TAGS, ...TAGS[key]].slice(0, 5);
  const hook = firstSentence(caption).slice(0, 80);
  return { caption, captionJa, captionEn, hashtags: tags, hook };
}

/** Pulls a model JSON object out of a caption response. Null when it is not usable. */
export function parseComposerCaption(text: string): { captionJa: string; captionEn: string; hashtags: string[] } | null {
  const match = /\{[\s\S]*\}/.exec(text ?? '');
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    const captionJa = typeof value.captionJa === 'string' ? value.captionJa.trim() : '';
    const captionEn = typeof value.captionEn === 'string' ? value.captionEn.trim() : '';
    if (!captionJa || !captionEn) return null;
    if (/\$\d|\d{2,5}\s*円|\byen\b/i.test(`${captionJa}\n${captionEn}`) && !/\[価格\]|\[price\]/.test(`${captionJa}\n${captionEn}`)) return null;
    const hashtags = Array.isArray(value.hashtags)
      ? value.hashtags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 5).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      : [];
    return { captionJa: captionJa.slice(0, 2200), captionEn: captionEn.slice(0, 2200), hashtags };
  } catch {
    return null;
  }
}
