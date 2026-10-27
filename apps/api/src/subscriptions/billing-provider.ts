export interface BillingProvider {
  readonly name: string;
  readonly configured: boolean;
  createCheckout(input: { workspaceId: string; billingInterval: 'monthly' | 'yearly'; discountPercent: number }): Promise<{ mode: 'checkout' | 'not_configured'; url?: string; message?: string }>;
}

export class UnconfiguredBillingProvider implements BillingProvider {
  readonly name = 'none';
  readonly configured = false;
  async createCheckout() {
    return { mode: 'not_configured' as const, message: 'A production payment provider has not been connected yet. Set STRIPE_SECRET_KEY to enable Stripe Checkout.' };
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  readonly configured: boolean;

  constructor(private readonly secretKey: string) {
    this.configured = Boolean(secretKey);
  }

  async createCheckout(input: { workspaceId: string; billingInterval: 'monthly' | 'yearly'; discountPercent: number }) {
    if (!this.secretKey) {
      return { mode: 'not_configured' as const, message: 'STRIPE_SECRET_KEY is not set.' };
    }
    const priceId = input.billingInterval === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) {
      return { mode: 'not_configured' as const, message: 'Stripe price IDs (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY) are not configured.' };
    }
    return {
      mode: 'checkout' as const,
      url: `https://checkout.stripe.com/placeholder?workspace=${input.workspaceId}&interval=${input.billingInterval}`,
      message: 'Stripe Checkout path is ready. Wire the official Stripe SDK call next.'
    };
  }
}
