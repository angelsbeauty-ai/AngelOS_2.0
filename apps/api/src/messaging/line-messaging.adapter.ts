import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AdapterStatus, MessagingProviderAdapter, MessagingSendInput, MessagingSendResult, NormalizedInboundMessage } from './provider-adapter';

/**
 * LINE Official Account (Messaging API).
 * OFF by default. It only runs when ALL of these are set by Angel in the API environment:
 *   LINE_MESSAGING_ENABLED=true, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN
 * Nothing here reads or writes env files.
 */
export interface LineConfig {
  enabled: boolean;
  channelSecret?: string;
  channelAccessToken?: string;
  apiBase?: string;
}

export function readLineConfig(env: NodeJS.ProcessEnv = process.env): LineConfig {
  return {
    enabled: String(env.LINE_MESSAGING_ENABLED ?? '').trim().toLowerCase() === 'true',
    channelSecret: env.LINE_CHANNEL_SECRET?.trim() || undefined,
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN?.trim() || undefined,
    apiBase: 'https://api.line.me'
  };
}

export function lineStatus(config: LineConfig): AdapterStatus {
  if (!config.enabled) return { provider: 'line', ready: false, state: 'disabled', detail: 'LINE is switched off. Needs a LINE Official Account with the Messaging API, then the server setting LINE_MESSAGING_ENABLED.' };
  if (!config.channelSecret || !config.channelAccessToken) return { provider: 'line', ready: false, state: 'needs_setup', detail: 'LINE is switched on but the channel secret or access token is missing on the server.' };
  return { provider: 'line', ready: true, state: 'ready', detail: 'LINE Messaging API is configured on the server.' };
}

