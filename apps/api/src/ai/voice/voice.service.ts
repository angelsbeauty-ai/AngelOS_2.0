import { BadGatewayException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthUser } from '../../auth/auth-user';
import { createUserSupabaseClient } from '../../config/supabase';

/** Live voice instructions. Voice is never recorded or stored and no transcript is kept, by AngelOS or in this session config. */
export function voiceInstructions(input: { assistantName: string; workspaceName: string; screen?: string | null }) {
  return [
    `You are ${input.assistantName}, the business assistant for ${input.workspaceName}, a permanent-makeup studio in Japan.`,
    'You are talking with the owner by live voice. Speak English, short and warm. Ask one question at a time.',
    'You can explain, plan and give advice. You cannot change bookings, money, posts or send client messages in voice:',
    'for any change, tell her to type it in the AngelOS chat, where an approval card appears.',
    'Never invent business facts (prices, hours, client details). Say you do not know instead.',
    input.screen ? `She opened voice from the "${input.screen}" screen.` : ''
  ].filter(Boolean).join('\n');
}

/**
 * Mints a short-lived OpenAI Realtime client secret on the server. The main OPENAI_API_KEY never leaves the server.
 * No audio and no transcript passes through or is saved by AngelOS; the browser talks to OpenAI directly over WebRTC.
 */
@Injectable()
export class VoiceService {
  private readonly recent = new Map<string, number[]>();

  status() {
    const live = process.env.AI_PROVIDER_MODE === 'openai' && Boolean(process.env.OPENAI_API_KEY);
    return { available: live, mode: live ? 'live' : 'mock', reason: live ? null : 'Live voice is off: the server needs AI_PROVIDER_MODE=openai and OPENAI_API_KEY (Angel sets these).', stored: false };
  }

  async createSession(user: AuthUser, workspaceId: string, screen?: string | null) {
    const status = this.status();
    if (!status.available) return { ...status, clientSecret: null, expiresAt: null, model: null };
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
    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex') },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 120 },
        session: { type: 'realtime', model, instructions: voiceInstructions({ assistantName: profile?.display_name ?? 'AngelOS', workspaceName: ws.name, screen }), audio: { output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } }
      })
    });
    if (!response.ok) throw new BadGatewayException(`Voice could not start (${response.status}).`);
    const payload = (await response.json()) as any;
    if (!payload?.value) throw new BadGatewayException('Voice could not start.');
    return { ...status, clientSecret: String(payload.value), expiresAt: payload.expires_at ?? null, model };
  }
}
