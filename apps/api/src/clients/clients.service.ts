import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { createUserSupabaseClient } from '../config/supabase';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { CreateClientNoteDto } from './dto/create-note.dto';
import type { CreateTreatmentDto } from './dto/create-treatment.dto';
import type { CreateConsentDto } from './dto/create-consent.dto';
import type { CreateHealthFormDto } from './dto/health-form.dto';
import { HEALTH_QUESTIONS, redFlagsFrom, sanitizeAnswers, touchUpDue } from './health-form';
import { isMissingRelation } from '../messaging/saved-replies.service';

@Injectable()
export class ClientsService {
  async list(user: AuthUser, workspaceId: string, search?: string, filters: { status?: string; archived?: boolean; touchUpDue?: boolean } = {}) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const run = (withNew: boolean) => {
      let query = supabase
        .from('clients')
        .select(`id,display_name,first_name,last_name,email,phone,language,status,source,do_not_auto_message,created_at,updated_at${withNew ? ',line_id,instagram_handle,birthday,archived_at,health_flag' : ''}`)
        .eq('workspace_id', workspaceId)
        .order('display_name', { ascending: true })
        .limit(filters.touchUpDue ? 500 : 200);
      const safeSearch = sanitizeSearch(search);
      if (safeSearch) query = query.or(`display_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
      if (filters.status) query = query.eq('status', filters.status);
      if (withNew) query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
      return query;
    };
    let result: any = await run(true);
    if (result.error && isMissingRelation(result.error)) result = await run(false);
    if (result.error) throw new InternalServerErrorException(result.error.message);
    let rows: any[] = result.data ?? [];
    if (filters.touchUpDue && rows.length) {
      const ids = rows.map((r) => r.id);
      const [treatments, future] = await Promise.all([
        supabase.from('treatment_records').select('client_id,stage,performed_at').eq('workspace_id', workspaceId).in('client_id', ids).gte('performed_at', new Date(Date.now() - 80 * 86400000).toISOString()),
        supabase.from('appointments').select('client_id').eq('workspace_id', workspaceId).in('client_id', ids).gte('start_at', new Date().toISOString()).not('status', 'in', '(cancelled,no_show)')
      ]);
      rows = rows.filter((r) => touchUpDue((treatments.data ?? []).filter((t: any) => t.client_id === r.id), (future.data ?? []).filter((a: any) => a.client_id === r.id).length));
    }
    return rows;
  }

  async setArchived(user: AuthUser, workspaceId: string, clientId: string, archived: boolean) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('clients').update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', clientId).select('id,archived_at').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new NotFoundException('Client not found'); }
    return data;
  }

  async listHealthForms(user: AuthUser, workspaceId: string, clientId: string) {
    await this.assertClient(user, workspaceId, clientId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('client_health_forms').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false }).limit(20);
    if (error) { if (isMissingRelation(error)) return { forms: [], questions: HEALTH_QUESTIONS, needsMigration: MIGRATION }; throw new InternalServerErrorException(error.message); }
    return { forms: data ?? [], questions: HEALTH_QUESTIONS, needsMigration: null };
  }

  async addHealthForm(user: AuthUser, workspaceId: string, clientId: string, dto: CreateHealthFormDto) {
    await this.assertClient(user, workspaceId, clientId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const answers = sanitizeAnswers(dto.answers as any);
    if (!Object.keys(answers).length) throw new BadRequestException('Answer at least one question');
    const redFlags = redFlagsFrom(answers);
    const signedName = dto.signedName?.trim() || null;
    const { data, error } = await supabase.from('client_health_forms').insert({
      workspace_id: workspaceId, client_id: clientId, answers, red_flags: redFlags, signed_name: signedName, signed_at: signedName ? new Date().toISOString() : null, created_by: user.id
    }).select('*').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    await supabase.from('clients').update({ health_flag: redFlags.length > 0, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', clientId);
    return data;
  }

  async create(user: AuthUser, workspaceId: string, dto: CreateClientDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const displayName = dto.displayName.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;

    if (email || phone) {
      let duplicateQuery = supabase.from('clients').select('id,display_name,email,phone').eq('workspace_id', workspaceId).limit(1);
      if (email) duplicateQuery = duplicateQuery.eq('email', email);
      else if (phone) duplicateQuery = duplicateQuery.eq('phone', phone);
      const { data: duplicate, error: duplicateError } = await duplicateQuery;
      if (duplicateError) throw new InternalServerErrorException(duplicateError.message);
      if (duplicate?.length) throw new ConflictException(`A client with matching contact information already exists: ${duplicate[0].display_name}`);
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        first_name: dto.firstName?.trim() || null,
        last_name: dto.lastName?.trim() || null,
        display_name: displayName,
        email,
        phone,
        language: dto.language ?? 'en',
        status: dto.status ?? 'lead',
        source: dto.source?.trim() || null,
        do_not_auto_message: dto.doNotAutoMessage ?? false,
        created_by: user.id
      })
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async get(user: AuthUser, workspaceId: string, clientId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const clientResult = await supabase.from('clients').select('*').eq('workspace_id', workspaceId).eq('id', clientId).single();
    if (clientResult.error || !clientResult.data) throw new NotFoundException('Client not found');

    const [notes, treatments, consents, payments, followups, health, appointments] = await Promise.all([
      supabase.from('client_notes').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
      supabase.from('treatment_records').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('performed_at', { ascending: false }).limit(50),
      supabase.from('client_consents').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
      supabase.from('client_payment_entries').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('occurred_at', { ascending: false }).limit(50),
      supabase.from('client_followups').select('*').eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
      supabase.from('client_health_forms').select('id,red_flags,signed_name,signed_at,created_at').eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
      supabase.from('appointments').select('id,service_name,start_at,end_at,status,price_snapshot,currency').eq('workspace_id', workspaceId).eq('client_id', clientId).order('start_at', { ascending: false }).limit(50)
    ]);
    for (const result of [notes, treatments, consents, payments, followups]) {
      if (result.error) throw new InternalServerErrorException(result.error.message);
    }

    return {
      client: clientResult.data,
      notes: notes.data ?? [],
      treatments: treatments.data ?? [],
      consents: consents.data ?? [],
      payments: payments.data ?? [],
      followups: followups.data ?? [],
      healthForms: health.error ? [] : health.data ?? [],
      appointments: appointments.data ?? [],
      touchUpDue: touchUpDue((treatments.data ?? []) as any[], (appointments.data ?? []).filter((a: any) => Date.parse(a.start_at) > Date.now() && !['cancelled', 'no_show'].includes(a.status)).length)
    };
  }

  async update(user: AuthUser, workspaceId: string, clientId: string, dto: UpdateClientDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.firstName !== undefined) updates.first_name = dto.firstName?.trim() || null;
    if (dto.lastName !== undefined) updates.last_name = dto.lastName?.trim() || null;
    if (dto.displayName !== undefined) updates.display_name = dto.displayName.trim();
    if (dto.email !== undefined) updates.email = dto.email?.trim().toLowerCase() || null;
    if (dto.phone !== undefined) updates.phone = dto.phone?.trim() || null;
    if (dto.language !== undefined) updates.language = dto.language;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.source !== undefined) updates.source = dto.source?.trim() || null;
    if (dto.doNotAutoMessage !== undefined) updates.do_not_auto_message = dto.doNotAutoMessage;
    if (dto.lineId !== undefined) updates.line_id = dto.lineId?.trim().replace(/^@?/, '') || null;
    if (dto.instagramHandle !== undefined) updates.instagram_handle = dto.instagramHandle?.trim().replace(/^@/, '') || null;
    if (dto.birthday !== undefined) updates.birthday = dto.birthday ? dto.birthday.slice(0, 10) : null;

    const { data, error } = await supabase.from('clients').update(updates).eq('workspace_id', workspaceId).eq('id', clientId).select('*').single();
    if (error && isMissingRelation(error)) throw needsDb();
    if (error || !data) throw new NotFoundException('Client not found');
    return data;
  }

  async addNote(user: AuthUser, workspaceId: string, clientId: string, dto: CreateClientNoteDto) {
    await this.assertClient(user, workspaceId, clientId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('client_notes').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      note_type: dto.noteType ?? 'general',
      content: dto.content.trim(),
      created_by: user.id
    }).select('*').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async addTreatment(user: AuthUser, workspaceId: string, clientId: string, dto: CreateTreatmentDto) {
    await this.assertClient(user, workspaceId, clientId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('treatment_records').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      service_name: dto.serviceName.trim(),
      stage: dto.stage ?? 'first_session',
      technique: dto.technique?.trim() || null,
      performed_at: dto.performedAt ?? new Date().toISOString(),
      notes: dto.notes?.trim() || null,
      created_by: user.id,
      ...pmuFields(dto)
    }).select('*').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    return data;
  }

  async addConsent(user: AuthUser, workspaceId: string, clientId: string, dto: CreateConsentDto) {
    await this.assertClient(user, workspaceId, clientId);
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('client_consents').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      consent_type: dto.consentType,
      status: dto.status,
      scope: dto.scope ?? {},
      form_version: dto.formVersion ?? null,
      signed_at: dto.status === 'granted' ? new Date().toISOString() : null,
      created_by: user.id,
      ...(dto.signedName?.trim() ? { signed_name: dto.signedName.trim(), signature_method: 'typed_name' } : {})
    }).select('*').single();
    if (error) { if (isMissingRelation(error)) throw needsDb(); throw new InternalServerErrorException(error.message); }
    return data;
  }

  private async assertClient(user: AuthUser, workspaceId: string, clientId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data, error } = await supabase.from('clients').select('id').eq('workspace_id', workspaceId).eq('id', clientId).single();
    if (error || !data) throw new NotFoundException('Client not found');
  }
}

function sanitizeSearch(value?: string) {
  return value?.trim().replace(/[%,()]/g, '').slice(0, 100) || '';
}

const MIGRATION = '0020_v1_clients_bookings_money';
function needsDb() { return new ConflictException(`This needs the database update ${MIGRATION} (waiting for Angel's yes). Nothing was changed.`); }
function pmuFields(dto: CreateTreatmentDto) {
  const out: Record<string, string> = {};
  for (const key of ['area', 'pigments', 'needle', 'numbing', 'reaction'] as const) { const v = dto[key]?.trim(); if (v) out[key] = v; }
  return out;
}
