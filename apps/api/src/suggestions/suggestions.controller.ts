import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { SuggestionsService } from './suggestions.service';

@Controller('workspaces/:workspaceId/ai/suggestions')
@UseGuards(SupabaseAuthGuard)
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.suggestions.list(user, workspaceId); }
  @Post(':key/approve') approve(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('key') key: string) { return this.suggestions.approve(user, workspaceId, key); }
  @Post(':key/dismiss') dismiss(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('key') key: string) { return this.suggestions.dismiss(user, workspaceId, key); }
}
