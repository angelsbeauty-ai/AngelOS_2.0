import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { LineWebhookController } from './line-webhook.controller';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { SavedRepliesService } from './saved-replies.service';

@Module({
  imports: [AiModule],
  controllers: [MessagingController, LineWebhookController],
  providers: [MessagingService, SavedRepliesService, SupabaseAuthGuard],
  exports: [MessagingService, SavedRepliesService]
})
export class MessagingModule {}
