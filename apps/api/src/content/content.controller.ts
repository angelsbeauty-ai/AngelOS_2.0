import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SocialService } from './social.service';
import { CreateCampaignDto, HashtagSetDto, LineBroadcastDto, LineDraftDto, MarkPostedDto, PlanDaysDto } from './dto/social.dto';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ContentService } from './content.service';
import { CreateComposerDraftDto } from './dto/create-composer-draft.dto';
import { CreateContentDraftDto } from './dto/create-content-draft.dto';
import { ReviewContentMediaDto } from './dto/review-content-media.dto';
import { ScheduleContentVariantDto } from './dto/schedule-content-variant.dto';
import { UpdateContentVariantDto } from './dto/update-content-variant.dto';

@Controller('workspaces/:workspaceId/content')
@UseGuards(SupabaseAuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService, private readonly social: SocialService) {}

  // B0 social extras. Static paths are declared before ':contentPostId' so they win.
  @Get('ideas') ideas(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.social.ideas(user, ws); }
  @Get('insights') insights(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Query('days') days?: string) { return this.social.insights(user, ws, Math.min(365, Math.max(7, Number(days) || 30))); }
  @Post('plan') plan(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: PlanDaysDto) { return this.social.planDays(user, ws, dto); }
  @Get('campaigns') campaigns(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.social.listCampaigns(user, ws); }
  @Post('campaigns') createCampaign(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: CreateCampaignDto) { return this.social.createCampaign(user, ws, dto); }
  @Post('campaigns/:campaignId/plan') planCampaign(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Param('campaignId') id: string) { return this.social.planCampaign(user, ws, id); }
  @Get('hashtag-sets') hashtagSets(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.social.listHashtagSets(user, ws); }
  @Post('hashtag-sets') saveHashtagSet(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: HashtagSetDto) { return this.social.saveHashtagSet(user, ws, dto); }
  @Delete('hashtag-sets/:setId') deleteHashtagSet(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Param('setId') id: string) { return this.social.deleteHashtagSet(user, ws, id); }
  @Get('line/estimate') lineEstimate(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string) { return this.social.lineEstimate(user, ws); }
  @Post('line/drafts') lineDraft(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Body() dto: LineDraftDto) { return this.social.lineDraft(user, ws, dto); }
  @Post('variants/:variantId/mark-posted') markPosted(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Param('variantId') id: string, @Body() dto: MarkPostedDto) { return this.social.markPosted(user, ws, id, dto); }
  @Post('variants/:variantId/line-broadcast') lineBroadcast(@CurrentUser() user: AuthUser, @Param('workspaceId') ws: string, @Param('variantId') id: string, @Body() dto: LineBroadcastDto) { return this.social.lineBroadcast(user, ws, id, dto.confirm); }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.content.list(user, workspaceId);
  }

  @Get(':contentPostId')
  get(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('contentPostId') contentPostId: string) {
    return this.content.get(user, workspaceId, contentPostId);
  }

  @Post('review-media')
  reviewMedia(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: ReviewContentMediaDto) {
    return this.content.reviewMedia(user, workspaceId, dto);
  }

  @Post()
  createDraft(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateContentDraftDto) {
    return this.content.createDraft(user, workspaceId, dto);
  }

  @Post('drafts')
  createComposerDraft(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateComposerDraftDto) {
    return this.content.createComposerDraft(user, workspaceId, dto);
  }

  @Post(':contentPostId/approve')
  approve(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('contentPostId') contentPostId: string) {
    return this.content.approve(user, workspaceId, contentPostId);
  }

  @Patch('variants/:variantId')
  updateVariant(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('variantId') variantId: string, @Body() dto: UpdateContentVariantDto) {
    return this.content.updateVariant(user, workspaceId, variantId, dto);
  }

  @Post('variants/:variantId/schedule')
  scheduleVariant(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('variantId') variantId: string, @Body() dto: ScheduleContentVariantDto) {
    return this.content.scheduleVariant(user, workspaceId, variantId, dto.scheduledFor);
  }

  @Post('variants/:variantId/publish')
  publishNow(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('variantId') variantId: string) {
    return this.content.publishNow(user, workspaceId, variantId);
  }
}
