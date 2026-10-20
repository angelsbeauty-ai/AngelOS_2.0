import { saveContactAvatar } from './contact-avatar';
import { notifyNewClientMessage } from '../push/expo-push';
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../auth/auth-user';
import { AiProviderService } from '../ai/ai-provider.service';
import { StyleLearningService } from '../ai/style/style-learning.service';
import { BrainService } from '../ai/brain/brain.service';
import { createServiceSupabaseClient, createUserSupabaseClient } from '../config/supabase';
import type { CreateReplyDto } from './dto/create-reply.dto';
import type { UpdateThreadDto } from './dto/update-thread.dto';
import type { StartConversationDto } from './dto/start-conversation.dto';
import { chooseReplyLanguage, detectLanguage, firstName, mixesLanguages, type ClientLanguage } from './language';
import { LineMessagingAdapter, readLineConfig, replyTokenFresh } from './line-messaging.adapter';
import { MetaGraphMessagingAdapter, metaWindow } from '../meta/meta-messaging.adapter';
import { metaConfigForWorkspace } from '../meta/meta-workspace-config';
import { ManualMessagingAdapter, type MessagingProviderAdapter, type NormalizedInboundMessage } from './provider-adapter';
import { buildClientReplyInstructions, buildTranslateInstructions } from './reply-prompt';
import { hasUnfilledPlaceholder, isMissingRelation, migrationNeeded } from './saved-replies.service';

