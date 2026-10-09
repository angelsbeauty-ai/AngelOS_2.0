/**
 * One adapter interface for every messaging platform (LINE, Instagram, Facebook, manual paste).
 * Every platform produces the same thread/message structure: an inbound event becomes a
 * NormalizedInboundMessage, which MessagingService turns into message_threads + client_messages rows.
 */
export type MessagingProvider = 'line' | 'instagram' | 'facebook' | 'tiktok' | 'manual';

export interface MessagingSendInput {
  /** Platform user/conversation id the reply goes to (LINE userId, IG scoped id, ...). */
  externalThreadId: string;
  body: string;
  idempotencyKey: string;
}

export interface MessagingSendResult {
  status: 'sent' | 'failed' | 'unknown' | 'manual';
  externalMessageId?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface NormalizedInboundMessage {
  provider: MessagingProvider;
  /** The business account the message was sent to (LINE bot user id, IG business id, ...). */
  externalAccountId: string;
  externalThreadId: string;
  externalUserId: string;
  externalMessageId: string;
  body: string;
  sentAt: string;
  contactDisplayName?: string;
}

export interface AdapterStatus {
  provider: MessagingProvider;
  /** True only when the code path is switched on AND the account credentials exist. */
  ready: boolean;
  state: 'ready' | 'disabled' | 'needs_setup' | 'needs_meta_approval' | 'manual';
  detail: string;
}

export interface MessagingProviderAdapter {
  readonly provider: MessagingProvider;
  status(): AdapterStatus;
  send(input: MessagingSendInput): Promise<MessagingSendResult>;
}

/**
 * Manual conversations (Angel pastes the client's message). AngelOS never delivers these itself:
 * an approved reply becomes "Ready to send", Angel copies it into LINE/IG/FB and taps "I sent it".
 */
export class ManualMessagingAdapter implements MessagingProviderAdapter {
  readonly provider = 'manual' as const;
  status(): AdapterStatus {
    return { provider: 'manual', ready: true, state: 'manual', detail: 'Paste messages yourself. Approved replies are copied and sent by you.' };
  }
  async send(input: MessagingSendInput): Promise<MessagingSendResult> {
    return { status: 'manual', raw: { transport: 'manual-copy', idempotencyKey: input.idempotencyKey } };
  }
}

/**
 * Instagram / Facebook DMs need a Meta Business app with App Review (weeks).
 * This stub keeps the shared interface honest: it is never "ready" and never pretends to send.
 */
export class MetaMessagingAdapter implements MessagingProviderAdapter {
  constructor(readonly provider: 'instagram' | 'facebook') {}
  status(): AdapterStatus {
    return {
      provider: this.provider,
      ready: false,
      state: 'needs_meta_approval',
      detail: 'Needs Meta approval: a Meta Business account, a Meta app and App Review for messaging. Not connected.'
    };
  }
  async send(): Promise<MessagingSendResult> {
    return { status: 'failed', error: `${this.provider === 'instagram' ? 'Instagram' : 'Facebook'} messaging is not connected (needs Meta approval).` };
  }
}
