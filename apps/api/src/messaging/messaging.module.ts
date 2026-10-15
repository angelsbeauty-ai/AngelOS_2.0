import { MetaWebhookController } from '../meta/meta-webhook.controller';
import { MetaConnectController, MetaOAuthCallbackController } from '../meta/meta-connect.controller';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { LineWebhookController } from './line-webhook.controller';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { SavedRepliesService } from './saved-replies.service';
import { SocialSyncService } from '../sync/social-sync.service';

@Module({
  imports: [AiModule],
  controllers: [MessagingController, LineWebhookController, MetaWebhookController, MetaConnectController, MetaOAuthCallbackController],
  providers: [MessagingService, SavedRepliesService, SocialSyncService, SupabaseAuthGuard],
  exports: [MessagingService, SavedRepliesService, SocialSyncService]
})
export class MessagingModule {}
