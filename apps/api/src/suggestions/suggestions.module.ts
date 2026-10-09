import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ContentModule } from '../content/content.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AutomationsModule } from '../automations/automations.module';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [AiModule, MessagingModule, ContentModule, AutomationsModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, SupabaseAuthGuard]
})
export class SuggestionsModule {}
