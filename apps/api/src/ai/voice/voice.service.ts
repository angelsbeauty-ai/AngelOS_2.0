import { createHash } from 'node:crypto';
import { assertAiAllowed, recordAiUse } from '../ai-usage';
import { BadGatewayException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import type { AuthUser } from '../../auth/auth-user';
import { createUserSupabaseClient } from '../../config/supabase';
import { mintVoiceToken } from './voice-token';
import { functionTools } from '../tools/read-tools';

const AGENT_NAME = 'angelos-studio';

const VOICE_TOOLS = [
  ...functionTools(),
  {
    type: 'function',
    name: 'look_up_studio',
    description: 'Read real studio records. Call this before answering unread messages, who needs a reply, or what is booked today.',
    parameters: {
      type: 'object',
      properties: { topic: { type: 'string', enum: ['unread', 'today'] } },
      required: ['topic']
    }
  },
  {
    type: 'function',
    name: 'draft_reply',
    description: 'Save one reply as a draft and show it on her screen with an Approve button. This never sends. Only her tap on Approve sends it.',
    parameters: {
      type: 'object',
      properties: {
        threadId: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['threadId', 'body']
    }
  }
];

/** Live voice instructions. Voice is never recorded or stored and no transcript is kept. */
export function voiceInstructions(input: { assistantName: string; workspaceName: string; screen?: string | null; context?: string | null }) {
  return [
    `You are ${input.assistantName}, the business assistant for ${input.workspaceName}, a permanent-makeup studio in Japan.`,
    'You are talking with the owner by live voice. While voice is on, you run the studio for her. Do not send her away to type it somewhere else.',
    'Speak in short, warm sentences. Use her language. Ask one question at a time.',
    'For any other fact use the read tools (get_bookings, list_threads, get_analytics, get_money, list_posts, list_services_prices, search_clients, list_campaigns_tasks). Numbers come only from tool results; a null value is unavailable.',
    'When she asks for a fact, call look_up_studio first. Never invent a count, a name, a price, an hour, or a booking.',
    'Unread replies: call look_up_studio with topic unread. Say the number. Then take them one by one. Read who it is from and the short preview. Propose one short reply in the client\'s language. When she likes it, call draft_reply with that thread id and the exact words. Tell her the draft is on her screen and she can tap Approve to send it. Then the next one.',
    'You can never send a message yourself, even if she says yes or send. Only her tap on Approve sends. Never claim a message was sent.',
    'Settings stay off: account, password, billing, connected apps, and deleting anything. If she clearly asks to change a setting, say voice cannot change settings.',
    input.screen ? `She opened voice from the "${input.screen}" screen.` : '',
    input.context ? `Start by greeting her and summarising today in 2-3 short sentences using ONLY these facts from AngelOS (do not add anything):\n${input.context}\nThen ask what she would like to do. If she interrupts, stop and listen.` : ''
  ].filter(Boolean).join('\n');
}

/**
 * Opens a LiveKit room and asks the AngelOS voice worker to join it.
 * The LiveKit secret stays on the server. The phone only receives a short-lived room token.
 */
@Injectable()
export class VoiceService {
  private readonly recent = new Map<string, number[]>();

  /** LiveKit when its keys are set; otherwise the direct OpenAI Realtime (WebRTC) path with a short-lived key. */
  provider(): 'livekit' | 'openai' | null {
    if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) return 'livekit';
    if (process.env.OPENAI_API_KEY && (process.env.AI_PROVIDER_MODE ?? 'openai') === 'openai') return 'openai';
    return null;
  }

  status() {
    const provider = this.provider();
    const live = provider !== null;
    return {
      available: live,
      mode: live ? 'live' as const : 'mock' as const,
      provider,
      reason: live ? null : 'Live voice is not set up on the server yet.',
      stored: false as const
    };
  }

  async createSession(user: AuthUser, workspaceId: string, screen?: string | null, context?: string | null) {
    const status = this.status();
    const empty = { ...status, clientSecret: null, token: null, url: null, room: null, expiresAt: null, model: null };
    if (!status.available) return empty;
    await assertAiAllowed(user.id);
    const now = Date.now();
    const recent = (this.recent.get(user.id) ?? []).filter((t) => now - t < 3600000);
    if (recent.length >= 20) throw new HttpException('Too many voice sessions this hour. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    this.recent.set(user.id, [...recent, now]);

    const supabase = createUserSupabaseClient(user.accessToken);
    const [{ data: ws }, { data: profile }] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
      supabase.from('ai_assistant_profiles').select('display_name').eq('workspace_id', workspaceId).maybeSingle()
    ]);
    if (!ws) throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);

    if (status.provider === 'openai') return this.openaiSession(user, workspaceId, status, voiceInstructions({ assistantName: profile?.display_name ?? 'AngelOS', workspaceName: ws.name, screen, context }));

    const url = process.env.LIVEKIT_URL as string;
    const apiKey = process.env.LIVEKIT_API_KEY as string;
    const apiSecret = process.env.LIVEKIT_API_SECRET as string;
    const room = `angelos-${workspaceId.slice(0, 8)}-${now.toString(36)}`;
    const tokenBuilder = new AccessToken(apiKey, apiSecret, { identity: user.id, ttl: '10m' });
    tokenBuilder.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    const token = await tokenBuilder.toJwt();
    const apiBase = (process.env.PUBLIC_API_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'https://angelosapi-staging.up.railway.app')).replace(/\/$/, '');
    const metadata = JSON.stringify({
      instructions: voiceInstructions({
        assistantName: profile?.display_name ?? 'AngelOS',
        workspaceName: ws.name,
        screen,
        context
      }),
      workspaceId,
      // Scoped 10-minute read+draft token. Angel's login token never leaves the API.
      voiceToken: mintVoiceToken(user.id, workspaceId),
      apiBase
    });
    try {
      const dispatch = new AgentDispatchClient(url, apiKey, apiSecret);
      await dispatch.createDispatch(room, AGENT_NAME, { metadata });
    } catch {
      throw new BadGatewayException('Voice could not start.');
    }
    void recordAiUse('voice', { userId: user.id, workspaceId });
    return { ...status, clientSecret: null, token, url, room, expiresAt: null, model: 'gpt-4o-mini' };
  }

  /** Mints a 2-minute OpenAI Realtime client secret. The main key never leaves the server; audio goes phone/browser <-> OpenAI directly. */
  private async openaiSession(user: AuthUser, workspaceId: string, status: ReturnType<VoiceService['status']>, instructions: string) {
    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex') },
      body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 600 }, session: { type: 'realtime', model, instructions, tools: VOICE_TOOLS, audio: { output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } } })
    });
    if (!response.ok) throw new BadGatewayException(`Voice could not start (${response.status}).`);
    const payload = (await response.json()) as any;
    if (!payload?.value) throw new BadGatewayException('Voice could not start.');
    void recordAiUse('voice', { userId: user.id, workspaceId });
    return { ...status, clientSecret: String(payload.value), token: null, url: null, room: null, expiresAt: payload.expires_at ?? null, model };
  }
}
