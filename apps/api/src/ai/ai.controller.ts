import { createUserSupabaseClient } from '../config/supabase';
import { limitState, usageFor } from './ai-usage';
import { BadRequestException, ForbiddenException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AREAS, AreaOffError, READ_TOOLS, READ_TOOL_NAMES, RoleNotAllowedError, memberRole, runReadTool, type Area } from './tools/read-tools';
import { StyleLearningService } from './style/style-learning.service';
import { BrainService } from './brain/brain.service';
import { ApproveSuggestedReplyDto, UpdateReplyStyleDto } from './dto/update-reply-style.dto';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AiService } from './ai.service';
import { TOOLS } from './tools/registry';
import { VoiceService } from './voice/voice.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMemoryDto, AddSkillDto } from './dto/create-memory.dto';
import { SendAiMessageDto } from './dto/send-ai-message.dto';
import { UpdateAssistantProfileDto } from './dto/update-assistant-profile.dto';
import { UpdateAssistantRolesDto } from './dto/update-assistant-roles.dto';

@Controller('workspaces/:workspaceId/ai')
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService, private readonly style: StyleLearningService, private readonly brain: BrainService, private readonly voice: VoiceService) {}

  /** What AngelOS remembers about this workspace: short summaries, tags and counts only. */
  @Get('brain')
  brainSummaries(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.brain.listForWorkspace(user, workspaceId);
  }

  // How the assistant writes to clients: manual settings + what it learned from the owner's replies.
  @Get('style') getStyle(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.style.getStyle(user, workspaceId); }
  @Patch('style') updateStyle(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: UpdateReplyStyleDto) { return this.style.updateStyle(user, workspaceId, dto); }
  @Post('style/learn') learnStyle(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.style.learnNow(user, workspaceId); }
  @Get('style/suggested-replies') suggestedReplies(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.style.listSuggested(user, workspaceId); }
  @Post('style/suggested-replies/:replyId/approve') approveSuggested(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('replyId') replyId: string, @Body() dto: ApproveSuggestedReplyDto) { return this.style.decideSuggested(user, workspaceId, replyId, 'approved', dto); }
  @Post('style/suggested-replies/:replyId/reject') rejectSuggested(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('replyId') replyId: string) { return this.style.decideSuggested(user, workspaceId, replyId, 'rejected'); }

  @Get('tools') listTools() { return { tools: TOOLS, read: READ_TOOLS.map(({ name, area, description }) => ({ name, area, description })) }; }
  /** Shared read tools (text + phone voice), same toggles and studio scope. */
  @Post('tools/:name') async runTool(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('name') name: string, @Body() args: Record<string, unknown>) {
    if (!READ_TOOL_NAMES.has(name)) throw new NotFoundException('Unknown tool');
    const db = createUserSupabaseClient(user.accessToken);
    try { return await runReadTool(db, workspaceId, name, (args ?? {}) as Record<string, any>, new Date(), undefined, await memberRole(db, workspaceId, user.id)); }
    catch (e) { if (e instanceof RoleNotAllowedError) throw new ForbiddenException(e.message); if (e instanceof AreaOffError) return { off: e.area, message: `${e.area} is off in What AngelOS can see.` }; throw e; }
  }
  /** What AngelOS can see: per-area switches (all on until changed). */
  @Get('data-access') async getAccess(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    const db = createUserSupabaseClient(user.accessToken);
    const { data, error } = await db.from('ai_data_access').select('area,enabled').eq('workspace_id', workspaceId);
    const off = new Set((data ?? []).filter((r: any) => r.enabled === false).map((r: any) => r.area));
    return { areas: AREAS.map((area) => ({ area, enabled: !off.has(area) })), needsMigration: error ? '0027_ai_data_access.sql' : null };
  }
  @Put('data-access') async setAccess(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() body: { area?: string; enabled?: boolean }) {
    if (!AREAS.includes(body?.area as Area) || typeof body?.enabled !== 'boolean') throw new BadRequestException('Pick an area and on/off.');
    const db = createUserSupabaseClient(user.accessToken);
    const { error } = await db.from('ai_data_access').upsert({ workspace_id: workspaceId, area: body.area, enabled: body.enabled, updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) throw new BadRequestException(/relation|does not exist|schema cache/i.test(error.message) ? 'Needs the 0027_ai_data_access migration.' : error.message);
    return { area: body.area, enabled: body.enabled };
  }
  @Get('usage') usage(@CurrentUser() user: AuthUser) { return usageFor(user.id).then((u) => u ?? { ...limitState(0, 0), unavailable: true }); }
  @Get('voice/status') voiceStatus() { return this.voice.status(); }
  @Post('voice/session') voiceSession(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() body: { screen?: string; context?: string }) { return this.voice.createSession(user, workspaceId, typeof body?.screen === 'string' ? body.screen.slice(0, 60) : null, typeof body?.context === 'string' ? body.context.slice(0, 1500) : null); }
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.ai.getProfile(user, workspaceId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateAssistantProfileDto
  ) {
    return this.ai.updateProfile(user, workspaceId, dto);
  }

  @Put('roles')
  updateRoles(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateAssistantRolesDto
  ) {
    return this.ai.updateRoles(user, workspaceId, dto);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateConversationDto
  ) {
    return this.ai.createConversation(user, workspaceId, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.ai.listConversations(user, workspaceId);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string
  ) {
    return this.ai.listMessages(user, workspaceId, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendAiMessageDto
  ) {
    return this.ai.sendMessage(user, workspaceId, conversationId, dto);
  }

  @Post('actions/:actionId/approve')
  approveAction(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('actionId') actionId: string
  ) {
    return this.ai.approveAction(user, workspaceId, actionId);
  }

  @Post('actions/:actionId/cancel')
  cancelAction(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('actionId') actionId: string
  ) {
    return this.ai.cancelAction(user, workspaceId, actionId);
  }

  @Get('memory')
  listMemory(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.ai.listMemory(user, workspaceId);
  }

  @Post('memory')
  proposeMemory(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateMemoryDto
  ) {
    return this.ai.proposeMemory(user, workspaceId, dto);
  }

  @Post('skills')
  addSkill(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: AddSkillDto) {
    return this.ai.addSkill(user, workspaceId, dto.content);
  }

  @Post('skills/:skillId/retire')
  retireSkill(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('skillId') skillId: string) {
    return this.ai.retireSkill(user, workspaceId, skillId);
  }
}
