import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { HomeService } from './home.service';

@Controller('workspaces/:workspaceId/home')
@UseGuards(SupabaseAuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}
  @Get('summary') summary(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query('period') period?: string) {
    return this.home.summary(user, workspaceId, period === 'week' || period === 'month' ? period : 'day');
  }
  @Get('briefing') briefing(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.home.briefing(user, workspaceId); }
}
