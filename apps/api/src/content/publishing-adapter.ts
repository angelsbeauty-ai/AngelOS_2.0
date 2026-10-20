export interface PublishContentInput {
  platform: string;
  format: string;
  caption: string;
  hook?: string | null;
  cta?: string | null;
  hashtags: string[];
  scheduledFor?: string | null;
  idempotencyKey: string;
  /** Public, short-lived URL of the first photo (Instagram requires one). */
  imageUrl?: string;
}

export interface PublishContentResult {
  status: 'published' | 'failed' | 'unknown';
  providerPostId?: string;
  liveUrl?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface SocialPublishingAdapter {
  publish(input: PublishContentInput): Promise<PublishContentResult>;
}
