import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { createUserSupabaseClient } from '../config/supabase';
import { MessagingService } from '../messaging/messaging.service';
import { SocialAccountsService } from '../social/social-accounts.service';
import { ClientsService } from '../clients/clients.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { assistantBox, BRIEFING_INSTRUCTIONS, factLines, messagesBox, periodWindow, scheduleBox, socialBox, type Period } from './home-logic';

@Injectable()
export class HomeService {
  private briefings = new Map<string, { text: string; source: 'ai' | 'facts'; at: string }>();
  constructor(private readonly messaging: MessagingService, private readonly social: SocialAccountsService, private readonly clients: ClientsService, private readonly ai: AiProviderService, private readonly suggestions: SuggestionsService) {}

  async summary(user: AuthUser, workspaceId: string, period: Period = 'day') {
    const db = createUserSupabaseClient(user.accessToken);
    const { data: ws, error } = await db.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (error || !ws) throw new NotFoundException('Workspace not found');
    const now = new Date();
    const { start, end } = periodWindow(period, now);
    const notes: string[] = [];
    const safe = async <T>(label: string, p: PromiseLike<T> | Promise<T>, fallback: T): Promise<T> => { try { return await p; } catch { notes.push(label); return fallback; } };
    const [apptsRes, threads, numbers, touchUps, postsRes, pendingRes, sugRes, schedRes] = await Promise.all([
      safe('bookings', db.from('appointments').select('id,start_at,end_at,status,service_name,client_id,client:clients(id,display_name)').eq('workspace_id', workspaceId).gte('start_at', start.toISOString()).lt('start_at', end.toISOString()).order('start_at').then((r: any) => r), { data: [] } as any),
      safe('messages', this.messaging.listThreads(user, workspaceId, 'active'), [] as any[]),
      safe('social', this.social.numbers(user, workspaceId), { connected: [], items: [] } as any),
      safe('touch-ups', this.clients.list(user, workspaceId, '', { touchUpDue: true }), [] as any[]),
      safe('posts', db.from('content_variants').select('platform,published_at,post:content_posts(title)').eq('workspace_id', workspaceId).eq('status', 'published').gte('published_at', start.toISOString()).lt('published_at', end.toISOString()).order('published_at', { ascending: false }).limit(10).then((r: any) => r), { data: [] } as any),
      safe('approvals', db.from('client_messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending_approval').then((r: any) => r), { count: 0 } as any),
      safe('suggestions', this.suggestions.list(user, workspaceId), { suggestions: [] } as any),
      safe('scheduled posts', db.from('content_variants').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'scheduled').gte('scheduled_for', now.toISOString()).then((r: any) => r), { count: 0 } as any)
    ]);
    if (apptsRes?.error) notes.push('bookings');
    const appts = ((apptsRes?.data ?? []) as any[]).map((a) => ({ id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status, service_name: a.service_name ?? null, client_id: a.client_id ?? null, client_name: a.client?.display_name ?? null }));
    const clientIds = Array.from(new Set(appts.map((a) => a.client_id).filter(Boolean))) as string[];
    let returning = new Set<string>();
    if (clientIds.length) {
      const prior = await db.from('appointments').select('client_id').eq('workspace_id', workspaceId).in('client_id', clientIds).lt('start_at', start.toISOString()).neq('status', 'cancelled').limit(1000);
      if (!prior.error) returning = new Set((prior.data ?? []).map((r: any) => r.client_id));
    }
    const schedule = scheduleBox(appts, returning, (touchUps as any[]).length, now);
    const messages = messagesBox((threads as any[]).map((t) => ({ id: t.id, unread: !!t.unread, needs_reply: !!t.needs_reply, status: t.status, intent: t.intent, priority: t.priority, needs_owner: !!t.needs_owner, name: t.client?.display_name ?? t.contact_display_name ?? 'Client', platform_label: t.platform_label, last_message_at: t.last_message_at, preview: t.last_preview ?? null })));
    const social = socialBox((numbers?.items ?? []) as any[], ((postsRes?.data ?? []) as any[]).map((p) => ({ title: p.post?.title ?? '', platform: p.platform, published_at: p.published_at })));
    const assistant = assistantBox(((sugRes?.suggestions ?? []) as any[]).map((x) => ({ key: x.key, title: x.title, reason: x.detail ?? null })), pendingRes?.count ?? 0);
    return { period, range: { start: start.toISOString(), end: end.toISOString() }, generatedAt: now.toISOString(), schedule, messages, social, assistant, important: { scheduledPosts: schedRes?.error ? null : (schedRes?.count ?? 0), tasks: assistant.pendingApprovals + assistant.suggestions.length, approvals: assistant.pendingApprovals }, unavailable: Array.from(new Set(notes)) };
  }

  /** Numbers-only briefing, cached per studio per day (and refreshed when the facts change). */
  async briefing(user: AuthUser, workspaceId: string) {
    const s = await this.summary(user, workspaceId, 'day');
    const facts = factLines(s as any, 'day');
    const day = new Date(Date.now() + 540 * 60000).toISOString().slice(0, 10);
    const key = `${workspaceId}:${day}:${facts.join('|')}`;
    const hit = this.briefings.get(key);
    if (hit) return { ...hit, facts, cached: true };
    let text = facts.join(' '); let source: 'ai' | 'facts' = 'facts';
    if ((process.env.AI_PROVIDER_MODE ?? 'mock') === 'openai') {
      try { const r = await this.ai.generate({ instructions: BRIEFING_INSTRUCTIONS, input: `Facts:\n- ${facts.join('\n- ')}`, userId: user.id }); if (r.text?.trim()) { text = r.text.trim().slice(0, 600); source = 'ai'; } } catch { /* fall back to facts */ }
    }
    for (const k of this.briefings.keys()) if (k.startsWith(`${workspaceId}:`)) this.briefings.delete(k);
    const out = { text, source, at: new Date().toISOString() };
    this.briefings.set(key, out);
    return { ...out, facts, cached: false };
  }
}
