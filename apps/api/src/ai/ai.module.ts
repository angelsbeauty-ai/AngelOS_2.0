import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AiController } from './ai.controller';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';
import { StyleLearningService } from './style/style-learning.service';
import { BrainService } from './brain/brain.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiProviderService, StyleLearningService, BrainService, SupabaseAuthGuard],
  exports: [AiProviderService, StyleLearningService, BrainService]
})
export class AiModule {}