const SENSITIVE_PATTERNS = [/complain/i, /refund/i, /unhappy/i, /angry/i, /legal/i, /wrong/i, /scam/i, /emergency/i, /返金/, /クレーム/, /痛い/, /腫れ/];
const PLATFORM_LABEL: Record<string, string> = { line: 'LINE', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', other: 'Other', manual: 'Manual' };

type Db = SupabaseClient<any, any, any>;

interface InboundRecordInput {
  replyToken?: string;
  workspaceId: string;
  channel: { id: string; provider: string; display_name: string };
  externalThreadId: string;
  externalUserId: string;
  externalMessageId: string;
  body: string;
  contactDisplayName?: string | null;
  clientId?: string | null;
  language?: string | null;
  matchConfidence?: 'verified' | 'possible' | 'unverified';
  source: string;
  createdBy?: string | null;
}

export const REPLY_INTENTS: Record<string, string> = {
  times: 'offer to find a time for the appointment and ask which days suit them',
  price: 'answer the question about price politely, using only prices the studio has set',
  thanks: 'thank the client warmly and briefly'
};

@Injectable()
export class MessagingService {
  private readonly logger = new Logger('MessagingService');
  private readonly manualAdapter = new ManualMessagingAdapter();
  constructor(private readonly aiProvider: AiProviderService, private readonly style: StyleLearningService, private readonly brain: BrainService) {}

  /** Send path: Meta uses the studio's own Page token (meta_connections), env keys only as the single-studio fallback. */
  private async adapterForWorkspace(provider: string, workspaceId: string): Promise<MessagingProviderAdapter> {
    if (provider === 'instagram' || provider === 'facebook') return new MetaGraphMessagingAdapter(provider, await metaConfigForWorkspace(workspaceId));
    return this.adapterFor(provider);
  }

  /** Latest client message in the thread: drives the Meta 24h window and the LINE reply token. */
  private async lastInbound(workspaceId: string, threadId: string): Promise<{ at: string | null; replyToken: string | null }> {
    const { data } = await createServiceSupabaseClient().from('client_messages').select('id,created_at,metadata').eq('workspace_id', workspaceId).eq('thread_id', threadId).eq('direction', 'inbound').order('created_at', { ascending: false }).limit(1);
    const row = data?.[0] as any;
    return { at: row?.created_at ?? null, replyToken: typeof row?.metadata?.reply_token === 'string' && !row?.metadata?.reply_token_used ? row.metadata.reply_token : null };
  }

  private adapterFor(provider: string): MessagingProviderAdapter {
    if (provider === 'line') return new LineMessagingAdapter(readLineConfig());
    if (provider === 'instagram' || provider === 'facebook') return new MetaGraphMessagingAdapter(provider);
    return this.manualAdapter;
  }

  async listChannels(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('messaging_channels').select('id,workspace_id,provider,display_name,status,capabilities,created_at').eq('workspace_id', workspaceId).order('created_at');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Honest per-platform status for Settings → Connections and the inbox banner. */
  async connections(user: AuthUser, workspaceId: string) {
    const channels = await this.listChannels(user, workspaceId);
    const line = new LineMessagingAdapter(readLineConfig()).status();
    const lineChannel = channels.find((row: any) => row.provider === 'line' && row.status === 'connected');
    // Per-studio connections (line_connections / meta_connections) are synced by SocialSyncService and work without the global flags.
    const studioLine = lineChannel && (lineChannel as any).capabilities?.source === 'line_connection';
    const lineSync = (lineChannel as any)?.capabilities?.sync;
    const lineConnected = Boolean(lineChannel && (line.ready || studioLine));
    return [
      {
        provider: 'line', label: 'LINE Official Account',
        state: lineConnected ? 'connected' : line.state === 'ready' ? 'ready_to_connect' : 'not_connected',
        connected: lineConnected,
        canConnect: line.ready && !lineChannel,
        accountName: lineChannel?.display_name ?? null,
        detail: studioLine ? (lineSync?.messages?.note ?? 'New LINE messages appear here from now on') : lineConnected ? 'Messages from your LINE Official Account arrive in the inbox. Replies are sent only after you tap Approve.' : line.detail,
        needs: ['LINE Official Account with the Messaging API turned on', 'Server settings LINE_MESSAGING_ENABLED, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN (Angel sets them)', 'Webhook URL in the LINE console: <API address>/webhooks/line']
      },
      ...(['instagram', 'facebook'] as const).map((provider) => ({
        provider, label: provider === 'instagram' ? 'Instagram DMs' : 'Facebook Messenger',
        ...(() => { const st = new MetaGraphMessagingAdapter(provider).status(); const ch: any = channels.find((row: any) => row.provider === provider && row.status === 'connected');
          if (ch?.capabilities?.source === 'meta_connection') {
            const note = ch.capabilities?.sync?.messages?.note as string | null | undefined;
            const name = provider === 'instagram' ? 'Instagram' : 'Facebook';
            return { state: 'connected', connected: true, canConnect: false, accountName: ch.display_name ?? null, detail: note ?? `${name} messages are synced every 5 minutes. Sending replies from AngelOS is off; copy replies yourself.` };
          }
          return { state: ch && st.ready ? 'connected' : st.state, connected: Boolean(ch && st.ready), canConnect: false, accountName: ch?.display_name ?? null, detail: st.detail }; })(),
        needs: ['Meta Business account', 'Meta developer app', 'Meta App Review for messaging (takes weeks)']
      })),
      {
        provider: 'manual', label: 'Paste a message (any app)', state: 'connected', connected: true, canConnect: false, accountName: null,
        detail: 'Works now: paste a client\'s message, get an AI draft, approve it, then copy it into LINE, Instagram or Facebook yourself.', needs: []
      }
    ];
  }

  /** "Connect LINE": only works when the server has LINE switched on with real credentials. */
  async connectLine(user: AuthUser, workspaceId: string) {
    const adapter = new LineMessagingAdapter(readLineConfig());
    const status = adapter.status();
    if (!status.ready) throw new ConflictException(`LINE is not connected yet. ${status.detail}`);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: workspace } = await supabase.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!workspace) throw new NotFoundException('Workspace not found');
    let bot: { userId: string; displayName: string };
    try { bot = await adapter.getBotInfo(); }
    catch { throw new ConflictException('LINE did not accept the access token. Check the LINE channel settings.'); }
    const service = createServiceSupabaseClient();
    const { data: taken } = await service.from('messaging_channels').select('id,workspace_id').eq('provider', 'line').eq('external_account_id', bot.userId).maybeSingle();
    if (taken && taken.workspace_id !== workspaceId) throw new ConflictException('This LINE account is already linked to another AngelOS workspace.');
    if (taken) {
      const { data, error } = await service.from('messaging_channels').update({ status: 'connected', display_name: bot.displayName, updated_at: new Date().toISOString() }).eq('id', taken.id).select('id,provider,display_name,status').single();
      if (error) throw new InternalServerErrorException(error.message);
      return data;
    }
    const { data, error } = await supabase.from('messaging_channels').insert({
      workspace_id: workspaceId, provider: 'line', display_name: bot.displayName, external_account_id: bot.userId,
      status: 'connected', capabilities: { inbound: true, outbound: true, webhook: true }, created_by: user.id
    }).select('id,provider,display_name,status').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async listThreads(user: AuthUser, workspaceId: string, view: 'active' | 'archived' | 'all' = 'active') {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase
      .from('message_threads')
      .select('*,channel:messaging_channels(id,provider,display_name,status),client:clients(id,display_name,language,do_not_auto_message)')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new InternalServerErrorException(error.message);
    const threads = (data ?? []).filter((row: any) => !row.deleted_at).filter((row: any) => view === 'all' ? true : view === 'archived' ? Boolean(row.archived_at) : !row.archived_at)
      .sort((a: any, b: any) => (b.pinned_at ? 1 : 0) - (a.pinned_at ? 1 : 0));
    const ids = threads.map((row: any) => row.id);
    const latest = new Map<string, any>();
    if (ids.length) {
      const { data: messages, error: messagesError } = await supabase
        .from('client_messages').select('thread_id,body,direction,status,sender_type,created_at')
        .eq('workspace_id', workspaceId).in('thread_id', ids).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1000);
      if (messagesError) throw new InternalServerErrorException(messagesError.message);
      for (const message of messages ?? []) {
        if (!latest.has(message.thread_id) && !(message.sender_type === 'ai' && message.status === 'pending_approval')) latest.set(message.thread_id, message);
      }
    }
    return threads.slice(0, 100).map((row: any) => decorateThread(row, latest.get(row.id)));
  }

  async getThread(user: AuthUser, workspaceId: string, threadId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('*,channel:messaging_channels(id,provider,display_name,status),client:clients(id,display_name,language,status,do_not_auto_message)')
      .eq('workspace_id', workspaceId).eq('id', threadId).single();
    if (threadError || !thread) throw new NotFoundException('Message thread not found');
    const [messages, notes] = await Promise.all([
      supabase.from('client_messages').select('*').eq('workspace_id', workspaceId).eq('thread_id', threadId).order('created_at'),
      supabase.from('message_internal_notes').select('*').eq('workspace_id', workspaceId).eq('thread_id', threadId).order('created_at', { ascending: false })
    ]);
    if (messages.error) throw new InternalServerErrorException(messages.error.message);
    if (notes.error) throw new InternalServerErrorException(notes.error.message);
    const list = messages.data ?? [];
    const latestVisible = [...list].reverse().find((m: any) => m.status !== 'cancelled' && !(m.sender_type === 'ai' && m.status === 'pending_approval'));
    const latestInbound = [...list].reverse().find((m: any) => m.direction === 'inbound');
    const decorated = decorateThread(thread, latestVisible);
    const provider = (thread as any).channel?.provider;
    const lastInboundAt: string | null = latestInbound?.created_at ?? null;
    let lineQuota: { quota: number | null; used: number | null } | null = null;
    if (provider === 'line') {
      const estimate = await new LineMessagingAdapter(readLineConfig()).audienceEstimate().catch(() => null);
      lineQuota = estimate ? { quota: estimate.quota, used: estimate.used } : null;
    }
    const sendWindow = {
      lastInboundAt,
      metaWindow: provider === 'instagram' || provider === 'facebook' ? metaWindow(lastInboundAt) : null,
      lineReplyFree: provider === 'line' ? Boolean((latestInbound as any)?.metadata?.reply_token && !(latestInbound as any)?.metadata?.reply_token_used && replyTokenFresh(lastInboundAt)) : null,
      lineQuota
    };
    const reactions: Record<string, string[]> = {};
    const reactionRows = await supabase.from('message_reactions').select('message_id,emoji').eq('workspace_id', workspaceId).in('message_id', list.map((m: any) => m.id).slice(0, 500));
    for (const r of (reactionRows.error ? [] : reactionRows.data ?? []) as any[]) (reactions[r.message_id] ??= []).push(r.emoji);
    const attachments = await this.attachmentViews(workspaceId, list);
    return {
      reactions, attachments, reactionsAvailable: !reactionRows.error,
      thread: { ...decorated, reply_language: chooseReplyLanguage(latestInbound?.body, (thread as any).client?.language), send_window: sendWindow },
      messages: list.map((m: any) => m.metadata?.reply_token ? { ...m, metadata: { ...m.metadata, reply_token: undefined } } : m),
      internalNotes: notes.data ?? []
    };
  }

  /** Opening a conversation clears the unread dot (best effort before migration 0015 is applied). */
  async markRead(user: AuthUser, workspaceId: string, threadId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { error } = await supabase.from('message_threads').update({ owner_unread: false }).eq('workspace_id', workspaceId).eq('id', threadId);
    if (error && !isMissingRelation(error)) throw new InternalServerErrorException(error.message);
    return { read: true, tracked: !error };
  }

  private async ensureManualChannel(supabase: Db, workspaceId: string, userId: string) {
    const { data: existing, error } = await supabase.from('messaging_channels').select('id,provider,display_name').eq('workspace_id', workspaceId).eq('provider', 'manual').order('created_at').limit(1);
    if (error) throw new InternalServerErrorException(error.message);
    if (existing?.length) return existing[0] as { id: string; provider: string; display_name: string };
    const { data, error: insertError } = await supabase.from('messaging_channels').insert({
      workspace_id: workspaceId, provider: 'manual', display_name: 'Pasted messages', status: 'connected',
      capabilities: { inbound: true, outbound: false, manualCopy: true }, created_by: userId
    }).select('id,provider,display_name').single();
    if (insertError || !data) throw new InternalServerErrorException(insertError?.message ?? 'Could not prepare the inbox');
    return data as { id: string; provider: string; display_name: string };
  }

  /** "+ New conversation": pick a client, paste what they sent. One thread per client per app. */
  async startConversation(user: AuthUser, workspaceId: string, dto: StartConversationDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: client, error: clientError } = await supabase.from('clients').select('id,display_name,language').eq('workspace_id', workspaceId).eq('id', dto.clientId).single();
    if (clientError || !client) throw new NotFoundException('Client not found');
    const channel = await this.ensureManualChannel(supabase, workspaceId, user.id);
    const result = await this.recordInbound(supabase, {
      workspaceId, channel,
      externalThreadId: `manual:${dto.platform}:${client.id}`,
      externalUserId: `manual:${dto.platform}:${client.id}`,
      externalMessageId: `manual_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body: dto.body, contactDisplayName: client.display_name, clientId: client.id,
      language: detectLanguage(dto.body) ?? client.language, source: `manual-paste:${dto.platform}`, createdBy: user.id
    });
    return result;
  }

  /** Paste the client's next message into a manual conversation. */
  async addInbound(user: AuthUser, workspaceId: string, threadId: string, body: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const detail = await this.getThread(user, workspaceId, threadId);
    const thread: any = detail.thread;
    if (thread.channel?.provider !== 'manual') throw new BadRequestException('Messages from connected apps arrive by themselves. Paste only works for manual conversations.');
    return this.recordInbound(supabase, {
      workspaceId, channel: thread.channel,
      externalThreadId: thread.external_thread_id, externalUserId: thread.contact_external_user_id ?? thread.external_thread_id,
      externalMessageId: `manual_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body, contactDisplayName: thread.contact_display_name, clientId: thread.client?.id ?? null,
      language: detectLanguage(body) ?? thread.client?.language, source: `manual-paste:${thread.platform}`, createdBy: user.id
    });
  }

  /**
   * Webhook path (LINE today; Meta later): already signature-verified, no user session.
   * The channel row decides the workspace, so a message can never land in another tenant.
   */
  async ingestFromProvider(event: NormalizedInboundMessage, resolveName?: (userId: string) => Promise<string | undefined>, workspaceId?: string) {
    const service = createServiceSupabaseClient();
    // Scope to the studio when known (LINE: picked by webhook destination), so a stale row elsewhere can't make this ambiguous.
    let query = service.from('messaging_channels').select('id,workspace_id,provider,display_name,status')
      .eq('provider', event.provider).eq('external_account_id', event.externalAccountId).eq('status', 'connected');
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { data: channels, error } = await query.order('created_at', { ascending: false }).limit(1);
    const channel = channels?.[0];
    if (error) throw new InternalServerErrorException(error.message);
    if (!channel) { this.logger.warn(`Inbound ${event.provider} event for an unlinked account was ignored.`); return { ignored: true }; }
    const { data: known } = await service.from('client_channel_identities').select('client_id').eq('workspace_id', channel.workspace_id).eq('channel_id', channel.id).eq('external_user_id', event.externalUserId).maybeSingle();
    const contactDisplayName = known ? undefined : await resolveName?.(event.externalUserId);
    try {
      const recorded = await this.recordInbound(service, {
        workspaceId: channel.workspace_id, channel, externalThreadId: event.externalThreadId, externalUserId: event.externalUserId,
        externalMessageId: event.externalMessageId, body: event.body, replyToken: event.replyToken, contactDisplayName: contactDisplayName ?? null,
        clientId: known?.client_id ?? null, language: detectLanguage(event.body), matchConfidence: 'unverified', source: `webhook:${event.provider}`
      });
      if (!recorded.phishing && recorded.threadId) {
        const { data: who } = await service.from('message_threads').select('contact_display_name,client:clients(display_name)').eq('id', recorded.threadId).maybeSingle();
        const name = (who as any)?.client?.display_name ?? (who as any)?.contact_display_name ?? channel.display_name ?? 'AngelOS';
        void notifyNewClientMessage(channel.workspace_id, recorded.threadId, name, event.body);
      }
      return recorded;
    } catch (caught) {
      if (caught instanceof ConflictException) return { duplicate: true }; // provider retry of an event we already stored
      throw caught;
    }
  }

  async saveContactAvatar(threadId: string, fetchUrl: () => Promise<string | null | undefined>) { return saveContactAvatar(threadId, fetchUrl); }

  private async recordInbound(db: Db, input: InboundRecordInput) {
    const { workspaceId, channel } = input;
    let clientId = input.clientId ?? null;
    if (!clientId) {
      const { data: identity, error: identityError } = await db.from('client_channel_identities').select('client_id').eq('workspace_id', workspaceId).eq('channel_id', channel.id).eq('external_user_id', input.externalUserId).maybeSingle();
      if (identityError) throw new InternalServerErrorException(identityError.message);
      clientId = identity?.client_id ?? null;
    }
    if (!clientId) {
      // Never merge by similar names. A previously unseen channel identity becomes a new lead.
      const leadName = input.contactDisplayName?.trim() || `${PLATFORM_LABEL[channel.provider] ?? channel.display_name} lead`;
      const { data: lead, error: leadError } = await db.from('clients').insert({
        workspace_id: workspaceId, display_name: leadName, language: input.language === 'ja' ? 'ja' : 'en', status: 'lead',
        source: channel.provider, do_not_auto_message: false, created_by: input.createdBy ?? null
      }).select('id').single();
      if (leadError || !lead) throw new InternalServerErrorException(leadError?.message ?? 'Could not create lead');
      clientId = lead.id;
    }

    const body = input.body.trim();
    const intent = classifyIntent(body);
    const sensitive = isSensitive(body, intent);
    const phishing = looksLikePhishing(body);
    const priority = sensitive || phishing || /arrived|can't find|cannot find|lost|着きました|迷/i.test(body) ? 'urgent' : 'today';
    const status = phishing ? 'spam_scam' : sensitive ? 'needs_owner' : intent === 'booking' || intent === 'reschedule' ? 'booking_in_progress' : 'needs_reply';
    const now = new Date().toISOString();

    const { data: existingThread } = await db.from('message_threads').select('id').eq('workspace_id', workspaceId).eq('channel_id', channel.id).eq('external_thread_id', input.externalThreadId).maybeSingle();
    let threadId = existingThread?.id as string | undefined;
    const threadFields = { intent, priority, status, needs_owner: sensitive || phishing, last_message_at: now, owner_unread: true, archived_at: null };
    if (!threadId) {
      const insert = (fields: Record<string, unknown>) => db.from('message_threads').insert({
        workspace_id: workspaceId, channel_id: channel.id, client_id: clientId,
        external_thread_id: input.externalThreadId, contact_external_user_id: input.externalUserId,
        contact_display_name: input.contactDisplayName?.trim() || null, ...fields
      }).select('id').single();
      let created = await insert(threadFields);
      if (created.error && isMissingRelation(created.error)) created = await insert(withoutInboxColumns(threadFields));
      if (created.error || !created.data) throw new InternalServerErrorException(created.error?.message ?? 'Could not create message thread');
      threadId = created.data.id;
    } else {
      const update = (fields: Record<string, unknown>) => db.from('message_threads').update({ client_id: clientId, ...fields, updated_at: now }).eq('workspace_id', workspaceId).eq('id', threadId!);
      let result = await update(threadFields);
      if (result.error && isMissingRelation(result.error)) result = await update(withoutInboxColumns(threadFields));
      if (result.error) throw new InternalServerErrorException(result.error.message);
    }

    const service = createServiceSupabaseClient();
    const { data: message, error: messageError } = await service.from('client_messages').insert({
      workspace_id: workspaceId, thread_id: threadId, client_id: clientId,
      direction: 'inbound', sender_type: 'client', external_message_id: input.externalMessageId,
      body, original_language: input.language ?? detectLanguage(body), status: 'received', sensitive,
      metadata: { source: input.source, ...(input.replyToken ? { reply_token: input.replyToken } : {}) }
    }).select('*').single();
    if (messageError) {
      if ((messageError as any).code === '23505') throw new ConflictException('That message was already added.');
      throw new InternalServerErrorException(messageError.message);
    }

    const { error: identityUpsertError } = await db.from('client_channel_identities').upsert({
      workspace_id: workspaceId, client_id: clientId, channel_id: channel.id,
      external_user_id: input.externalUserId, display_name: input.contactDisplayName?.trim() || null,
      match_confidence: input.matchConfidence ?? 'verified'
    }, { onConflict: 'workspace_id,channel_id,external_user_id' });
    if (identityUpsertError) throw new InternalServerErrorException(identityUpsertError.message);
    // Brain: count the TOPIC of the request only (intent key, platform, language). No message text.
    if (!phishing) {
      const platform = input.externalThreadId.startsWith('manual:') ? input.externalThreadId.split(':')[1] : channel.provider;
      this.brain.rememberClientRequest(workspaceId, intent, platform, message?.original_language ?? null);
    }
    return { threadId, message, intent, sensitive, phishing, priority, clientId };
  }

  async draftReply(user: AuthUser, workspaceId: string, threadId: string, intent?: string) {
    const detail = await this.getThread(user, workspaceId, threadId);
    const latestInbound = [...detail.messages].reverse().find((item: any) => item.direction === 'inbound');
    if (!latestInbound) throw new BadRequestException('No client message to reply to yet. Paste their message first.');
    const thread = detail.thread as any;
    const client = thread.client;
    const language: ClientLanguage = thread.reply_language;
    const name = firstName(client?.display_name ?? thread.contact_display_name);
    let instructions = buildClientReplyInstructions({
      language, clientName: name, intent: thread.intent, knownClient: Boolean(client),
      doNotAutoMessage: Boolean(client?.do_not_auto_message), styleContext: await this.replyStyleContext(user, workspaceId, thread.intent, language)
    });
    // M27 suggestion chips: the owner's chosen intent steers the draft. Still a draft; she approves it.
    const goal = intent ? REPLY_INTENTS[intent] : undefined;
    if (goal) instructions = `${instructions}\nThe studio owner wants this reply to: ${goal}. Never invent times, prices or facts you were not given; ask or leave a clear gap instead.`;
    const recent = detail.messages.filter((m: any) => m.status !== 'cancelled' && !(m.sender_type === 'ai' && m.status === 'pending_approval')).slice(-6)
      .map((m: any) => `${m.direction === 'inbound' ? 'Client' : 'Studio'}: ${m.body}`).join('\n');
    let response = await this.aiProvider.generate({ instructions, input: recent || `Client: ${latestInbound.body}` });
    let text = response.text.trim();
    if (mixesLanguages(text, language)) {
      response = await this.aiProvider.generate({ instructions: `${instructions}\nIMPORTANT: your last draft mixed English and Japanese. Use ${language === 'ja' ? 'Japanese' : 'English'} only.`, input: recent });
      text = response.text.trim();
    }
    const mixed = mixesLanguages(text, language);
    // Angel cannot read Japanese: every Japanese draft carries an English translation for her to check.
    const translation = language === 'ja' ? (await this.aiProvider.generate({ instructions: buildTranslateInstructions('en'), input: text })).text.trim() : null;
    const sensitive = Boolean(latestInbound.sensitive) || thread.intent === 'complaint' || !client || mixed;
    const service = createServiceSupabaseClient();
    // Only one pending AI draft per conversation: an older unapproved draft is replaced.
    await service.from('client_messages').update({ status: 'cancelled' }).eq('workspace_id', workspaceId).eq('thread_id', threadId).eq('sender_type', 'ai').eq('status', 'pending_approval');
    const { data, error } = await service.from('client_messages').insert({
      workspace_id: workspaceId, thread_id: threadId, client_id: client?.id ?? null,
      direction: 'outbound', sender_type: 'ai', body: text, original_language: language, translated_body: translation,
      status: 'pending_approval', sensitive,
      metadata: { provider: response.provider, model: response.model, draft_reason: 'ai_receptionist', language, translation_target: translation ? 'en' : null, mixed_language_warning: mixed },
      created_by: user.id
    }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return { message: data, requiresApproval: true, language, reason: mixed ? 'This draft mixes English and Japanese. Please edit it before approving.' : sensitive ? 'Please read this one carefully before approving.' : 'Nothing is sent until you tap Approve.' };
  }

  /**
   * Reminder / follow-up outreach (B7): puts a ready-made message in the client's conversation as a
   * DRAFT waiting for Angel's Approve. Japanese text carries its English meaning. Nothing is sent here.
   */
  async draftOutreach(user: AuthUser, workspaceId: string, input: { clientId: string; body: string; language: 'en' | 'ja'; meaningEn?: string | null; reason: string }) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: client } = await supabase.from('clients').select('id,display_name,language,do_not_auto_message').eq('workspace_id', workspaceId).eq('id', input.clientId).maybeSingle();
    if (!client) throw new NotFoundException('Client not found');
    if (client.do_not_auto_message) throw new ConflictException(`${client.display_name} asked not to get automatic messages.`);
    if (mixesLanguages(input.body, input.language)) throw new BadRequestException('This message mixes English and Japanese. Edit the template first.');
    const channel = await this.ensureManualChannel(supabase, workspaceId, user.id);
    const service = createServiceSupabaseClient();
    const externalThreadId = `manual:line:${client.id}`;
    let { data: thread } = await service.from('message_threads').select('id').eq('workspace_id', workspaceId).eq('channel_id', channel.id).eq('external_thread_id', externalThreadId).maybeSingle();
    if (!thread) {
      const created = await service.from('message_threads').insert({
        workspace_id: workspaceId, channel_id: channel.id, client_id: client.id, external_thread_id: externalThreadId, contact_external_user_id: externalThreadId,
        contact_display_name: client.display_name, intent: 'follow_up', priority: 'today', status: 'needs_reply', needs_owner: false, last_message_at: new Date().toISOString()
      }).select('id').single();
      if (created.error || !created.data) throw new InternalServerErrorException(created.error?.message ?? 'Could not prepare the conversation');
      thread = created.data;
    }
    await service.from('client_messages').update({ status: 'cancelled' }).eq('workspace_id', workspaceId).eq('thread_id', thread!.id).eq('sender_type', 'ai').eq('status', 'pending_approval');
    const translation = input.language === 'ja' ? (input.meaningEn ?? (await this.aiProvider.generate({ instructions: buildTranslateInstructions('en'), input: input.body })).text.trim()) : null;
    const { data, error } = await service.from('client_messages').insert({
      workspace_id: workspaceId, thread_id: thread!.id, client_id: client.id, direction: 'outbound', sender_type: 'ai', body: input.body.trim(),
      original_language: input.language, translated_body: translation, status: 'pending_approval', sensitive: false,
      metadata: { draft_reason: input.reason, language: input.language, translation_target: translation ? 'en' : null, source: 'reminder' }, created_by: user.id
    }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return { threadId: thread!.id, message: data };
  }

  /** The owner's reply style (manual + learned) and her approved saved replies, kept under ~2.4k tokens. */
  private async replyStyleContext(user: AuthUser, workspaceId: string, intent: string, language: ClientLanguage): Promise<string | undefined> {
    try { return await this.style.replyContext(user, workspaceId, intent, language); }
    catch { return undefined; }
  }

  async createReply(user: AuthUser, workspaceId: string, threadId: string, dto: CreateReplyDto) {
    const detail = await this.getThread(user, workspaceId, threadId);
    const client = (detail.thread as any).client;
    const body = dto.body.trim();
    if (!body && !dto.attachmentAssetId) throw new BadRequestException('Write a reply first.');
    const sensitive = isSensitive(body, (detail.thread as any).intent);
    const quoted = dto.replyToMessageId ? (detail.messages as any[]).find((m) => m.id === dto.replyToMessageId) : null;
    if (dto.replyToMessageId && !quoted) throw new BadRequestException('The quoted message is not in this chat.');
    let attachment: { asset_id: string; mime_type: string } | null = null;
    if (dto.attachmentAssetId) {
      const { data: asset } = await createUserSupabaseClient(user.accessToken).from('media_assets').select('id,mime_type,media_type,upload_status').eq('workspace_id', workspaceId).eq('id', dto.attachmentAssetId).maybeSingle();
      if (!asset || asset.upload_status !== 'uploaded') throw new BadRequestException('That photo has not finished uploading.');
      if (asset.media_type !== 'image') throw new BadRequestException('Only photos can be sent in chat for now.');
      attachment = { asset_id: asset.id, mime_type: asset.mime_type };
    }
    // Stored in metadata so it works before 0028; 0028 adds proper columns.
    const extra = { ...(quoted ? { reply_to: { id: quoted.id, body: String(quoted.body ?? '').slice(0, 140), direction: quoted.direction } } : {}), ...(attachment ? { attachment } : {}) };
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('client_messages').insert({
      workspace_id: workspaceId, thread_id: threadId, client_id: client?.id ?? null,
      direction: 'outbound', sender_type: 'owner', body, original_language: detectLanguage(body),
      status: dto.sendNow ? 'queued' : 'draft', sensitive, metadata: extra,
      routine_category: dto.routineCategory ?? null, created_by: user.id
    }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    if (!dto.sendNow) return { message: data, sent: false };
    return this.sendMessage(user, workspaceId, data.id, true);
  }

  /** Approve tap. An edited AI draft is saved first, then approved. */
  async approveAndSend(user: AuthUser, workspaceId: string, messageId: string, editedBody?: string) {
    if (editedBody !== undefined) {
      const body = editedBody.trim();
      if (!body) throw new BadRequestException('The reply is empty.');
      const supabase = createUserSupabaseClient(user.accessToken);
      const { data: message } = await supabase.from('client_messages').select('id,body,status,direction,metadata').eq('workspace_id', workspaceId).eq('id', messageId).maybeSingle();
      if (!message) throw new NotFoundException('Outbound message not found');
      if (message.body !== body && ['pending_approval', 'draft'].includes(message.status)) {
        const service = createServiceSupabaseClient();
        const language = detectLanguage(body);
        const translation = language === 'ja' ? (await this.aiProvider.generate({ instructions: buildTranslateInstructions('en'), input: body })).text.trim() : null;
        await service.from('client_messages').update({ body, translated_body: translation, original_language: language, metadata: { ...(message.metadata ?? {}), edited_by_owner: true } }).eq('workspace_id', workspaceId).eq('id', messageId);
      }
    }
    return this.sendMessage(user, workspaceId, messageId, true);
  }

  /** Manual conversations: Angel copied the approved reply into LINE/IG/FB herself and confirms it. */
  async markSentManually(user: AuthUser, workspaceId: string, messageId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: message, error } = await supabase.from('client_messages').select('*,thread:message_threads(id,channel:messaging_channels(provider))').eq('workspace_id', workspaceId).eq('id', messageId).single();
    if (error || !message) throw new NotFoundException('Message not found');
    if (message.status === 'sent') return { message, sent: true, duplicatePrevented: true };
    if (message.status !== 'queued' || (message as any).metadata?.delivery !== 'manual') throw new ConflictException('Approve the reply first.');
    const sentAt = new Date().toISOString();
    const service = createServiceSupabaseClient();
    const { data: updated, error: updateError } = await service.from('client_messages').update({ status: 'sent', sent_at: sentAt, metadata: { ...(message.metadata ?? {}), sent_by: 'owner_manual' } }).eq('workspace_id', workspaceId).eq('id', messageId).select('*').single();
    if (updateError) throw new InternalServerErrorException(updateError.message);
    await service.from('message_threads').update({ status: 'waiting_client', needs_owner: false, last_message_at: sentAt, updated_at: sentAt }).eq('workspace_id', workspaceId).eq('id', (message as any).thread.id);
    return { message: updated, sent: true, duplicatePrevented: false };
  }

  async translateMessage(user: AuthUser, workspaceId: string, messageId: string, targetLanguage: 'en' | 'ja' = 'en') {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: message, error } = await supabase.from('client_messages').select('*').eq('workspace_id', workspaceId).eq('id', messageId).single();
    if (error || !message) throw new NotFoundException('Message not found');
    const response = await this.aiProvider.generate({ instructions: buildTranslateInstructions(targetLanguage), input: message.body });
    const service = createServiceSupabaseClient();
    const { data: updated, error: updateError } = await service.from('client_messages').update({ translated_body: response.text, metadata: { ...(message.metadata ?? {}), translation_target: targetLanguage, translation_provider: response.provider } }).eq('workspace_id', workspaceId).eq('id', messageId).select('*').single();
    if (updateError) throw new InternalServerErrorException(updateError.message);
    return updated;
  }

  async translateText(user: AuthUser, workspaceId: string, text: string, targetLanguage: 'en' | 'ja' = 'en') {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: workspace } = await supabase.from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!workspace) throw new NotFoundException('Workspace not found');
    const response = await this.aiProvider.generate({ instructions: buildTranslateInstructions(targetLanguage), input: text });
    return { translation: response.text.trim(), targetLanguage };
  }

  async addInternalNote(user: AuthUser, workspaceId: string, threadId: string, content: string) {
    await this.getThread(user, workspaceId, threadId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('message_internal_notes').insert({ workspace_id: workspaceId, thread_id: threadId, content: content.trim(), created_by: user.id }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async updateThread(user: AuthUser, workspaceId: string, threadId: string, dto: UpdateThreadDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.priority !== undefined) updates.priority = dto.priority;
    if (dto.needsOwner !== undefined) updates.needs_owner = dto.needsOwner;
    if (dto.archived !== undefined) updates.archived_at = dto.archived ? new Date().toISOString() : null;
    if (dto.unread !== undefined) updates.owner_unread = dto.unread;
    const v1028 = dto.pinned !== undefined || dto.muted !== undefined || dto.deleted !== undefined;
    if (dto.pinned !== undefined) updates.pinned_at = dto.pinned ? new Date().toISOString() : null;
    if (dto.muted !== undefined) updates.muted_until = dto.muted ? '9999-12-31T00:00:00Z' : null;
    if (dto.deleted !== undefined) updates.deleted_at = dto.deleted ? new Date().toISOString() : null;
    const { data, error } = await supabase.from('message_threads').update(updates).eq('workspace_id', workspaceId).eq('id', threadId).select('*').single();
    if (error && isMissingRelation(error)) throw migrationNeeded(v1028 ? '0028_messages_v1.sql' : '0015_v1_messaging_inbox.sql');
    if (error || !data) throw new NotFoundException('Message thread not found');
    return data;
  }

  private async sendMessage(user: AuthUser, workspaceId: string, messageId: string, explicitOwnerApproval = false) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: message, error: messageError } = await supabase.from('client_messages').select('*,thread:message_threads(*,channel:messaging_channels(*),client:clients(id,display_name,do_not_auto_message))').eq('workspace_id', workspaceId).eq('id', messageId).single();
    if (messageError || !message) throw new NotFoundException('Outbound message not found');
    if (message.direction !== 'outbound') throw new BadRequestException('Only replies can be approved');
    if (message.status === 'sent') return { message, sent: true, duplicatePrevented: true, delivery: 'sent' };
    if (message.status === 'cancelled') throw new ConflictException('This draft was replaced by a newer one.');
    const thread = (message as any).thread;
    if (!thread?.channel) throw new NotFoundException('Messaging channel not found');
    if (!explicitOwnerApproval && thread.client?.do_not_auto_message && message.sender_type === 'ai') throw new ConflictException('Client is marked Do Not Auto-Message.');
    if (!explicitOwnerApproval && message.sensitive && message.sender_type === 'ai') throw new ConflictException('Sensitive AI draft requires owner approval before sending.');
    if (hasUnfilledPlaceholder(message.body)) throw new BadRequestException('Fill in the [brackets] in the reply before approving.');
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(message.body) && mixesLanguages(message.body, 'ja')) {
      throw new BadRequestException('This reply mixes English and Japanese. Keep one language, the same one the client uses.');
    }
    const service = createServiceSupabaseClient();
    const approvedAt = new Date().toISOString();

    if (thread.channel.provider === 'manual') {
      // Honest: AngelOS cannot deliver a pasted conversation. Approved = ready for Angel to copy and send.
      if (message.status === 'queued' && (message as any).metadata?.delivery === 'manual') return { message, sent: false, delivery: 'manual', duplicatePrevented: true };
      const { data: ready, error } = await service.from('client_messages').update({
        status: 'queued', metadata: { ...(message.metadata ?? {}), delivery: 'manual', approved_at: approvedAt, approved_by: user.id }
      }).eq('workspace_id', workspaceId).eq('id', message.id).select('*').single();
      if (error) throw new InternalServerErrorException(error.message);
      await service.from('message_threads').update({ status: 'waiting_client', needs_owner: false, updated_at: approvedAt }).eq('workspace_id', workspaceId).eq('id', thread.id);
      await this.afterOwnerApproval(workspaceId);
      return { message: ready, sent: false, delivery: 'manual', duplicatePrevented: false };
    }

    const adapter = await this.adapterForWorkspace(thread.channel.provider, workspaceId);
    const adapterStatus = adapter.status();
    if (!adapterStatus.ready || thread.channel.status !== 'connected') {
      throw new ConflictException(`${PLATFORM_LABEL[thread.channel.provider] ?? 'This app'} is not connected yet, so nothing was sent. ${adapterStatus.detail}`);
    }

    const idempotencyKey = `message:${message.id}`;
    const { data: existing } = await service.from('message_send_attempts').select('*').eq('workspace_id', workspaceId).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing?.status === 'sent') {
      const { data: refreshed } = await supabase.from('client_messages').select('*').eq('id', message.id).single();
      return { message: refreshed, sent: true, duplicatePrevented: true, delivery: 'sent' };
    }
    const attemptNo = Number(existing?.attempt_no ?? 0) + 1;
    if (existing) {
      const queued = await service.from('message_send_attempts').update({ status: 'queued', attempt_no: attemptNo, error_message: null }).eq('workspace_id', workspaceId).eq('id', existing.id);
      if (queued.error) throw new InternalServerErrorException(queued.error.message);
    } else {
      const queued = await service.from('message_send_attempts').insert({ workspace_id: workspaceId, message_id: message.id, channel_id: thread.channel.id, idempotency_key: idempotencyKey, attempt_no: attemptNo, status: 'queued' });
      if (queued.error) throw new InternalServerErrorException(queued.error.message);
    }

    const inbound = await this.lastInbound(workspaceId, thread.id);
    const imageUrl = await this.attachmentUrl(workspaceId, (message as any).metadata?.attachment?.asset_id);
    if ((message as any).metadata?.attachment?.asset_id && !imageUrl) throw new ConflictException('The photo could not be opened, so nothing was sent.');
    const result = await adapter.send({ externalThreadId: thread.external_thread_id, body: message.body, idempotencyKey, replyToken: inbound.replyToken, lastInboundAt: inbound.at, imageUrl });
    if ((result.raw as any)?.transport === 'line-reply') {
      // Single use: mark it so a second reply falls back to push.
      const { data: last } = await service.from('client_messages').select('id,metadata').eq('workspace_id', workspaceId).eq('thread_id', thread.id).eq('direction', 'inbound').order('created_at', { ascending: false }).limit(1);
      if (last?.[0]) await service.from('client_messages').update({ metadata: { ...((last[0] as any).metadata ?? {}), reply_token_used: true } }).eq('id', (last[0] as any).id);
    }
    const attemptStatus = result.status === 'manual' ? 'unknown' : result.status;
    const { error: attemptError } = await service.from('message_send_attempts').update({
      status: attemptStatus, provider_response: result.raw ?? null, error_message: result.error ?? null
    }).eq('workspace_id', workspaceId).eq('idempotency_key', idempotencyKey);
    if (attemptError) throw new InternalServerErrorException(attemptError.message);
    if (result.status !== 'sent') {
      await service.from('client_messages').update({ status: 'failed' }).eq('id', message.id);
      throw new InternalServerErrorException(result.error ?? 'Message delivery could not be verified');
    }
    const sentAt = new Date().toISOString();
    const { data: sentMessage, error: updateError } = await service.from('client_messages').update({ status: 'sent', external_message_id: result.externalMessageId ?? null, sent_at: sentAt, metadata: { ...(message.metadata ?? {}), approved_at: approvedAt, approved_by: user.id, delivery: 'live' } }).eq('id', message.id).select('*').single();
    if (updateError) throw new InternalServerErrorException(updateError.message);
    await service.from('message_threads').update({ status: 'waiting_client', needs_owner: false, last_message_at: sentAt, updated_at: sentAt }).eq('id', thread.id);
    await this.afterOwnerApproval(workspaceId);
    return { message: sentMessage, sent: true, duplicatePrevented: false, delivery: 'sent' };
  }

  /** Signed https URL (1 h) for a chat photo; platforms fetch it once when delivering. */
  private async attachmentUrl(workspaceId: string, assetId?: string): Promise<string | null> {
    if (!assetId) return null;
    const service = createServiceSupabaseClient();
    const { data: asset } = await service.from('media_assets').select('storage_bucket,storage_path,upload_status').eq('workspace_id', workspaceId).eq('id', assetId).maybeSingle();
    if (!asset || asset.upload_status !== 'uploaded') return null;
    const signed = await service.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 3600);
    return signed.data?.signedUrl ?? null;
  }

  /** Short-lived view URLs for photos in a thread (owner's own view). */
  private async attachmentViews(workspaceId: string, messages: any[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const m of messages) {
      const id = m.metadata?.attachment?.asset_id;
      if (id && !out[m.id]) { const url = await this.attachmentUrl(workspaceId, id).catch(() => null); if (url) out[m.id] = url; }
    }
    return out;
  }

  /** M07 server search: message text and contact names, newest first. */
  async search(user: AuthUser, workspaceId: string, q: string) {
    const term = (q ?? '').trim().slice(0, 100);
    if (term.length < 2) return { results: [] };
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const supabase = createUserSupabaseClient(user.accessToken);
    const [msgs, threads] = await Promise.all([
      supabase.from('client_messages').select('id,thread_id,body,direction,created_at').eq('workspace_id', workspaceId).neq('status', 'cancelled').ilike('body', like).order('created_at', { ascending: false }).limit(50),
      supabase.from('message_threads').select('id,contact_display_name,last_message_at,client:clients(display_name)').eq('workspace_id', workspaceId).ilike('contact_display_name', like).limit(20)
    ]);
    if (msgs.error) throw new InternalServerErrorException(msgs.error.message);
    const results: Array<{ threadId: string; messageId: string | null; snippet: string; at: string | null; kind: 'message' | 'contact' }> = [];
    for (const t of threads.data ?? []) results.push({ threadId: (t as any).id, messageId: null, snippet: (t as any).contact_display_name ?? '', at: (t as any).last_message_at, kind: 'contact' });
    for (const m of msgs.data ?? []) results.push({ threadId: m.thread_id, messageId: m.id, snippet: snippetAround(m.body, term), at: m.created_at, kind: 'message' });
    return { results };
  }

  /**
   * M05 comments: live read of recent Instagram/Facebook comments through the Graph API with the
   * studio's own Page token. Nothing stored. A platform that can't be read says why.
   */
  async comments(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: member } = await supabase.from('workspace_memberships').select('workspace_id').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (!member) throw new NotFoundException('Workspace not found');
    const c = await metaConfigForWorkspace(workspaceId);
    const out: { comments: Array<{ id: string; platform: 'instagram' | 'facebook'; author: string | null; text: string; at: string | null; postId: string; postCaption: string | null; permalink: string | null }>; unavailable: Array<{ platform: string; reason: string }> } = { comments: [], unavailable: [] };
    if (!c.pageToken) { out.unavailable.push({ platform: 'meta', reason: 'Instagram and Facebook are not connected.' }); return out; }
    const get = async (path: string) => {
      const r = await fetch(`${c.graphBase}/${path}`, { headers: { Authorization: `Bearer ${c.pageToken}` } });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      return j;
    };
    if (c.igUserId) {
      try {
        const j = await get(`${c.igUserId}/media?fields=id,caption,permalink,comments.limit(20){id,text,username,timestamp}&limit=10`);
        for (const media of j.data ?? []) for (const cm of media.comments?.data ?? []) out.comments.push({ id: `ig:${cm.id}`, platform: 'instagram', author: cm.username ?? null, text: String(cm.text ?? ''), at: cm.timestamp ?? null, postId: media.id, postCaption: media.caption ? String(media.caption).slice(0, 80) : null, permalink: media.permalink ?? null });
      } catch (e) { out.unavailable.push({ platform: 'instagram', reason: e instanceof Error ? e.message : 'Could not read comments.' }); }
    }
    if (c.pageId) {
      try {
        const j = await get(`${c.pageId}/posts?fields=id,message,permalink_url,comments.limit(20){id,message,from,created_time}&limit=10`);
        for (const post of j.data ?? []) for (const cm of post.comments?.data ?? []) out.comments.push({ id: `fb:${cm.id}`, platform: 'facebook', author: cm.from?.name ?? null, text: String(cm.message ?? ''), at: cm.created_time ?? null, postId: post.id, postCaption: post.message ? String(post.message).slice(0, 80) : null, permalink: post.permalink_url ?? null });
      } catch (e) { out.unavailable.push({ platform: 'facebook', reason: e instanceof Error ? e.message : 'Could not read comments.' }); }
    }
    out.comments.sort((x, y) => String(y.at ?? '').localeCompare(String(x.at ?? '')));
    return out;
  }

  /** Checklist 3/4: toggle the owner's reaction on a message. Needs 0028. */
  async toggleReaction(user: AuthUser, workspaceId: string, messageId: string, emoji: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: msg } = await supabase.from('client_messages').select('id').eq('workspace_id', workspaceId).eq('id', messageId).maybeSingle();
    if (!msg) throw new NotFoundException('Message not found');
    const existing = await supabase.from('message_reactions').select('id').eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji).maybeSingle();
    if (existing.error && isMissingRelation(existing.error)) throw migrationNeeded('0028_messages_v1.sql');
    if (existing.data) {
      const del = await supabase.from('message_reactions').delete().eq('id', existing.data.id);
      if (del.error) throw new InternalServerErrorException(del.error.message);
      return { messageId, emoji, on: false };
    }
    const ins = await supabase.from('message_reactions').insert({ workspace_id: workspaceId, message_id: messageId, user_id: user.id, emoji });
    if (ins.error) throw isMissingRelation(ins.error) ? migrationNeeded('0028_messages_v1.sql') : new InternalServerErrorException(ins.error.message);
    return { messageId, emoji, on: true };
  }

  /** M48: remember this phone's Expo push token. Needs 0028. */
  async savePushToken(user: AuthUser, workspaceId: string, token: string, platform: 'ios' | 'android') {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { error } = await supabase.from('push_tokens').upsert({ token, workspace_id: workspaceId, user_id: user.id, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
    if (error) throw isMissingRelation(error) ? migrationNeeded('0028_messages_v1.sql') : new InternalServerErrorException(error.message);
    return { saved: true };
  }

  /** Every approval feeds the slow learning loop (runs in the background, never blocks the reply). */
  private async afterOwnerApproval(workspaceId: string): Promise<void> {
    void this.style.maybeLearn(workspaceId);
  }
}

function withoutInboxColumns(fields: Record<string, unknown>) {
  const { owner_unread: _unread, archived_at: _archived, ...rest } = fields;
  return rest;
}

export function threadPlatform(row: { external_thread_id?: string | null; channel?: { provider?: string } | null }) {
  const provider = row.channel?.provider ?? 'manual';
  if (provider !== 'manual') return provider;
  const match = /^manual:(line|instagram|facebook|other):/.exec(String(row.external_thread_id ?? ''));
  return match?.[1] ?? 'other';
}

export function snippetAround(body: string, term: string, span = 60) {
  const text = String(body ?? '');
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return text.slice(0, span * 2);
  const start = Math.max(0, at - span);
  return `${start > 0 ? '…' : ''}${text.slice(start, at + term.length + span)}${at + term.length + span < text.length ? '…' : ''}`;
}

function decorateThread(row: any, latest: any) {
  const platform = threadPlatform(row);
  const delivery = row.channel?.provider && row.channel.provider !== 'manual' ? 'live' : 'manual';
  const lastFromClient = latest ? latest.direction === 'inbound' : false;
  return {
    ...row,
    platform,
    platform_label: PLATFORM_LABEL[platform] ?? 'Other',
    delivery,
    last_preview: latest ? String(latest.body).slice(0, 140) : null,
    last_direction: latest?.direction ?? null,
    unread: typeof row.owner_unread === 'boolean' ? row.owner_unread : lastFromClient,
    archived: Boolean(row.archived_at),
    pinned: Boolean(row.pinned_at),
    muted: Boolean(row.muted_until && Date.parse(row.muted_until) > Date.now()),
    needs_reply: lastFromClient && !['done', 'spam_scam'].includes(row.status) && !row.archived_at
  };
}

export function classifyIntent(text: string) {
  if (/complain|refund|unhappy|angry|wrong|返金|クレーム/i.test(text)) return 'complaint';
  if (/resched|move my|change.*appointment|different time|日程.*変更|予約.*変更/i.test(text)) return 'reschedule';
  if (/available|availability|book|appointment|slot|free.*(today|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|予約|空き|空いて/i.test(text)) return 'booking';
  if (/price|cost|how much|¥|yen|\$|料金|値段|いくら|円/i.test(text)) return 'price';
  if (/where|location|address|parking|find you|arrived|場所|住所|駐車場/i.test(text)) return 'location';
  if (/aftercare|healing|wash|care|アフターケア|かさぶた|洗顔/i.test(text)) return 'aftercare';
  if (/student|course|training|class|スクール|講座|受講/i.test(text)) return 'student';
  if (/follow.?up|checking in/i.test(text)) return 'follow_up';
  return 'inquiry';
}

function isSensitive(text: string, intent: string) {
  return intent === 'complaint' || SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikePhishing(text: string) {
  return /(verify|confirm|unlock|suspend).*account/i.test(text) || /(password|one[- ]?time code|otp|gift card|crypto wallet)/i.test(text) || /(click|open).*https?:\/\//i.test(text);
}

