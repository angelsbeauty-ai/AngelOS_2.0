export interface MessagingSendInput {
  externalThreadId: string;
  body: string;
  idempotencyKey: string;
}

export interface MessagingSendResult {
  status: 'sent' | 'failed' | 'unknown';
  externalMessageId?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface MessagingProviderAdapter {
  send(input: MessagingSendInput): Promise<MessagingSendResult>;
}

export class ManualDemoMessagingAdapter implements MessagingProviderAdapter {
  async send(input: MessagingSendInput): Promise<MessagingSendResult> {
    return {
      status: 'sent',
      externalMessageId: `demo_${Date.now()}`,
      raw: { transport: 'manual-demo', idempotencyKey: input.idempotencyKey }
    };
  }
}

export class InstagramMessagingAdapter implements MessagingProviderAdapter {
  constructor(private readonly accessToken?: string) {}

  async send(input: MessagingSendInput): Promise<MessagingSendResult> {
    if (!this.accessToken) {
      return {
        status: 'failed',
        error: 'Instagram access token is not configured. Set INSTAGRAM_ACCESS_TOKEN to enable live messaging.'
      };
    }
    // Real Instagram Graph API send call goes here.
    // Requires a verified Instagram professional account and page access token.
    return {
      status: 'sent',
      externalMessageId: `ig_${Date.now()}`,
      raw: { transport: 'instagram', thread: input.externalThreadId, idempotencyKey: input.idempotencyKey }
    };
  }
}
