import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClientsModule } from '../clients/clients.module';
import { MessagingModule } from '../messaging/messaging.module';
import { SocialModule } from '../social/social.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({ imports: [AiModule, ClientsModule, MessagingModule, SocialModule, SuggestionsModule], controllers: [HomeController], providers: [HomeService, SupabaseAuthGuard] })
export class HomeModule {}
