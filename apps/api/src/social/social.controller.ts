import { Query, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { SocialAccountsService } from './social-accounts.service';

export class ConnectLineDto {
  @IsString() @MaxLength(40) channelId!: string;
  @IsString() @MaxLength(200) channelSecret!: string;
  @IsString() @MaxLength(1000) accessToken!: string;
}

/** Connected-account status + numbers. Meta login routes are Gordon's (see connectPath in the accounts answer). */
@Controller('workspaces/:workspaceId/social')
@UseGuards(SupabaseAuthGuard)
export class SocialController {
  constructor(private readonly accounts: SocialAccountsService) {}
  @Get('accounts') list(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.accounts.accounts(user, ws); }
  @Post('line/connect') connectLine(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: ConnectLineDto) { return this.accounts.connectLine(user, ws, dto); }
  @Get('insights') insights(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Query('platform') platform?: string) { return this.accounts.insights(user, ws, ['instagram', 'facebook', 'line'].includes(platform ?? '') ? platform! : 'all'); }
  @Get('numbers') numbers(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.accounts.numbers(user, ws); }
}
