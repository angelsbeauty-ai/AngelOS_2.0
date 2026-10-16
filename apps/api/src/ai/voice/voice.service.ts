import { createHash } from 'node:crypto';
import { assertAiAllowed, recordAiUse } from '../ai-usage';
import { BadGatewayException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import type { AuthUser } from '../../auth/auth-user';
import { createUserSupabaseClient } from '../../config/supabase';

const AGENT_NAME = 'angelos-studio';

/** Live voice instructions. Voice is never recorded or stored and no transcript is kept. */
export function voiceInstructions(input: { assistantName: string; workspaceName: string; screen?: string | null; context?: string | null }) {
  return [
    `You are ${input.assistantName}, the business assistant for ${input.workspaceName}, a permanent-makeup studio in Japan.`,
    'You are talking with the owner by live voice. Speak English, short and warm. Ask one question at a time.',
    'You can explain, plan and give advice. You cannot change bookings, money, posts or send client messages in voice:',
    'for any change, tell her to type it in the AngelOS chat, where an approval card appears.',
    'Never invent business facts (prices, hours, client details). Say you do not know instead.',
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
      reason: live ? null : 'Live voice is off until the server has an OpenAI key or LiveKit keys.',
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
    const metadata = JSON.stringify({
      instructions: voiceInstructions({
        assistantName: profile?.display_name ?? 'AngelOS',
        workspaceName: ws.name,
        screen,
        context
      })
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
      body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 120 }, session: { type: 'realtime', model, instructions, audio: { output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } } })
    });
    if (!response.ok) throw new BadGatewayException(`Voice could not start (${response.status}).`);
    const payload = (await response.json()) as any;
    if (!payload?.value) throw new BadGatewayException('Voice could not start.');
    void recordAiUse('voice', { userId: user.id, workspaceId });
    return { ...status, clientSecret: String(payload.value), token: null, url: null, room: null, expiresAt: payload.expires_at ?? null, model };
  }
}