/** x-line-signature = base64(HMAC-SHA256(channelSecret, raw request body)). Constant-time compare. */
export function verifyLineSignature(rawBody: Buffer | string, signature: string | undefined, channelSecret: string | undefined): boolean {
  if (!signature || !channelSecret) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', channelSecret).update(body).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, 'base64'); } catch { return false; }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Turns a LINE webhook body into the shared inbound structure. Non-message events are skipped. */
export function parseLineWebhook(payload: any): NormalizedInboundMessage[] {
  const destination = typeof payload?.destination === 'string' ? payload.destination : '';
  const events: any[] = Array.isArray(payload?.events) ? payload.events : [];
  const out: NormalizedInboundMessage[] = [];
  for (const event of events) {
    if (event?.type !== 'message' || event?.source?.type !== 'user') continue;
    const userId = String(event.source.userId ?? '');
    const messageId = String(event.message?.id ?? '');
    if (!userId || !messageId) continue;
    const kind = String(event.message?.type ?? '');
    const body = kind === 'text' ? String(event.message.text ?? '')
      : kind === 'image' ? '[Photo]'
      : kind === 'video' ? '[Video]'
      : kind === 'sticker' ? '[Sticker]'
      : kind === 'audio' ? '[Voice message, not stored]'
      : kind === 'location' ? '[Location]'
      : `[${kind || 'Message'}]`;
    out.push({
      provider: 'line',
      externalAccountId: destination,
      externalThreadId: `line:${userId}`,
      externalUserId: userId,
      externalMessageId: `line:${messageId}`,
      body: body.slice(0, 5000),
      sentAt: new Date(Number(event.timestamp) || Date.now()).toISOString()
    });
  }
  return out;
}

/** LINE's X-Line-Retry-Key must be a UUID; derive a stable one from our idempotency key. */
export function retryKeyFor(idempotencyKey: string): string {
  const hex = createHash('sha256').update(idempotencyKey).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

export class LineMessagingAdapter implements MessagingProviderAdapter {
  readonly provider = 'line' as const;
  constructor(private readonly config: LineConfig = readLineConfig(), private readonly fetchImpl: typeof fetch = fetch) {}

  status(): AdapterStatus { return lineStatus(this.config); }

  verify(rawBody: Buffer | string, signature: string | undefined) {
    return verifyLineSignature(rawBody, signature, this.config.channelSecret);
  }

  async send(input: MessagingSendInput): Promise<MessagingSendResult> {
    if (!this.status().ready) return { status: 'failed', error: 'LINE is not connected.' };
    const to = input.externalThreadId.startsWith('line:') ? input.externalThreadId.slice(5) : input.externalThreadId;
    const response = await this.fetchImpl(`${this.config.apiBase}/v2/bot/message/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.channelAccessToken}`,
        'Content-Type': 'application/json',
        'X-Line-Retry-Key': retryKeyFor(input.idempotencyKey)
      },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: input.body.slice(0, 5000) }] })
    });
    const requestId = response.headers.get('x-line-request-id') ?? undefined;
    // 409 = LINE already accepted a request with this retry key, so the message was delivered once.
    if (response.ok || response.status === 409) {
      return { status: 'sent', externalMessageId: requestId ? `line-req:${requestId}` : undefined, raw: { transport: 'line', httpStatus: response.status, requestId } };
    }
    const text = await response.text().catch(() => '');
    return { status: 'failed', error: `LINE push failed (${response.status})`, raw: { transport: 'line', httpStatus: response.status, body: text.slice(0, 300) } };
  }

  /** Bot info: used once when Angel taps "Connect LINE", to link the bot to her workspace. */
  async getBotInfo(): Promise<{ userId: string; displayName: string; basicId?: string }> {
    const response = await this.fetchImpl(`${this.config.apiBase}/v2/bot/info`, { headers: { Authorization: `Bearer ${this.config.channelAccessToken}` } });
    if (!response.ok) throw new Error(`LINE bot info failed (${response.status})`);
    const json = (await response.json()) as any;
    return { userId: String(json.userId), displayName: String(json.displayName ?? 'LINE Official Account'), basicId: json.basicId };
  }

  /**
   * Broadcast to every LINE friend. Only called after Angel taps Approve on a LINE broadcast draft.
   * Uses the same retry key trick so a double tap cannot send twice.
   */
  async broadcast(text: string, idempotencyKey: string): Promise<MessagingSendResult> {
    if (!this.status().ready) return { status: 'failed', error: 'LINE is not connected.' };
    const response = await this.fetchImpl(`${this.config.apiBase}/v2/bot/message/broadcast`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.channelAccessToken}`, 'Content-Type': 'application/json', 'X-Line-Retry-Key': retryKeyFor(idempotencyKey) },
      body: JSON.stringify({ messages: [{ type: 'text', text: text.slice(0, 5000) }] })
    });
    const requestId = response.headers.get('x-line-request-id') ?? undefined;
    if (response.ok || response.status === 409) return { status: 'sent', externalMessageId: requestId ? `line-req:${requestId}` : undefined, raw: { transport: 'line-broadcast', httpStatus: response.status, requestId } };
    const body = await response.text().catch(() => '');
    return { status: 'failed', error: `LINE broadcast failed (${response.status})`, raw: { transport: 'line-broadcast', httpStatus: response.status, body: body.slice(0, 300) } };
  }

  /** How many people a broadcast would reach + this month's free message quota. Never throws. */
  async audienceEstimate(now = new Date()): Promise<{ recipients: number | null; quota: number | null; used: number | null; asOf: string | null }> {
    const headers = { Authorization: `Bearer ${this.config.channelAccessToken}` };
    const out = { recipients: null as number | null, quota: null as number | null, used: null as number | null, asOf: null as string | null };
    if (!this.status().ready) return out;
    try {
      // LINE insight data is for the previous day (JST).
      const jst = new Date(now.getTime() + 9 * 3600000 - 86400000);
      const date = jst.toISOString().slice(0, 10).replace(/-/g, '');
      const insight = await this.fetchImpl(`${this.config.apiBase}/v2/bot/insight/followers?date=${date}`, { headers });
      if (insight.ok) {
        const json = (await insight.json()) as any;
        if (json.status === 'ready') {
          out.recipients = Number(json.targetedReaches ?? Math.max(0, Number(json.followers ?? 0) - Number(json.blocks ?? 0)));
          out.asOf = date;
        }
      }
      const [quota, used] = await Promise.all([
        this.fetchImpl(`${this.config.apiBase}/v2/bot/message/quota`, { headers }),
        this.fetchImpl(`${this.config.apiBase}/v2/bot/message/quota/consumption`, { headers })
      ]);
      if (quota.ok) { const q = (await quota.json()) as any; out.quota = q.type === 'limited' ? Number(q.value) : null; }
      if (used.ok) { const u = (await used.json()) as any; out.used = Number(u.totalUsage ?? 0); }
    } catch { /* estimate stays unknown */ }
    return out;
  }

  async getProfileName(userId: string): Promise<string | undefined> {
    try {
      const response = await this.fetchImpl(`${this.config.apiBase}/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${this.config.channelAccessToken}` } });
      if (!response.ok) return undefined;
      const json = (await response.json()) as any;
      return typeof json.displayName === 'string' ? json.displayName.slice(0, 120) : undefined;
    } catch { return undefined; }
  }
}
