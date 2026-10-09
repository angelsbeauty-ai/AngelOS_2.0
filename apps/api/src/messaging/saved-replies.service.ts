import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { createUserSupabaseClient } from '../config/supabase';
import type { CreateSavedReplyDto, UpdateSavedReplyDto } from './dto/saved-reply.dto';

/** Starter replies with [brackets] Angel fills in. Approving a reply that still has [brackets] is blocked. */
export const STARTER_SAVED_REPLIES = [
  {
    title: 'Prices', category: 'prices',
    body_en: 'Hi {name}! Our prices: Brows [price] yen, Lips [price] yen, Eyeliner [price] yen. The touch-up 6–8 weeks later is [price] yen. Just let me know which one you are interested in 😊',
    body_ja: '{name}さん、お問い合わせありがとうございます✨ 料金は、眉 [料金]円、リップ [料金]円、アイライン [料金]円です。6〜8週間後のリタッチは[料金]円です。気になるメニューがあればお気軽に聞いてくださいね🌸'
  },
  {
    title: 'Address & directions', category: 'directions',
    body_en: 'Hi {name}! The studio is at [address]. [Parking / landmark]. If you get lost, just message me here 😊',
    body_ja: '{name}さん、サロンの場所は[住所]です。[駐車場・目印]。迷ったらいつでもここにメッセージくださいね✨'
  },
  {
    title: 'Deposit policy', category: 'deposit',
    body_en: 'To hold your appointment we ask for a deposit of [amount] yen, which goes toward your treatment. Payment by [method]. Thank you!',
    body_ja: 'ご予約確定のため、[金額]円のデポジットをお願いしています。施術代金に充てさせていただきますね。お支払いは[方法]でお願いします🌸'
  },
  {
    title: 'Aftercare', category: 'aftercare',
    body_en: 'Hi {name}, thank you for coming today! Aftercare: keep the area clean and dry for 7 days, do not pick or scratch, no makeup on the area, and avoid sauna, swimming and strong sun. Some flaking is normal. If anything worries you, message me anytime 🌸',
    body_ja: '{name}さん、本日はありがとうございました✨ アフターケアについてです。7日間は施術部分を清潔に保ち、濡らさないようにしてくださいね。かさぶたは無理に取らず、施術部分へのメイク、サウナ・プール・強い日差しは控えてください。皮むけは自然な経過なので安心してくださいね。気になることがあればいつでも連絡ください🌸'
  },
  {
    title: 'Cancellation policy', category: 'cancellation',
    body_en: 'If you need to change or cancel, please let me know at least [48] hours before. Late cancellations may lose the deposit. Thank you for understanding!',
    body_ja: 'ご予約の変更・キャンセルは[48]時間前までにご連絡をお願いします。直前のキャンセルはデポジットの返金ができないのでご了承くださいね🙏'
  }
] as const;

export function hasUnfilledPlaceholder(text: string) {
  return /\[[^\]\n]{1,40}\]/.test(text);
}

export function isMissingRelation(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  return code === '42P01' || code === 'PGRST205' || code === '42703' || code === 'PGRST204' || /does not exist|schema cache/i.test(message);
}

export function migrationNeeded(file: string) {
  return new ConflictException(`This needs the database update ${file} (waiting for Angel's yes). Nothing was changed.`);
}

@Injectable()
export class SavedRepliesService {
  async list(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('saved_replies').select('*').eq('workspace_id', workspaceId).order('category').order('title');
    if (error) {
      if (isMissingRelation(error)) return { replies: [], needsMigration: '0015_v1_messaging_inbox.sql' };
      throw new InternalServerErrorException(error.message);
    }
    return { replies: data ?? [], needsMigration: null };
  }

  async create(user: AuthUser, workspaceId: string, dto: CreateSavedReplyDto) {
    const bodyEn = dto.bodyEn?.trim() || null;
    const bodyJa = dto.bodyJa?.trim() || null;
    if (!bodyEn && !bodyJa) throw new BadRequestException('Write the reply in English or Japanese.');
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('saved_replies').insert({
      workspace_id: workspaceId, title: dto.title.trim(), category: dto.category ?? 'other',
      body_en: bodyEn, body_ja: bodyJa, created_by: user.id
    }).select('*').single();
    if (error) {
      if (isMissingRelation(error)) throw migrationNeeded('0015_v1_messaging_inbox.sql');
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }

  async update(user: AuthUser, workspaceId: string, replyId: string, dto: UpdateSavedReplyDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) updates.title = dto.title.trim();
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.bodyEn !== undefined) updates.body_en = dto.bodyEn.trim() || null;
    if (dto.bodyJa !== undefined) updates.body_ja = dto.bodyJa.trim() || null;
    const { data, error } = await supabase.from('saved_replies').update(updates).eq('workspace_id', workspaceId).eq('id', replyId).select('*').single();
    if (error && isMissingRelation(error)) throw migrationNeeded('0015_v1_messaging_inbox.sql');
    if (error && String((error as any).code) === '23514') throw new BadRequestException('Keep at least one language filled in.');
    if (error || !data) throw new NotFoundException('Saved reply not found');
    return data;
  }

  async remove(user: AuthUser, workspaceId: string, replyId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('saved_replies').delete().eq('workspace_id', workspaceId).eq('id', replyId).select('id');
    if (error && isMissingRelation(error)) throw migrationNeeded('0015_v1_messaging_inbox.sql');
    if (error) throw new InternalServerErrorException(error.message);
    if (!data?.length) throw new NotFoundException('Saved reply not found');
    return { deleted: true };
  }

  /** Adds the 5 starter replies (only the ones whose title is not there yet). */
  async seedStarters(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const existing = await this.list(user, workspaceId);
    if (existing.needsMigration) throw migrationNeeded(existing.needsMigration);
    const titles = new Set(existing.replies.map((row: any) => String(row.title).toLowerCase()));
    const rows = STARTER_SAVED_REPLIES.filter((row) => !titles.has(row.title.toLowerCase())).map((row) => ({ ...row, workspace_id: workspaceId, created_by: user.id }));
    if (rows.length) {
      let { error } = await supabase.from('saved_replies').insert(rows.map((row) => ({ ...row, source: 'starter' })));
      if (error && isMissingRelation(error)) ({ error } = await supabase.from('saved_replies').insert(rows)); // before 0016
      if (error) throw new InternalServerErrorException(error.message);
    }
    return this.list(user, workspaceId);
  }
}
