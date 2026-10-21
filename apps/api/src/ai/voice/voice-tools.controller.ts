import { BadRequestException, Body, Controller, ForbiddenException, Headers, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { createServiceSupabaseClient } from '../../config/supabase';
import { AreaOffError, READ_TOOL_NAMES, STUDIO_ROLES, memberRole, runReadTool } from '../tools/read-tools';
import { verifyVoiceToken } from './voice-token';

/**
 * Voice worker endpoints, authorised ONLY by the short-lived scoped voice token.
 * Same read tools and toggles as text chat. The only write is a reply DRAFT; sending needs Angel's Approve tap.
 */
@Controller('voice-tools/:workspaceId')
export class VoiceToolsController {
  private async claims(auth: string | undefined, workspaceId: string) {
    const c = verifyVoiceToken(auth?.startsWith('Bearer ') ? auth.slice(7) : undefined, workspaceId);
    if (!c) throw new UnauthorizedException('Voice token is missing or expired');
    const db = createServiceSupabaseClient();
    const role = await memberRole(db, workspaceId, c.sub);
    if (!role) throw new ForbiddenException('Not a member of this studio');
    // Students never get studio tools.
    if (!STUDIO_ROLES.has(role)) throw new ForbiddenException('Studio tools are for the studio owner and staff only.');
    return { c, db };
  }

  @Post('tools/:name')
  async tool(@Headers('authorization') auth: string, @Param('workspaceId') workspaceId: string, @Param('name') name: string, @Body() args: Record<string, unknown>) {
    if (!READ_TOOL_NAMES.has(name)) throw new NotFoundException('Unknown tool');
    const { db } = await this.claims(auth, workspaceId);
    try { return await runReadTool(db, workspaceId, name, (args ?? {}) as Record<string, any>); }
    catch (e) { if (e instanceof AreaOffError) return { off: e.area, message: `${e.area} is off in What AngelOS can see.` }; throw e; }
  }

  @Post('draft-reply')
  async draft(@Headers('authorization') auth: string, @Param('workspaceId') workspaceId: string, @Body() body: { threadId?: string; body?: string }) {
    const text = String(body?.body ?? '').trim();
    if (!body?.threadId || !text) throw new BadRequestException('Missing the conversation or the reply.');
    const { c, db } = await this.claims(auth, workspaceId);
    const { data: thread } = await db.from('message_threads').select('id,client_id').eq('workspace_id', workspaceId).eq('id', body.threadId).maybeSingle();
    if (!thread) throw new NotFoundException('Conversation not found');
    const { data, error } = await db.from('client_messages').insert({
      workspace_id: workspaceId, thread_id: thread.id, client_id: thread.client_id ?? null, direction: 'outbound', sender_type: 'ai',
      body: text.slice(0, 2000), status: 'pending_approval', created_by: c.sub, metadata: { source: 'voice' }
    }).select('id').single();
    if (error) throw new BadRequestException(error.message);
    return { drafted: true, sent: false, messageId: data.id };
  }
}
