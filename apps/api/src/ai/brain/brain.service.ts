import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../../config/supabase';
import { isMissingRelation } from '../../messaging/saved-replies.service';
import { marketingHintFrom, noteClientRequest, noteOwnerRequest, notePreference, topicLabel, type BrainNote } from './brain-taxonomy';

const MIGRATION = '0018_v1_ai_brain_summaries';

/**
 * AngelOS brain: remembers SHORT SUMMARIES, tags and counts only.
 * Callers hand over text/intent; this service turns it into fixed topic keys (brain-taxonomy)
 * and never stores, logs or returns the original words.
 */
@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);

  /** Fire-and-forget. Never throws, never blocks the caller. */
  rememberOwnerRequest(workspaceId: string, text: string, language?: string | null) {
    void this.save(workspaceId, noteOwnerRequest(text, language));
  }

  rememberClientRequest(workspaceId: string, intent: string, platform?: string | null, language?: string | null) {
    const note = noteClientRequest(intent, platform, language);
    void this.save(workspaceId, note ? [note] : []);
  }

  rememberPreferences(workspaceId: string, prefs: Record<string, string | boolean | undefined>) {
    const notes = Object.entries(prefs)
      .filter(([, value]) => value !== undefined)
      .map(([setting, value]) => notePreference(setting, value as string | boolean))
      .filter((note): note is BrainNote => !!note);
    void this.save(workspaceId, notes);
  }

  async save(workspaceId: string, notes: BrainNote[]) {
    if (!notes.length) return 0;
    try {
      const service = createServiceSupabaseClient();
      let saved = 0;
      for (const note of notes) {
        const { error } = await service.rpc('ai_brain_record', {
          p_workspace_id: workspaceId, p_kind: note.kind, p_topic: note.topic, p_summary: note.summary, p_tags: note.tags
        });
        if (error) {
          // Before 0018 runs this simply does nothing. Only the error code is logged, never content.
          this.logger.debug(`brain note skipped (${error.code ?? 'error'})`);
          return saved;
        }
        saved += 1;
      }
      return saved;
    } catch {
      return 0;
    }
  }

  /** The workspace's own summaries (RLS: members only). */
  async listForWorkspace(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase
      .from('ai_brain_summaries')
      .select('kind,topic,summary,tags,request_count,first_seen_at,last_seen_at')
      .eq('workspace_id', workspaceId)
      .order('request_count', { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingRelation(error)) return { summaries: [], needsMigration: MIGRATION };
      throw new InternalServerErrorException(error.message);
    }
    return { summaries: data ?? [], needsMigration: null };
  }

  /** Founder-only (guarded in the controller). Anonymised counts: topic -> workspaces, requests. */
  async aggregates(days = 90, minWorkspaces = 1) {
    const service = createServiceSupabaseClient();
    const { data, error } = await service.rpc('ai_brain_topic_aggregates', { p_days: days, p_min_workspaces: minWorkspaces });
    if (error) {
      if (isMissingRelation(error) || error.code === 'PGRST202' || error.code === '42883') return { topics: [], needsMigration: MIGRATION, days, minWorkspaces };
      throw new InternalServerErrorException(error.message);
    }
    const topics = ((data ?? []) as Array<{ kind: string; topic: string; workspaces: number | string; requests: number | string }>).map((row) => ({
      kind: row.kind,
      topic: row.topic,
      label: topicLabel(row.kind, row.topic),
      workspaces: Number(row.workspaces),
      requests: Number(row.requests)
    }));
    return { topics, needsMigration: null, days, minWorkspaces, generatedAt: new Date().toISOString() };
  }

  /**
   * Marketing angle for AngelOS recommendations. Uses the workspace's own client topics (read with
   * the member's own RLS client); if there are none yet, falls back to the anonymised aggregate
   * (only topics seen in 2+ studios).
   */
  async marketingHint(user: AuthUser, workspaceId: string): Promise<string | null> {
    try {
      const supabase = createUserSupabaseClient(user.accessToken);
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('ai_brain_summaries')
        .select('topic,request_count')
        .eq('workspace_id', workspaceId)
        .eq('kind', 'client_request')
        .gte('last_seen_at', since)
        .limit(20);
      if (error) return null;
      const own = marketingHintFrom((data ?? []).map((row: any) => ({ topic: row.topic, count: Number(row.request_count) })), 'own');
      if (own) return own;
      const all = await this.aggregates(60, 2);
      return marketingHintFrom(all.topics.filter((t) => t.kind === 'client_request').map((t) => ({ topic: t.topic, count: t.workspaces })), 'all');
    } catch {
      return null;
    }
  }

  /** One short line for the AI chat context. */
  async contextLine(user: AuthUser, workspaceId: string): Promise<string | null> {
    try {
      const supabase = createUserSupabaseClient(user.accessToken);
      const { data, error } = await supabase
        .from('ai_brain_summaries')
        .select('kind,topic,request_count')
        .eq('workspace_id', workspaceId)
        .order('request_count', { ascending: false })
        .limit(12);
      if (error || !data?.length) return null;
      const pick = (kind: string) => data.filter((row: any) => row.kind === kind).slice(0, 3).map((row: any) => `${topicLabel(kind, row.topic)} (${row.request_count})`);
      const parts = [
        pick('client_request').length ? `clients most often ask about ${pick('client_request').join(', ')}` : '',
        pick('owner_request').length ? `the owner most often asks for help with ${pick('owner_request').join(', ')}` : '',
        pick('owner_preference').length ? `the owner prefers ${pick('owner_preference').map((p) => p.replace(/ \(\d+\)$/, '')).join(', ')}` : ''
      ].filter(Boolean);
      return parts.length ? `AngelOS memory (summaries only): ${parts.join('; ')}.` : null;
    } catch {
      return null;
    }
  }
}
