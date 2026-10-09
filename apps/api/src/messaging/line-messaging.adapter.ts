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

  async getProfileName(userId: string): Promise<string | undefined> {
    try {
      const response = await this.fetchImpl(`${this.config.apiBase}/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${this.config.channelAccessToken}` } });
      if (!response.ok) return undefined;
      const json = (await response.json()) as any;
      return typeof json.displayName === 'string' ? json.displayName.slice(0, 120) : undefined;
    } catch { return undefined; }
  }
}
