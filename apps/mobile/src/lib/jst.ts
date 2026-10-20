/**
 * Studio time is Asia/Tokyo (UTC+9, no DST). Calendar maths runs on "JST wall-clock" Dates:
 * toJ() turns a real instant into a Date whose local fields read as JST; fromJ() turns it back
 * before anything is sent to the server. On a phone set to JST both are no-ops.
 */
const OFF = 9 * 60;
export const toJ = (d: Date) => new Date(d.getTime() + (OFF + d.getTimezoneOffset()) * 60000);
export const fromJ = (d: Date) => new Date(d.getTime() - (OFF + d.getTimezoneOffset()) * 60000);
export const jNow = () => toJ(new Date());
const pad = (n: number) => String(n).padStart(2, '0');
/** 24h "HH:mm" of a JST wall-clock Date. */
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** 24h "HH:mm" in JST of a real instant (ISO string or Date). */
export const timeJst = (v: string | Date) => hhmm(toJ(typeof v === 'string' ? new Date(v) : v));
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayText = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
