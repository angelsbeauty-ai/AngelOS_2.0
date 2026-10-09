/**
 * B7 reminders & follow-ups as SUGGESTED messages (Angel approves each one; nothing is sent by itself).
 * Japanese templates use the friendly salon tone; English templates are short and warm.
 * {name} {service} {date} {time} are filled per client. Never English + Japanese in one message.
 */
export type ReminderType = 'booking_confirmation' | 'day_before' | 'aftercare_0' | 'aftercare_3' | 'aftercare_7' | 'healing_check' | 'touch_up_due' | 'colour_boost' | 'birthday';

export interface ReminderDefault { type: ReminderType; name: string; category: 'appointment' | 'aftercare' | 'followup' | 'messaging'; en: string; ja: string; ja_meaning: string }

export const REMINDER_DEFAULTS: ReminderDefault[] = [
  { type: 'booking_confirmation', name: 'Booking confirmation', category: 'appointment', en: 'Hi {name}, your {service} is booked for {date} at {time}. See you soon!', ja: '{name}さん、{date} {time}から{service}のご予約を承りました✨ お会いできるのを楽しみにしています🌸', ja_meaning: 'Hi {name}, we have your {service} booking for {date} from {time}. Looking forward to seeing you.' },
  { type: 'day_before', name: 'Day-before reminder', category: 'appointment', en: 'Hi {name}, just a reminder of your {service} tomorrow at {time}. Reply here if anything changes.', ja: '{name}さん、明日{time}から{service}のご予約です✨ 何か変更があればこちらに連絡くださいね🌸', ja_meaning: 'Hi {name}, your {service} is tomorrow from {time}. Message here if anything changes.' },
  { type: 'aftercare_0', name: 'Aftercare (same day)', category: 'aftercare', en: 'Thank you for coming today, {name}! Keep the area dry and clean, and don\'t pick at it. Message me any time with questions.', ja: '{name}さん、本日はありがとうございました✨ 施術部分は濡らさず清潔に、かさぶたは無理に取らないでくださいね。気になることがあればいつでも連絡ください🌸', ja_meaning: 'Thank you for today, {name}. Keep the area dry and clean, don\'t pick the scabs. Contact me any time.' },
  { type: 'aftercare_3', name: 'Aftercare (day 3)', category: 'aftercare', en: 'Hi {name}, how is it healing? Some flaking is normal around now. Keep it clean and let it be.', ja: '{name}さん、その後いかがですか？今くらいの時期は少し皮がむけるのは普通です。清潔にしてそのままにしてくださいね✨', ja_meaning: 'Hi {name}, how is it? Some flaking now is normal. Keep it clean and leave it.' },
  { type: 'aftercare_7', name: 'Aftercare (day 7)', category: 'aftercare', en: 'Hi {name}, one week already! If the colour looks lighter, that\'s normal; it comes back as it heals.', ja: '{name}さん、施術から1週間ですね✨ 色が薄く見えても大丈夫です。治っていくにつれて落ち着いてきますよ🌸', ja_meaning: 'Hi {name}, it\'s been a week. If the colour looks light that\'s fine; it settles as it heals.' },
  { type: 'healing_check', name: 'Healing check (week 4)', category: 'followup', en: 'Hi {name}, it\'s been about 4 weeks. Could you send me a photo so I can check the healing?', ja: '{name}さん、施術から約4週間ですね✨ 仕上がりを確認したいので、よかったら写真を送ってくださいね🌸', ja_meaning: 'Hi {name}, about 4 weeks now. If you can, please send a photo so I can check the result.' },
  { type: 'touch_up_due', name: 'Touch-up due (week 6–8)', category: 'followup', en: 'Hi {name}, it\'s time for your touch-up. Would you like me to find a time for you?', ja: '{name}さん、そろそろリタッチの時期です✨ ご都合のいい日があれば教えてくださいね🌸', ja_meaning: 'Hi {name}, it\'s about time for your touch-up. Tell me which days suit you.' },
  { type: 'colour_boost', name: 'Yearly colour boost', category: 'followup', en: 'Hi {name}, it\'s been about a year since your {service}. A colour boost keeps it fresh. Want me to book you in?', ja: '{name}さん、{service}から約1年ですね✨ 色を整えるメンテナンスはいかがですか？ご希望があればお知らせください🌸', ja_meaning: 'Hi {name}, about a year since your {service}. How about a colour refresh? Let me know.' },
  { type: 'birthday', name: 'Birthday message', category: 'messaging', en: 'Happy birthday, {name}! Wishing you a lovely year.', ja: '{name}さん、お誕生日おめでとうございます🎂✨ 素敵な一年になりますように🌸', ja_meaning: 'Happy birthday, {name}! Wishing you a wonderful year.' }
];

