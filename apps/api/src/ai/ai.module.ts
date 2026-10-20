import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AiController } from './ai.controller';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';
import { StyleLearningService } from './style/style-learning.service';
import { BrainService } from './brain/brain.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { VoiceService } from './voice/voice.service';
import { VoiceToolsController } from './voice/voice-tools.controller';

@Module({
  controllers: [AiController, VoiceToolsController],
  providers: [AiService, AiProviderService, StyleLearningService, BrainService, AssistantToolsService, VoiceService, SupabaseAuthGuard],
  exports: [AiProviderService, StyleLearningService, BrainService]
})
export class AiModule {}
