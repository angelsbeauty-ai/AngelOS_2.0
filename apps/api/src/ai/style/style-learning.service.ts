import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../../config/supabase';
import { AiProviderService } from '../ai-provider.service';
import type { ApproveSuggestedReplyDto, UpdateReplyStyleDto } from '../dto/update-reply-style.dto';
import { analyzeStyle, buildReplyStyleContext, findRepeatedReplies, similarity, type ReplySample } from './style-analyzer';

const STYLE_DEFAULTS = { learn_from_replies: true, reply_tone: 'casual_friendly', emoji_level: 'light', reply_length: 'short', style_notes: '', learned: {}, sample_count: 0, learned_at: null };
const LOOKBACK_DAYS = 180;
const RELEARN_AFTER = 5;

function missing(error: any) {
  const code = String(error?.code ?? '');
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(code) || /does not exist|schema cache/i.test(String(error?.message ?? ''));
}
const MIGRATION = '0016_v1_ai_reply_style.sql';

@Injectable()
export class StyleLearningService {
  private readonly logger = new Logger('StyleLearning');
  private readonly running = new Set<string>();
  constructor(private readonly provider: AiProviderService) {}

  async getStyle(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    await this.assertMember(supabase, workspaceId);
    const { data, error } = await supabase.from('ai_style_profiles').select('*').eq('workspace_id', workspaceId).maybeSingle();
    if (error) {
      if (missing(error)) return { style: { workspace_id: workspaceId, ...STYLE_DEFAULTS }, needsMigration: MIGRATION };
      throw new InternalServerErrorException(error.message);
    }
    return { style: data ?? { workspace_id: workspaceId, ...STYLE_DEFAULTS }, needsMigration: null };
  }