export interface ReminderRule { type: ReminderType; enabled: boolean; en: string; ja: string; ja_meaning: string }
export interface ReminderAppointment { id: string; client_id: string; service_name: string; status: string; start_at: string; created_at?: string; client?: { display_name: string; language: string; do_not_auto_message?: boolean } | null }
export interface ReminderClient { id: string; display_name: string; language: string; birthday?: string | null; do_not_auto_message?: boolean }
export interface ReminderCandidate { key: string; type: ReminderType; title: string; clientId: string; clientName: string; appointmentId?: string; language: 'en' | 'ja'; message: string; meaningEn: string | null }

function local(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return { day: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}
function dayDiff(a: string, b: string) { return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000); }
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

export function mergeRules(stored: Array<{ routine_category: string | null; enabled: boolean; action_config: any }>): ReminderRule[] {
  return REMINDER_DEFAULTS.map((d) => {
    const row = stored.find((r) => r.routine_category === d.type);
    return { type: d.type, enabled: row ? row.enabled : true, en: row?.action_config?.template_en || d.en, ja: row?.action_config?.template_ja || d.ja, ja_meaning: row?.action_config?.template_ja_meaning || d.ja_meaning };
  });
}

function fill(t: string, v: Record<string, string>) { return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''); }

/** Pure: what to remind about today. Appointments should cover roughly -400..+2 days. */
export function computeReminders(input: { now: Date; timeZone: string; rules: ReminderRule[]; appointments: ReminderAppointment[]; clients: ReminderClient[]; firstSessionClientIds?: Set<string> }): ReminderCandidate[] {
  const today = local(input.now, input.timeZone).day;
  const on = new Map(input.rules.filter((r) => r.enabled).map((r) => [r.type, r]));
  const out: ReminderCandidate[] = [];
  const futureByClient = new Map<string, number>();
  for (const a of input.appointments) if (Date.parse(a.start_at) > input.now.getTime() && !['cancelled', 'no_show'].includes(a.status)) futureByClient.set(a.client_id, (futureByClient.get(a.client_id) ?? 0) + 1);
  const push = (type: ReminderType, a: { clientId: string; name: string; language: string; dnm?: boolean; appointmentId?: string; service?: string; start?: string }, keyPart: string) => {
    const rule = on.get(type);
    if (!rule || a.dnm) return;
    const lang = a.language === 'ja' ? 'ja' : 'en';
    const when = a.start ? local(new Date(a.start), input.timeZone) : { day: '', time: '' };
    const vars = { name: firstName(a.name), service: a.service ?? '', date: when.day ? when.day.slice(5).replace('-', '/') : '', time: when.time };
    const def = REMINDER_DEFAULTS.find((d) => d.type === type)!;
    out.push({ key: `reminder:${type}:${keyPart}`, type, title: `${def.name}: ${a.name}`, clientId: a.clientId, clientName: a.name, appointmentId: a.appointmentId, language: lang, message: fill(lang === 'ja' ? rule.ja : rule.en, vars), meaningEn: lang === 'ja' ? fill(rule.ja_meaning, vars) : null });
  };
  const latestDone = new Map<string, ReminderAppointment>();
  for (const a of input.appointments) {
    const c = a.client; if (!c) continue;
    const base = { clientId: a.client_id, name: c.display_name, language: c.language, dnm: c.do_not_auto_message, appointmentId: a.id, service: a.service_name, start: a.start_at };
    const d = local(new Date(a.start_at), input.timeZone).day;
    const diff = dayDiff(today, d);
    if (a.status === 'confirmed' && a.created_at && dayDiff(today, local(new Date(a.created_at), input.timeZone).day) <= 1 && diff < 0) push('booking_confirmation', base, a.id);
    if (['confirmed', 'confirmation_pending', 'arrival_info_sent'].includes(a.status) && diff === -1) push('day_before', base, a.id);
    if (a.status === 'completed') {
      if (diff === 0) push('aftercare_0', base, a.id);
      if (diff === 3) push('aftercare_3', base, a.id);
      if (diff === 7) push('aftercare_7', base, a.id);
      if (diff === 28) push('healing_check', base, a.id);
      const prev = latestDone.get(a.client_id);
      if (!prev || Date.parse(a.start_at) > Date.parse(prev.start_at)) latestDone.set(a.client_id, a);
    }
  }
  for (const [clientId, a] of latestDone) {
    if (futureByClient.get(clientId)) continue;
    const diff = dayDiff(today, local(new Date(a.start_at), input.timeZone).day);
    const c = a.client!;
    const base = { clientId, name: c.display_name, language: c.language, dnm: c.do_not_auto_message, appointmentId: a.id, service: a.service_name, start: a.start_at };
    if (diff >= 42 && diff <= 56 && (!input.firstSessionClientIds || input.firstSessionClientIds.has(clientId))) push('touch_up_due', base, `${a.id}`);
    if (diff >= 358 && diff <= 372) push('colour_boost', base, `${a.id}`);
  }
  for (const c of input.clients) {
    if (c.birthday && c.birthday.slice(5) === today.slice(5)) push('birthday', { clientId: c.id, name: c.display_name, language: c.language, dnm: c.do_not_auto_message }, `${c.id}:${today.slice(0, 4)}`);
  }
  return out;
}
