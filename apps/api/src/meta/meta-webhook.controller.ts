import { Controller, ForbiddenException, Get, Headers, HttpCode, Logger, NotFoundException, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { MessagingService } from '../messaging/messaging.service';
import { readMetaConfig } from './meta.config';
import { parseMetaWebhook, verifyMetaSignature } from './meta-messaging.adapter';

/** /webhooks/meta: Instagram + Messenger DMs. 404 unless META_MESSAGING_ENABLED. Trusts only a valid signature. */
@Controller('webhooks')
export class MetaWebhookController {
  private readonly logger = new Logger('MetaWebhook');
  constructor(private readonly messaging: MessagingService) {}

  @Get('meta')
  verify(@Query('hub.mode') mode?: string, @Query('hub.verify_token') token?: string, @Query('hub.challenge') challenge?: string) {
    const c = readMetaConfig();
    if (!c.messagingEnabled || !c.verifyToken) throw new NotFoundException();
    if (mode !== 'subscribe' || token !== c.verifyToken) throw new ForbiddenException();
    return challenge ?? '';
  }

  @Post('meta')
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
    const c = readMetaConfig();
    if (!c.messagingEnabled) throw new NotFoundException();
    if (!request.rawBody || !verifyMetaSignature(request.rawBody, signature, c.appSecret)) throw new ForbiddenException('Invalid signature.');
    const events = parseMetaWebhook(request.body);
    let stored = 0;
    for (const e of events) {
      try { const r: any = await this.messaging.ingestFromProvider(e, async () => undefined); if (r?.threadId) stored += 1; }
      catch (error) { this.logger.error(`Meta event not stored: ${error instanceof Error ? error.message : 'unknown'}`); }
    }
    return { ok: true, received: events.length, stored };
  }
}
