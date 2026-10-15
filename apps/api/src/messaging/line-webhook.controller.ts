import { Controller, ForbiddenException, Headers, HttpCode, Logger, NotFoundException, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LineMessagingAdapter, parseLineWebhook, readLineConfig } from './line-messaging.adapter';
import { MessagingService } from './messaging.service';
import { SocialSyncService } from '../sync/social-sync.service';

/**
 * POST /webhooks/line: inbound LINE messages. Public route (LINE calls it), so it trusts nothing
 * except a valid x-line-signature over the raw body.
 * Studios connected via line_connections: the webhook "destination" (bot user id) picks the studio and its own channel secret.
 * Otherwise falls back to the single server-wide channel (env), 404 unless that is switched on.
 */
@Controller('webhooks')
export class LineWebhookController {
  private readonly logger = new Logger('LineWebhook');
  constructor(private readonly messaging: MessagingService, private readonly sync: SocialSyncService) {}

  @Post('line')
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>, @Headers('x-line-signature') signature?: string) {
    const raw = request.rawBody;
    const destination = typeof (request.body as any)?.destination === 'string' ? String((request.body as any).destination) : '';
    const studio = await this.sync.lineSecretForBot(destination);
    let adapter: LineMessagingAdapter;
    if (studio) {
      adapter = new LineMessagingAdapter({ enabled: true, channelSecret: studio.channelSecret, channelAccessToken: studio.accessToken, apiBase: 'https://api.line.me' });
      if (!raw || !adapter.verify(raw, signature)) throw new ForbiddenException('Invalid LINE signature.');
      await this.sync.ensureLineChannel(studio.workspaceId, destination, studio.displayName);
    } else {
      adapter = new LineMessagingAdapter(readLineConfig());
      if (!adapter.status().ready) throw new NotFoundException('LINE is not enabled on this server.');
      if (!raw || !adapter.verify(raw, signature)) throw new ForbiddenException('Invalid LINE signature.');
    }
    const events = parseLineWebhook(request.body);
    let stored = 0;
    for (const event of events) {
      try {
        const result: any = await this.messaging.ingestFromProvider(event, (userId) => adapter.getProfileName(userId));
        if (result?.threadId) stored += 1;
      } catch (error) {
        // Log without message text. LINE retries failed deliveries; duplicates are ignored by external_message_id.
        this.logger.error(`LINE event could not be stored: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return { ok: true, received: events.length, stored };
  }
}
