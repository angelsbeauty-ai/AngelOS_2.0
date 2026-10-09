import { Module } from '@nestjs/common';
import { FounderController } from './founder.controller';
import { FounderGuard } from './founder.guard';
import { FounderService } from './founder.service';
import { BetaModule } from '../beta/beta.module';
import { AiModule } from '../ai/ai.module';
@Module({ imports: [BetaModule, AiModule], controllers: [FounderController], providers: [FounderGuard, FounderService] })
export class FounderModule {}
