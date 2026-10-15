import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialController } from './social.controller';
import { SocialPublisherService } from './social-publisher.service';

@Module({ controllers: [SocialController], providers: [SocialAccountsService, SocialPublisherService], exports: [SocialAccountsService] })
export class SocialModule {}
