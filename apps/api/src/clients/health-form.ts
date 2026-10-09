/** PMU health questionnaire (EN/JA). A "yes" on a red-flag question shows "Check before treatment". */
export interface HealthQuestion { key: string; en: string; ja: string; redFlag: boolean }

export const HEALTH_QUESTIONS: HealthQuestion[] = [
  { key: 'blood_thinners', en: 'Do you take blood thinners (e.g. aspirin, warfarin)?', ja: '血液をサラサラにする薬（アスピリンなど）を飲んでいますか？', redFlag: true },
  { key: 'accutane', en: 'Have you taken Accutane (isotretinoin) in the last 12 months?', ja: '過去12ヶ月以内にイソトレチノイン（アキュテイン）を服用しましたか？', redFlag: true },
  { key: 'allergies', en: 'Allergies to lidocaine, pigments or latex?', ja: 'リドカイン・色素・ラテックスのアレルギーはありますか？', redFlag: true },
  { key: 'pregnant', en: 'Are you pregnant or breastfeeding?', ja: '妊娠中または授乳中ですか？', redFlag: true },
  { key: 'diabetes', en: 'Do you have diabetes?', ja: '糖尿病はありますか？', redFlag: true },
  { key: 'skin_conditions', en: 'Eczema, psoriasis or other skin conditions in the area?', ja: '施術部位に湿疹・乾癬などの肌トラブルはありますか？', redFlag: true },
  { key: 'keloids', en: 'Do you form keloids or raised scars?', ja: 'ケロイド体質ですか？', redFlag: true },
  { key: 'cold_sores', en: 'Cold sores (for lip treatments)?', ja: '口唇ヘルペスが出やすいですか？（リップの場合）', redFlag: true },
  { key: 'chemo', en: 'Chemotherapy now or in the last 6 months?', ja: '現在または過去6ヶ月以内に抗がん剤治療を受けていますか？', redFlag: true },
  { key: 'botox_filler', en: 'Botox or filler in the last 4 weeks?', ja: '4週間以内にボトックスやヒアルロン酸注入をしましたか？', redFlag: false },
  { key: 'past_pmu', en: 'Have you had permanent makeup before? (when, where)', ja: '以前にアートメイクをしたことはありますか？（時期・場所）', redFlag: false }
];

export type HealthAnswers = Record<string, { answer: 'yes' | 'no'; detail?: string }>;

export function sanitizeAnswers(input: Record<string, any>): HealthAnswers {
  const out: HealthAnswers = {};
  for (const q of HEALTH_QUESTIONS) {
    const value = input?.[q.key];
    const answer = value?.answer === 'yes' || value === 'yes' || value === true ? 'yes' : value?.answer === 'no' || value === 'no' || value === false ? 'no' : null;
    if (!answer) continue;
    const detail = typeof value?.detail === 'string' ? value.detail.trim().slice(0, 300) : undefined;
    out[q.key] = detail ? { answer, detail } : { answer };
  }
  return out;
}

export function redFlagsFrom(answers: HealthAnswers): string[] {
  return HEALTH_QUESTIONS.filter((q) => q.redFlag && answers[q.key]?.answer === 'yes').map((q) => q.key);
}

/** Touch-up is due 6–10 weeks after a first session if nothing is booked after it. */
export function touchUpDue(treatments: Array<{ stage: string; performed_at: string }>, futureAppointments: number, now = new Date()) {
  if (futureAppointments > 0) return false;
  const last = treatments.filter((t) => t.stage === 'first_session').map((t) => Date.parse(t.performed_at)).sort((a, b) => b - a)[0];
  if (!last) return false;
  if (treatments.some((t) => t.stage === 'touch_up' && Date.parse(t.performed_at) > last)) return false;
  const days = (now.getTime() - last) / 86400000;
  return days >= 42 && days <= 70;
}