  async updateStyle(user: AuthUser, workspaceId: string, dto: UpdateReplyStyleDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    await this.assertMember(supabase, workspaceId);
    const row: Record<string, unknown> = { workspace_id: workspaceId, updated_at: new Date().toISOString() };
    if (dto.learnFromReplies !== undefined) row.learn_from_replies = dto.learnFromReplies;
    if (dto.replyTone !== undefined) row.reply_tone = dto.replyTone;
    if (dto.emojiLevel !== undefined) row.emoji_level = dto.emojiLevel;
    if (dto.replyLength !== undefined) row.reply_length = dto.replyLength;
    if (dto.styleNotes !== undefined) row.style_notes = dto.styleNotes.trim();
    const { data, error } = await supabase.from('ai_style_profiles').upsert(row, { onConflict: 'workspace_id' }).select('*').single();
    if (error) {
      if (missing(error)) throw new ConflictException(`This needs the database update ${MIGRATION} (waiting for Angel's yes). Nothing was changed.`);
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }

  /** "Learn now" button. */
  async learnNow(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    await this.assertMember(supabase, workspaceId);
    const { style, needsMigration } = await this.getStyle(user, workspaceId);
    if (needsMigration) throw new ConflictException(`This needs the database update ${needsMigration} (waiting for Angel's yes). Nothing was changed.`);
    if (!style.learn_from_replies) throw new ConflictException('Turn on "Learn from my replies" first.');
    return this.learnForWorkspace(workspaceId);
  }

  /** Called after every approved reply: re-learns quietly once enough new replies exist. Never throws. */
  async maybeLearn(workspaceId: string) {
    if (this.running.has(workspaceId)) return;
    try {
      const service = createServiceSupabaseClient();
      const { data: profile, error } = await service.from('ai_style_profiles').select('learn_from_replies,learned_at').eq('workspace_id', workspaceId).maybeSingle();
      if (error) return; // migration not applied yet: learning simply waits
      if (profile && profile.learn_from_replies === false) return;
      let query = service.from('client_messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('direction', 'outbound').in('status', ['queued', 'sent']);
      if (profile?.learned_at) query = query.gt('created_at', profile.learned_at);
      const { count } = await query;
      const needed = profile?.learned_at ? RELEARN_AFTER : 3;
      if ((count ?? 0) >= needed) await this.learnForWorkspace(workspaceId);
    } catch (error) {
      this.logger.warn(`Background learning skipped: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  /** Reads the owner's own approved replies, stores a style summary + repeated-reply suggestions. */
  async learnForWorkspace(workspaceId: string) {
    if (this.running.has(workspaceId)) return { skipped: 'already running' };
    this.running.add(workspaceId);
    try {
      const service = createServiceSupabaseClient();
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
      const [{ data: messages, error }, { data: clients }] = await Promise.all([
        service.from('client_messages').select('body,sender_type,status,metadata,created_at').eq('workspace_id', workspaceId)
          .eq('direction', 'outbound').in('status', ['queued', 'sent']).gte('created_at', since).order('created_at', { ascending: false }).limit(500),
        service.from('clients').select('display_name,first_name,last_name').eq('workspace_id', workspaceId).limit(2000)
      ]);
      if (error) throw new InternalServerErrorException(error.message);
      // Only her own words: replies she wrote, or AI drafts she edited before approving.
      const samples: ReplySample[] = (messages ?? [])
        .filter((m: any) => m.sender_type === 'owner' || m.metadata?.edited_by_owner === true)
        .map((m: any) => ({ body: String(m.body ?? ''), createdAt: m.created_at }));
      const names = (clients ?? []).flatMap((c: any) => [c.display_name, c.first_name, c.last_name]).filter(Boolean) as string[];
      const learned = analyzeStyle(samples, names);
      const now = new Date().toISOString();
      const { error: upsertError } = await service.from('ai_style_profiles').upsert({ workspace_id: workspaceId, learned, sample_count: learned.sampleCount, learned_at: now, updated_at: now }, { onConflict: 'workspace_id' });
      if (upsertError) {
        if (missing(upsertError)) throw new ConflictException(`This needs the database update ${MIGRATION} (waiting for Angel's yes).`);
        throw new InternalServerErrorException(upsertError.message);
      }
      const suggestions = await this.saveRepeatedReplies(workspaceId, findRepeatedReplies(samples, names));
      return { learned, newSuggestions: suggestions };
    } finally {
      this.running.delete(workspaceId);
    }
  }

  private async saveRepeatedReplies(workspaceId: string, candidates: ReturnType<typeof findRepeatedReplies>) {
    if (!candidates.length) return 0;
    const service = createServiceSupabaseClient();
    const { data: existing, error } = await service.from('saved_replies').select('id,status,body_en,body_ja,fingerprint').eq('workspace_id', workspaceId);
    if (error) { if (missing(error)) return 0; throw new InternalServerErrorException(error.message); }
    let created = 0;
    for (const candidate of candidates.slice(0, 10)) {
      const same = (existing ?? []).find((row: any) => row.fingerprint === candidate.fingerprint
        || similarity(candidate.body, (candidate.language === 'ja' ? row.body_ja : row.body_en) ?? '') >= 0.6);
      if (same) {
        if (same.status === 'suggested') await service.from('saved_replies').update({ occurrences: candidate.occurrences, last_seen_at: candidate.lastSeenAt, updated_at: new Date().toISOString() }).eq('id', same.id);
        continue; // approved or rejected already: never re-suggest
      }
      // Angel cannot read Japanese: a Japanese suggestion carries its English version.
      const english = candidate.language === 'ja'
        ? (await this.provider.generate({ instructions: 'TRANSLATE_TO=en\nTranslate naturally into English. Keep {name} and [brackets] as they are. Return only the translation.', input: candidate.body })).text.trim()
        : candidate.body;
      const { error: insertError } = await service.from('saved_replies').insert({
        workspace_id: workspaceId, title: candidate.title, category: candidate.category,
        body_en: english, body_ja: candidate.language === 'ja' ? candidate.body : null,
        status: 'suggested', source: 'learned', occurrences: candidate.occurrences, fingerprint: candidate.fingerprint, last_seen_at: candidate.lastSeenAt
      });
      if (!insertError) created += 1;
      else if (String((insertError as any).code) !== '23505') this.logger.warn(`Could not save a suggested reply: ${insertError.message}`);
    }
    return created;
  }

  async listSuggested(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('saved_replies').select('*').eq('workspace_id', workspaceId).eq('status', 'suggested').order('occurrences', { ascending: false });
    if (error) { if (missing(error)) return { replies: [], needsMigration: MIGRATION }; throw new InternalServerErrorException(error.message); }
    return { replies: data ?? [], needsMigration: null };
  }

  async decideSuggested(user: AuthUser, workspaceId: string, replyId: string, decision: 'approved' | 'rejected', dto?: ApproveSuggestedReplyDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const updates: Record<string, unknown> = { status: decision, updated_at: new Date().toISOString() };
    if (decision === 'approved') {
      if (dto?.title !== undefined) updates.title = dto.title.trim();
      if (dto?.bodyEn !== undefined) updates.body_en = dto.bodyEn.trim() || null;
      if (dto?.bodyJa !== undefined) updates.body_ja = dto.bodyJa.trim() || null;
      if (updates.body_en === null && updates.body_ja === null) throw new BadRequestException('Keep at least one language filled in.');
    }
    const { data, error } = await supabase.from('saved_replies').update(updates).eq('workspace_id', workspaceId).eq('id', replyId).eq('status', 'suggested').select('*').maybeSingle();
    if (error) { if (missing(error)) throw new ConflictException(`This needs the database update ${MIGRATION}.`); throw new InternalServerErrorException(error.message); }
    if (!data) throw new NotFoundException('Suggested reply not found');
    return data;
  }

  /** Style + approved saved replies for reply drafts (tolerant before migrations are applied). */
  async replyContext(user: AuthUser, workspaceId: string, intent: string, language: 'en' | 'ja') {
    const supabase = createUserSupabaseClient(user.accessToken);
    const [styleResult, repliesResult] = await Promise.all([
      supabase.from('ai_style_profiles').select('reply_tone,emoji_level,reply_length,style_notes,learned,learn_from_replies').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('saved_replies').select('*').eq('workspace_id', workspaceId).limit(60)
    ]);
    const style: any = styleResult.error ? null : styleResult.data;
    const replies = (repliesResult.error ? [] : repliesResult.data ?? []).filter((row: any) => (row.status ?? 'approved') === 'approved');
    return buildReplyStyleContext({
      manual: style ?? { reply_tone: 'casual_friendly', emoji_level: 'light', reply_length: 'short' },
      learned: style?.learn_from_replies === false ? null : style?.learned,
      savedReplies: replies, intent, language
    }) || undefined;
  }

  private async assertMember(supabase: ReturnType<typeof createUserSupabaseClient>, workspaceId: string) {
    const { data } = await supabase.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!data) throw new NotFoundException('Workspace not found');
  }
}
