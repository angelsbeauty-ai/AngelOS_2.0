import { Controller, ForbiddenException, Headers, HttpCode, Logger, NotFoundException, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LineMessagingAdapter, parseLineWebhook, readLineConfig } from './line-messaging.adapter';
import { MessagingService } from './messaging.service';

/**
 * POST /webhooks/line: inbound LINE messages. Public route (LINE calls it), so it trusts nothing
 * except a valid x-line-signature over the raw body. Disabled (404) unless LINE is switched on.
 */
@Controller('webhooks')
export class LineWebhookController {
  private readonly logger = new Logger('LineWebhook');
  constructor(private readonly messaging: MessagingService) {}

  @Post('line')
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>, @Headers('x-line-signature') signature?: string) {
    const adapter = new LineMessagingAdapter(readLineConfig());
    if (!adapter.status().ready) throw new NotFoundException('LINE is not enabled on this server.');
    const raw = request.rawBody;
    if (!raw || !adapter.verify(raw, signature)) throw new ForbiddenException('Invalid LINE signature.');
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
