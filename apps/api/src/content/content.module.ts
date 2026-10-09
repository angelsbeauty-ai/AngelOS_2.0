import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { SocialService } from './social.service';

@Module({
  imports: [AiModule],
  controllers: [ContentController],
  providers: [ContentService, SocialService],
  exports: [ContentService, SocialService]
})
export class ContentModule {}
