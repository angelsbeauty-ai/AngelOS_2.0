import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { MessagingService } from './messaging.service';
import { SavedRepliesService } from './saved-replies.service';
import { CreateDemoChannelDto } from './dto/create-demo-channel.dto';
import { IngestMessageDto } from './dto/ingest-message.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { InternalNoteDto } from './dto/internal-note.dto';
import { TranslateMessageDto, TranslateTextDto } from './dto/translate-message.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { AddInboundDto } from './dto/add-inbound.dto';
import { ApproveReplyDto } from './dto/approve-reply.dto';
import { CreateSavedReplyDto, UpdateSavedReplyDto } from './dto/saved-reply.dto';

@Controller('workspaces/:workspaceId/messaging')
@UseGuards(SupabaseAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService, private readonly savedReplies: SavedRepliesService) {}

  @Get('channels') listChannels(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.messaging.listChannels(user, workspaceId); }
  @Get('connections') connections(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.messaging.connections(user, workspaceId); }
  @Post('connections/line') connectLine(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.messaging.connectLine(user, workspaceId); }
  @Post('channels/demo') createDemoChannel(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateDemoChannelDto) { return this.messaging.createDemoChannel(user, workspaceId, dto); }

  @Get('threads') listThreads(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query('view') view?: string) {
    return this.messaging.listThreads(user, workspaceId, view === 'archived' || view === 'all' ? view : 'active');
  }
  @Post('conversations') startConversation(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: StartConversationDto) { return this.messaging.startConversation(user, workspaceId, dto); }
  @Get('threads/:threadId') getThread(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string) { return this.messaging.getThread(user, workspaceId, threadId); }
  @Post('threads/:threadId/read') markRead(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string) { return this.messaging.markRead(user, workspaceId, threadId); }
  @Post('threads/:threadId/inbound') addInbound(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string, @Body() dto: AddInboundDto) { return this.messaging.addInbound(user, workspaceId, threadId, dto.body); }
  @Post('ingest-demo') ingestDemo(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: IngestMessageDto) { return this.messaging.ingestDemoMessage(user, workspaceId, dto); }
  @Post('threads/:threadId/ai-draft') draftReply(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string) { return this.messaging.draftReply(user, workspaceId, threadId); }
  @Post('threads/:threadId/replies') createReply(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string, @Body() dto: CreateReplyDto) { return this.messaging.createReply(user, workspaceId, threadId, dto); }
  @Post('messages/:messageId/translate') translateMessage(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('messageId') messageId: string, @Body() dto: TranslateMessageDto) { return this.messaging.translateMessage(user, workspaceId, messageId, dto.targetLanguage ?? 'en'); }
  @Post('translate') translateText(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: TranslateTextDto) { return this.messaging.translateText(user, workspaceId, dto.text, dto.targetLanguage ?? 'en'); }
  @Post('messages/:messageId/approve-send') approveAndSend(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('messageId') messageId: string, @Body() dto: ApproveReplyDto) { return this.messaging.approveAndSend(user, workspaceId, messageId, dto?.body); }
  @Post('messages/:messageId/mark-sent') markSent(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('messageId') messageId: string) { return this.messaging.markSentManually(user, workspaceId, messageId); }
  @Post('threads/:threadId/internal-notes') addInternalNote(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string, @Body() dto: InternalNoteDto) { return this.messaging.addInternalNote(user, workspaceId, threadId, dto.content); }
  @Patch('threads/:threadId') updateThread(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('threadId') threadId: string, @Body() dto: UpdateThreadDto) { return this.messaging.updateThread(user, workspaceId, threadId, dto); }

  @Get('saved-replies') listSavedReplies(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.savedReplies.list(user, workspaceId); }
  @Post('saved-replies') createSavedReply(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateSavedReplyDto) { return this.savedReplies.create(user, workspaceId, dto); }
  @Post('saved-replies/starters') seedSavedReplies(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) { return this.savedReplies.seedStarters(user, workspaceId); }
  @Patch('saved-replies/:replyId') updateSavedReply(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('replyId') replyId: string, @Body() dto: UpdateSavedReplyDto) { return this.savedReplies.update(user, workspaceId, replyId, dto); }
  @Delete('saved-replies/:replyId') deleteSavedReply(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Param('replyId') replyId: string) { return this.savedReplies.remove(user, workspaceId, replyId); }
}
