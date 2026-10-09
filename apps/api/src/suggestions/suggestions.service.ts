import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AiProviderService } from '../ai/ai-provider.service';
import { computeSuggestions, localDate, type Suggestion } from '../ai/suggestions/suggestion-rules';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import { ContentService } from '../content/content.service';
import { MessagingService } from '../messaging/messaging.service';
import { isMissingRelation } from '../messaging/saved-replies.service';

/**
 * C4 "AngelOS suggests" for messages and social posts.
 * Approve only ever creates DRAFTS (a reply draft or a post draft). Nothing client-facing is sent here.
 */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly messaging: MessagingService,
    private readonly content: ContentService,
    private readonly provider: AiProviderService
  ) {}

  /** Hook for the AngelOS brain (Step 4): a short marketing hint from summaries. */
  protected async marketingHint(_workspaceId: string): Promise<string | null> { return null; }

  async list(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: workspace, error } = await supabase.from('workspaces').select('id,timezone').eq('id', workspaceId).maybeSingle();
    if (error || !workspace) throw new NotFoundException('Workspace not found');
    const timeZone = workspace.timezone || 'Asia/Tokyo';
    const now = new Date();
    const windowStart = new Date(now.getTime() - 86400000).toISOString();
    const windowEnd = new Date(now.getTime() + 4 * 86400000).toISOString();
    const [threads, variants, pending, dismissals] = await Promise.all([
      this.messaging.listThreads(user, workspaceId, 'active'),
      supabase.from('content_variants').select('scheduled_for,status').eq('workspace_id', workspaceId).gte('scheduled_for', windowStart).lte('scheduled_for', windowEnd).not('status', 'in', '(failed,archived)'),
      supabase.from('client_messages').select('thread_id').eq('workspace_id', workspaceId).eq('sender_type', 'ai').eq('status', 'pending_approval'),
      supabase.from('ai_suggestion_dismissals').select('suggestion_key').eq('workspace_id', workspaceId).eq('dismissed_on', localDate(now, timeZone))
    ]);
    if (variants.error) throw new InternalServerErrorException(variants.error.message);
    const pendingThreads = new Set((pending.data ?? []).map((row: any) => row.thread_id));
    const suggestions = computeSuggestions({
      now, timeZone,
      plannedPostTimes: (variants.data ?? []).map((row: any) => row.scheduled_for).filter(Boolean),
      threads: threads.map((t: any) => ({
        id: t.id, name: t.client?.display_name ?? t.contact_display_name ?? 'a client', platformLabel: t.platform_label,
        lastDirection: t.last_direction, lastAt: t.last_message_at, status: t.status, archived: t.archived,
        hasPendingDraft: pendingThreads.has(t.id), preview: t.last_preview
      })),
      dismissedKeys: new Set((dismissals.error ? [] : dismissals.data ?? []).map((row: any) => row.suggestion_key)),
      marketingHint: await this.marketingHint(workspaceId).catch(() => null)
    });
    return { suggestions, dismissRemembered: !dismissals.error };
  }

  async dismiss(user: AuthUser, workspaceId: string, key: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: workspace } = await supabase.from('workspaces').select('id,timezone').eq('id', workspaceId).maybeSingle();
    if (!workspace) throw new NotFoundException('Workspace not found');
    const { error } = await supabase.from('ai_suggestion_dismissals').upsert({ workspace_id: workspaceId, suggestion_key: key, dismissed_on: localDate(new Date(), workspace.timezone || 'Asia/Tokyo'), dismissed_by: user.id }, { onConflict: 'workspace_id,suggestion_key,dismissed_on' });
    if (error) {
      if (isMissingRelation(error)) return { dismissed: true, remembered: false };
      throw new InternalServerErrorException(error.message);
    }
    return { dismissed: true, remembered: true };
  }

  /** Approve tap: executes exactly once per suggestion per day; result is recorded in ai_action_runs. */
  async approve(user: AuthUser, workspaceId: string, key: string) {
    const listed = await this.list(user, workspaceId);
    const service = createServiceSupabaseClient();
    const { data: controls } = await service.from('workspace_operational_controls').select('pause_ai_actions,emergency_read_only').eq('workspace_id', workspaceId).maybeSingle();
    if (controls?.emergency_read_only) throw new ConflictException('AngelOS is in read-only mode right now, so nothing was created.');
    if (controls?.pause_ai_actions) throw new ConflictException('AI actions are paused. Turn them back on in Needs attention to use suggestions.');

    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: previous } = await service.from('ai_action_runs').select('id,result,status').eq('workspace_id', workspaceId).eq('action_key', `suggestion:${key.split(':')[0]}`).eq('status', 'succeeded').contains('input', { suggestionKey: key }).gte('created_at', since).limit(1);
    if (previous?.length) return { ...(previous[0].result as Record<string, unknown>), duplicatePrevented: true };

    const suggestion: Suggestion | undefined = listed.suggestions.find((item) => item.key === key);
    if (!suggestion) throw new NotFoundException('This suggestion is no longer needed.');

    let result: Record<string, unknown>;
    if (suggestion.kind === 'draft_reply') {
      const draft = await this.messaging.draftReply(user, workspaceId, suggestion.input.threadId);
      result = { kind: 'draft_reply', threadId: suggestion.input.threadId, messageId: draft.message.id, sent: false };
    } else if (suggestion.kind === 'create_post_draft') {
      const caption = await this.writeCaption(user, workspaceId, suggestion);
      const post: any = await this.content.createComposerDraft(user, workspaceId, {
        title: `Post idea for ${suggestion.input.date}`, objective: 'bookings', goal: 'Keep the social calendar full (AngelOS suggestion)',
        language: 'en', caption, format: 'photo', platforms: ['instagram'], plannedFor: suggestion.input.plannedFor
      } as any);
      result = { kind: 'create_post_draft', contentPostId: post.id, date: suggestion.input.date, published: false };
    } else {
      throw new BadRequestException('Unknown suggestion');
    }

    const now = new Date().toISOString();
    await service.from('ai_action_runs').insert({
      workspace_id: workspaceId, requested_by: user.id, action_key: `suggestion:${suggestion.kind}`, risk_level: 'low', status: 'succeeded',
      input: { suggestionKey: key, ...suggestion.input }, result, verification: { verified: true, check: 'draft row returned by the service' },
      approved_by: user.id, approved_at: now, updated_at: now
    });
    return { ...result, duplicatePrevented: false };
  }

  private async writeCaption(user: AuthUser, workspaceId: string, suggestion: Suggestion) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const [{ data: workspace }, { data: recent }] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
      supabase.from('content_posts').select('title').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(5)
    ]);
    const hint = await this.marketingHint(workspaceId).catch(() => null);
    const response = await this.provider.generate({
      instructions: [
        'POST_CAPTION_DRAFT', 'language=en', `angle=${hint ?? 'healed results and booking'}`,
        `Write one Instagram caption (max 600 characters) in English for "${workspace?.name ?? 'the studio'}", a permanent makeup studio.`,
        'Warm, natural, no medical claims, no invented prices or dates. End with a soft call to book via DM or LINE. No hashtags.',
        recent?.length ? `Avoid repeating these recent post topics: ${recent.map((r: any) => r.title).join(' | ')}` : ''
      ].filter(Boolean).join('\n'),
      input: `Draft a post for ${suggestion.input.date}.`
    });
    return response.text.trim().slice(0, 2200);
  }
}
