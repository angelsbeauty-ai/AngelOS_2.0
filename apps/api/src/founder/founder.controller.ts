import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BrainService } from '../ai/brain/brain.service';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FounderGuard } from './founder.guard';
import { FounderService } from './founder.service';
import { BetaService } from '../beta/beta.service';
import { CreateBetaInviteDto } from '../beta/dto/create-beta-invite.dto';
import { UpdateBetaFeedbackDto } from '../beta/dto/update-beta-feedback.dto';

@Controller('founder')
@UseGuards(SupabaseAuthGuard, FounderGuard)
export class FounderController {
  constructor(private readonly founder: FounderService, private readonly beta: BetaService, private readonly brain: BrainService) {}
  @Get('me') me(@CurrentUser() user: AuthUser) { return this.founder.me(user); }
  @Get('overview') overview() { return this.founder.overview(); }
  @Get('workspaces') workspaces() { return this.founder.workspaces(); }
  @Get('feature-flags') flags() { return this.founder.featureFlags(); }
  @Patch('feature-flags/:key') updateFlag(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) { return this.founder.updateFeatureFlag(user, key, dto); }

  @Get('beta/overview') betaOverview() { return this.beta.overview(); }
  @Get('beta/invites') betaInvites() { return this.beta.listInvites(); }
  @Post('beta/invites') createBetaInvite(@CurrentUser() user: AuthUser, @Body() dto: CreateBetaInviteDto) { return this.beta.createInvite(user, dto); }
  @Post('beta/invites/:id/revoke') revokeBetaInvite(@Param('id') id: string) { return this.beta.revokeInvite(id); }
  @Post('beta/testers/:userId/revoke') revokeBetaTester(@Param('userId') userId: string) { return this.beta.revokeTester(userId); }
  @Get('beta/feedback') betaFeedback() { return this.beta.listFeedback(); }
  @Patch('beta/feedback/:id') updateBetaFeedback(@Param('id') id: string, @Body() dto: UpdateBetaFeedbackDto) { return this.beta.updateFeedback(id, dto); }
  /** AngelOS brain, anonymised: topic -> number of studios and requests. No ids, names, emails or text. */
  @Get('brain/aggregates') brainAggregates(@Query('days') days?: string, @Query('minWorkspaces') minWorkspaces?: string) {
    const d = Math.min(365, Math.max(1, Number.parseInt(days ?? '90', 10) || 90));
    const m = Math.min(1000, Math.max(1, Number.parseInt(minWorkspaces ?? '1', 10) || 1));
    return this.brain.aggregates(d, m);
  }
  @Get('student-discounts') discounts() { return this.founder.listStudentDiscounts(); }
  @Post('student-discounts') createDiscount(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDiscountDto) { return this.founder.createStudentDiscount(user, dto); }
  @Post('student-discounts/:id/revoke') revokeDiscount(@Param('id') id: string) { return this.founder.revokeStudentDiscount(id); }
}
