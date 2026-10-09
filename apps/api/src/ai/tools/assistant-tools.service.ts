import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { AuthUser } from '../../auth/auth-user';
import { createUserSupabaseClient } from '../../config/supabase';
import { AiProviderService } from '../ai-provider.service';
import { StyleLearningService } from '../style/style-learning.service';
import { localDate } from '../suggestions/suggestion-rules';
import { localIso, type PlannedTool } from './registry';

const JA = /[\u3040-\u30ff\u4e00-\u9faf]/;
const yen = (n: number, currency = 'JPY') => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(n); } catch { return `${currency} ${n}`; } };

/**
 * Runs C1 tools. Other feature services are looked up lazily (ModuleRef, strict:false) so the AI module
 * does not import every feature module (they import the AI module themselves).
 */
@Injectable()
export class AssistantToolsService {
  constructor(private readonly moduleRef: ModuleRef, private readonly provider: AiProviderService, private readonly style: StyleLearningService) {}

  private svc<T>(name: string): T {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const map: Record<string, () => any> = {
      finance: () => require('../../finance/finance.service').FinanceService,
      bookings: () => require('../../bookings/bookings.service').BookingsService,
      content: () => require('../../content/content.service').ContentService,
      messaging: () => require('../../messaging/messaging.service').MessagingService
    };
    return this.moduleRef.get(map[name](), { strict: false });
  }

  /** Read tools answer from her own records. No AI call, no cost. */
  async read(user: AuthUser, workspaceId: string, tool: PlannedTool, timeZone: string): Promise<string> {
    if (tool.key === 'today_schedule') {
      const day = String(tool.input.day ?? localDate(new Date(), timeZone));
      const supabase = createUserSupabaseClient(user.accessToken);
      const { data } = await supabase.from('appointments').select('start_at,service_name,status,client:clients(display_name)').eq('workspace_id', workspaceId)
        .gte('start_at', localIso(day, '00:00', timeZone)).lt('start_at', new Date(Date.parse(localIso(day, '00:00', timeZone)) + 86400000).toISOString())
        .not('status', 'in', '(cancelled)').order('start_at');
      const label = day === localDate(new Date(), timeZone) ? 'Today' : day;
      if (!data?.length) return `${label}: no bookings.`;
      const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
      return `${label}: ${data.length} booking${data.length > 1 ? 's' : ''}.\n` + data.map((a: any) => `• ${time(a.start_at)} ${a.client?.display_name ?? 'Client'} – ${a.service_name}${a.status !== 'confirmed' ? ` (${String(a.status).replaceAll('_', ' ')})` : ''}`).join('\n');
    }
    const finance: any = this.svc('finance');
    const s = await finance.summary(user, workspaceId);
    if (tool.key === 'who_owes') {
      if (!s.owes.length) return 'Nobody owes you money right now. All finished bookings are paid.';
      return `${s.owes.length} still owe${s.owes.length === 1 ? 's' : ''}:\n` + s.owes.slice(0, 10).map((o: any) => `• ${o.clientName ?? 'Client'} – ${o.service}: ${yen(o.due, s.currency)}`).join('\n') + '\nI never remind clients about money on my own.';
    }
    if (tool.key === 'money_summary') {
      const period = tool.input.period === 'today' ? 'today' : tool.input.period === 'month' ? 'month' : 'week';
      const label = period === 'today' ? 'Today' : period === 'month' ? 'Last 30 days' : 'Last 7 days';
      return `${label}: ${yen(s.income[period], s.currency)} received, ${yen(s.expenses[period], s.currency)} spent. Only money actually received is counted.`;
    }
    throw new BadRequestException('Unknown tool');
  }

  /** Runs an approved tool. Called only from the Approve tap (AiService.approveAction). */
  async execute(user: AuthUser, workspaceId: string, action: { id: string; action_key: string; input: any }): Promise<Record<string, unknown>> {
    const input = action.input ?? {};
    if (action.action_key === 'block_time') {
      const bookings: any = this.svc('bookings');
      const block = await bookings.createBlock(user, workspaceId, { title: input.title ?? 'Blocked', blockType: input.blockType ?? 'personal', startAt: input.startAt, endAt: input.endAt, notes: 'Added by AngelOS after your approval' });
      return { blockId: block?.id ?? block?.block?.id ?? null, startAt: input.startAt, endAt: input.endAt };
    }
    if (action.action_key === 'record_expense') {
      const finance: any = this.svc('finance');
      const res = await finance.recordExpense(user, workspaceId, { amount: Number(input.amount), category: input.category ?? 'other', note: input.note ?? undefined, idempotencyKey: `ai-action:${action.id}` });
      return { expenseId: res.expense?.id ?? null, duplicatePrevented: res.duplicatePrevented };
    }
    if (action.action_key === 'create_post_draft') {
      const topic = String(input.topic ?? '').slice(0, 160);
      const caption = (await this.provider.generate({ instructions: `POST_CAPTION_DRAFT\nlanguage=en\nangle=${topic}\nWrite one Instagram caption in English for a permanent-makeup studio about the topic. Warm, short, one call to action. No hashtags.\n${await this.style.voiceLine(user, workspaceId).catch(() => '')}`, input: topic })).text.trim();
      const content: any = this.svc('content');
      const post = await content.createComposerDraft(user, workspaceId, { title: topic.slice(0, 80) || 'Post idea', objective: 'bookings', goal: 'Asked AngelOS for a post', language: 'en', caption, format: 'photo', platforms: ['instagram'], plannedFor: input.plannedFor ?? undefined });
      return { contentPostId: post.id, published: false };
    }
    if (action.action_key === 'draft_client_message') {
      const supabase = createUserSupabaseClient(user.accessToken);
      const name = String(input.clientName ?? '').trim();
      const { data: found } = await supabase.from('clients').select('id,display_name,language,do_not_auto_message').eq('workspace_id', workspaceId).ilike('display_name', `%${name.replace(/[%_]/g, '')}%`).limit(5);
      const exact = (found ?? []).filter((c: any) => c.display_name.toLowerCase() === name.toLowerCase());
      const pick = exact.length === 1 ? exact[0] : (found ?? []).length === 1 ? found![0] : null;
      if (!pick) throw new NotFoundException(found?.length ? `More than one client matches “${name}”. Use the full name.` : `I couldn't find a client called “${name}”.`);
      const language = pick.language === 'en' ? 'en' : 'ja';
      const first = String(pick.display_name).split(/\s+/)[0];
      const body = (await this.provider.generate({
        instructions: `CLIENT_OUTREACH_DRAFT\nlanguage=${language}\nClient name: ${first}\nRewrite the owner's note as a short message TO the client, speaking directly to them. ${language === 'ja' ? 'Casual, friendly Japanese only. No English at all.' : 'Friendly English only. No Japanese.'} One or two sentences.\n${await this.style.voiceLine(user, workspaceId).catch(() => '')}`,
        input: String(input.about ?? '')
      })).text.trim();
      if (language === 'en' && JA.test(body)) throw new BadRequestException('The draft mixed languages. Try again.');
      const meaningEn = language === 'ja' ? (await this.provider.generate({ instructions: 'TRANSLATE_TO=en\nTranslate to natural English. Output only the translation.', input: body })).text.trim() : null;
      const messaging: any = this.svc('messaging');
      const draft = await messaging.draftOutreach(user, workspaceId, { clientId: pick.id, body, language, meaningEn, reason: 'assistant' });
      return { threadId: draft.threadId, messageId: draft.message?.id ?? null, sent: false };
    }
    throw new BadRequestException(`Unsupported action: ${action.action_key}`);
  }
}
