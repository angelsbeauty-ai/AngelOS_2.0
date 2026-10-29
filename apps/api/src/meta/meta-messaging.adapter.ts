import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AdapterStatus, MessagingProviderAdapter, MessagingSendInput, MessagingSendResult, NormalizedInboundMessage } from '../messaging/provider-adapter';
import { readMetaConfig, type MetaConfig } from './meta.config';

/** X-Hub-Signature-256 = "sha256=" + hex(HMAC-SHA256(appSecret, raw body)). Constant-time compare. */
export function verifyMetaSignature(raw: Buffer | string, header: string | undefined, appSecret: string | undefined): boolean {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(raw).digest();
  let provided: Buffer;
  try { provided = Buffer.from(header.slice(7), 'hex'); } catch { return false; }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Messenger (object=page) and Instagram (object=instagram) webhook → shared inbound shape. Echoes are skipped. */
export function parseMetaWebhook(payload: any): NormalizedInboundMessage[] {
  const provider = payload?.object === 'instagram' ? 'instagram' : payload?.object === 'page' ? 'facebook' : null;
  if (!provider) return [];
  const out: NormalizedInboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const m = ev.message; if (!m || m.is_echo || !ev.sender?.id || !m.mid) continue;
      const body = typeof m.text === 'string' ? m.text : m.attachments?.length ? `[${m.attachments[0]?.type === 'image' ? 'Photo' : 'Attachment'}]` : '[Message]';
      out.push({ provider, externalAccountId: String(entry.id ?? ev.recipient?.id ?? ''), externalThreadId: `${provider}:${ev.sender.id}`, externalUserId: String(ev.sender.id), externalMessageId: `${provider}:${m.mid}`, body: body.slice(0, 5000), sentAt: new Date(Number(ev.timestamp) || Date.now()).toISOString() });
    }
  }
  return out;
}

const HOUR = 3_600_000;
/** Meta messaging window: 'open' <24h since the client wrote, 'human_agent' 24h-7d (HUMAN_AGENT tag), 'closed' after. */
export function metaWindow(lastInboundAt: string | null | undefined, now = Date.now()): 'open' | 'human_agent' | 'closed' {
  if (!lastInboundAt) return 'closed';
  const age = now - Date.parse(lastInboundAt);
  if (!Number.isFinite(age)) return 'closed';
  if (age < 24 * HOUR) return 'open';
  if (age < 7 * 24 * HOUR) return 'human_agent';
  return 'closed';
}

export class MetaGraphMessagingAdapter implements MessagingProviderAdapter {
  constructor(readonly provider: 'instagram' | 'facebook', private readonly c: MetaConfig = readMetaConfig(), private readonly fetchImpl: typeof fetch = fetch) {}

  status(): AdapterStatus {
    const name = this.provider === 'instagram' ? 'Instagram' : 'Facebook';
    if (!this.c.messagingEnabled) return { provider: this.provider, ready: false, state: 'needs_meta_approval', detail: `${name} messages need Meta setup and App Review. Not connected.` };
    if (!this.c.appSecret || !this.c.pageToken || (this.provider === 'instagram' && !this.c.igUserId) || (this.provider === 'facebook' && !this.c.pageId)) return { provider: this.provider, ready: false, state: 'needs_setup', detail: `${name} is switched on but keys are missing on the server.` };
    return { provider: this.provider, ready: true, state: 'ready', canSend: this.c.sendEnabled, detail: this.c.sendEnabled ? `${name} messages connected.` : `${name} inbox connected. Sending is switched off; copy replies yourself.` };
  }

  async send(input: MessagingSendInput): Promise<MessagingSendResult> {
    if (!this.status().ready) return { status: 'failed', error: `${this.provider} messaging is not connected.` };
    if (!this.c.sendEnabled) return { status: 'manual', raw: { transport: 'meta-send-disabled', idempotencyKey: input.idempotencyKey } };
    const id = input.externalThreadId.replace(/^(instagram|facebook):/, '');
    const node = this.provider === 'instagram' ? this.c.igUserId : this.c.pageId;
    const window = input.lastInboundAt === undefined ? 'open' : metaWindow(input.lastInboundAt);
    if (window === 'closed') return { status: 'failed', error: 'The client last wrote more than 7 days ago, so Meta will not deliver a reply. Wait for them to message again.', raw: { transport: 'meta', window } };
    const routing = window === 'open' ? { messaging_type: 'RESPONSE' } : { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
    const post = (message: Record<string, unknown>) => this.fetchImpl(`${this.c.graphBase}/${node}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.c.pageToken}` }, body: JSON.stringify({ recipient: { id }, ...routing, message }) });
    if (input.imageUrl) {
      const img = await post({ attachment: { type: 'image', payload: { url: input.imageUrl } } });
      const ij = (await img.json().catch(() => ({}))) as any;
      if (!img.ok || !ij.message_id) return { status: 'failed', error: `${this.provider} photo send failed (${img.status})`, raw: { transport: 'meta', httpStatus: img.status, error: ij?.error?.message } };
      if (!input.body.trim()) return { status: 'sent', externalMessageId: `${this.provider}:${ij.message_id}`, raw: { transport: 'meta', httpStatus: img.status, window } };
    }
    const r = await post({ text: input.body.slice(0, 1000) });
    const json = (await r.json().catch(() => ({}))) as any;
    if (r.ok && json.message_id) return { status: 'sent', externalMessageId: `${this.provider}:${json.message_id}`, raw: { transport: 'meta', httpStatus: r.status, window } };
    return { status: 'failed', error: `${this.provider} send failed (${r.status})`, raw: { transport: 'meta', httpStatus: r.status, error: json?.error?.message } };
  }
}
