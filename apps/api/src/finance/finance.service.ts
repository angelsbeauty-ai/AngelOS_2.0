import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { createUserSupabaseClient } from '../config/supabase';
import type { RecordFinanceEntryDto } from './dto/record-finance-entry.dto';
import type { RecordExpenseDto } from './dto/record-expense.dto';
import { sumSince, toCsv, whoOwes, type AppointmentRow, type PaymentRow } from '../analytics/business-metrics';
import { isMissingRelation } from '../messaging/saved-replies.service';
import { eveningSlot, localDate } from '../ai/suggestions/suggestion-rules';

@Injectable()
export class FinanceService {
  async recordEntry(user: AuthUser, workspaceId: string, dto: RecordFinanceEntryDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('workspace_id', workspaceId).eq('id', dto.clientId).single();
    if (clientError || !client) throw new NotFoundException('Client not found');
    if (dto.appointmentId) {
      const { data: appt, error } = await supabase.from('appointments').select('id,client_id,currency').eq('workspace_id', workspaceId).eq('id', dto.appointmentId).single();
      if (error || !appt) throw new NotFoundException('Appointment not found');
      if (appt.client_id !== dto.clientId) throw new ConflictException('Appointment belongs to a different client');
    }
    if (dto.entryType === 'correction' && !dto.correctionEffect) throw new ConflictException('Correction entries require a correction effect');
    const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('currency').eq('id', workspaceId).single();
    if (workspaceError || !workspace) throw new NotFoundException('Workspace not found');
    const payload = {
      workspace_id: workspaceId,
      client_id: dto.clientId,
      appointment_id: dto.appointmentId ?? null,
      entry_type: dto.entryType,
      amount: dto.amount,
      currency: dto.currency ?? workspace.currency,
      method: dto.method?.trim() || null,
      note: dto.note?.trim() || null,
      occurred_at: dto.occurredAt ?? new Date().toISOString(),
      idempotency_key: dto.idempotencyKey?.trim() || null,
      correction_effect: dto.entryType === 'correction' ? dto.correctionEffect : null,
      created_by: user.id
    };
    const { data, error } = await supabase.from('client_payment_entries').insert(payload).select('*').single();
    if (error) {
      if ((error as any).code === '23505' && payload.idempotency_key) {
        const existing = await supabase.from('client_payment_entries').select('*').eq('workspace_id', workspaceId).eq('idempotency_key', payload.idempotency_key).single();
        if (!existing.error && existing.data) return { entry: existing.data, duplicatePrevented: true };
      }
      throw new InternalServerErrorException(error.message);
    }
    return { entry: data, duplicatePrevented: false };
  }

  async appointmentSummary(user: AuthUser, workspaceId: string, appointmentId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: appointment, error } = await supabase.from('appointments').select('id,client_id,service_name,price_snapshot,currency,status,start_at').eq('workspace_id', workspaceId).eq('id', appointmentId).single();
    if (error || !appointment) throw new NotFoundException('Appointment not found');
    const { data: entries, error: entriesError } = await supabase.from('client_payment_entries').select('*').eq('workspace_id', workspaceId).eq('appointment_id', appointmentId).order('occurred_at');
    if (entriesError) throw new InternalServerErrorException(entriesError.message);
    const summary = summarizeLedger(entries ?? [], Number(appointment.price_snapshot));
    return { appointment, entries: entries ?? [], ...summary };
  }

  async recordExpense(user: AuthUser, workspaceId: string, dto: RecordExpenseDto) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: workspace } = await supabase.from('workspaces').select('currency').eq('id', workspaceId).maybeSingle();
    if (!workspace) throw new NotFoundException('Workspace not found');
    const row = { workspace_id: workspaceId, amount: dto.amount, currency: workspace.currency, category: dto.category, method: dto.method ?? null, note: dto.note?.trim() || null, occurred_at: dto.occurredAt ?? new Date().toISOString(), idempotency_key: dto.idempotencyKey?.trim() || null, created_by: user.id };
    const { data, error } = await supabase.from('business_expenses').insert(row).select('*').single();
    if (error) {
      if (isMissingRelation(error)) throw new ConflictException("Expenses need the database update 0020_v1_clients_bookings_money (waiting for Angel's yes). Nothing was saved.");
      if ((error as any).code === '23505' && row.idempotency_key) return { expense: null, duplicatePrevented: true };
      throw new InternalServerErrorException(error.message);
    }
    return { expense: data, duplicatePrevented: false };
  }

  /** Money screen: today / week / month, by method, expenses, who still owes. */
  async summary(user: AuthUser, workspaceId: string) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const now = Date.now();
    const since = new Date(now - 92 * 86400000).toISOString();
    const [payments, expenses, appts, ws] = await Promise.all([
      supabase.from('client_payment_entries').select('id,entry_type,amount,method,occurred_at,correction_effect,appointment_id,client_id,note,client:clients(display_name)').eq('workspace_id', workspaceId).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(2000),
      supabase.from('business_expenses').select('*').eq('workspace_id', workspaceId).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(1000),
      supabase.from('appointments').select('id,client_id,service_name,status,start_at,price_snapshot,client:clients(display_name)').eq('workspace_id', workspaceId).eq('status', 'completed').gte('start_at', new Date(now - 365 * 86400000).toISOString()).limit(2000),
      supabase.from('workspaces').select('currency,timezone').eq('id', workspaceId).maybeSingle()
    ]);
    if (payments.error) throw new InternalServerErrorException(payments.error.message);
    if (!ws.data) throw new NotFoundException('Workspace not found');
    const rows = (payments.data ?? []) as unknown as PaymentRow[];
    const tz = ws.data.timezone || 'Asia/Tokyo';
    const startOfToday = Date.parse(eveningSlot(localDate(new Date(now), tz), tz, 0));
    const expenseRows = expenses.error ? [] : (expenses.data ?? []);
    const spent = (ms: number) => expenseRows.filter((e: any) => Date.parse(e.occurred_at) >= ms).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const byMethod: Record<string, number> = {};
    for (const r of rows) if (Date.parse(r.occurred_at) >= now - 30 * 86400000) { const k = r.method || 'other'; byMethod[k] = (byMethod[k] ?? 0) + (r.entry_type === 'refund' ? -Number(r.amount) : ['deposit', 'payment'].includes(r.entry_type) ? Number(r.amount) : 0); }
    let owesRows: any[] = [];
    if (!appts.error) {
      const ids = (appts.data ?? []).map((a: any) => a.id);
      const paid = ids.length ? await supabase.from('client_payment_entries').select('entry_type,amount,appointment_id,occurred_at,correction_effect').eq('workspace_id', workspaceId).in('appointment_id', ids) : { data: [] as any[] };
      const names = new Map((appts.data ?? []).map((a: any) => [a.id, a.client?.display_name ?? 'Client']));
      owesRows = whoOwes((appts.data ?? []) as unknown as AppointmentRow[], (paid.data ?? []) as PaymentRow[]).slice(0, 50).map((o) => ({ ...o, clientName: names.get(o.appointmentId) }));
    }
    return {
      currency: ws.data.currency,
      income: { today: sumSince(rows, startOfToday), week: sumSince(rows, now - 7 * 86400000), month: sumSince(rows, now - 30 * 86400000) },
      expenses: { today: spent(startOfToday), week: spent(now - 7 * 86400000), month: spent(now - 30 * 86400000), needsMigration: expenses.error && isMissingRelation(expenses.error) ? '0020_v1_clients_bookings_money' : null },
      byMethod,
      owes: owesRows,
      recent: [
        ...rows.slice(0, 60).map((r: any) => ({ kind: 'income', id: r.id, type: r.entry_type, amount: Number(r.amount), method: r.method, at: r.occurred_at, who: r.client?.display_name ?? null, note: r.note ?? null })),
        ...expenseRows.slice(0, 40).map((e: any) => ({ kind: 'expense', id: e.id, type: e.category, amount: Number(e.amount), method: e.method, at: e.occurred_at, who: null, note: e.note }))
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80)
    };
  }

  async exportCsv(user: AuthUser, workspaceId: string, days = 90) {
    const supabase = createUserSupabaseClient(user.accessToken);
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 731) * 86400000).toISOString();
    const [payments, expenses] = await Promise.all([
      supabase.from('client_payment_entries').select('entry_type,amount,currency,method,occurred_at,note,client:clients(display_name)').eq('workspace_id', workspaceId).gte('occurred_at', since).order('occurred_at'),
      supabase.from('business_expenses').select('category,amount,currency,method,occurred_at,note').eq('workspace_id', workspaceId).gte('occurred_at', since).order('occurred_at')
    ]);
    if (payments.error) throw new InternalServerErrorException(payments.error.message);
    const rows = [
      ...(payments.data ?? []).map((p: any) => ({ date: p.occurred_at.slice(0, 10), kind: 'income', type: p.entry_type, amount: p.entry_type === 'refund' ? -Number(p.amount) : Number(p.amount), currency: p.currency, method: p.method ?? '', client: p.client?.display_name ?? '', note: p.note ?? '' })),
      ...(expenses.error ? [] : expenses.data ?? []).map((e: any) => ({ date: e.occurred_at.slice(0, 10), kind: 'expense', type: e.category, amount: -Number(e.amount), currency: e.currency, method: e.method ?? '', client: '', note: e.note ?? '' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    return toCsv(rows, ['date', 'kind', 'type', 'amount', 'currency', 'method', 'client', 'note']);
  }

  async overview(user: AuthUser, workspaceId: string, days = 30) {
    const safeDays = Math.min(Math.max(Number.isFinite(days) ? days : 30, 1), 366);
    const since = new Date(Date.now() - safeDays * 86400000).toISOString();
    const supabase = createUserSupabaseClient(user.accessToken);
    const { data: entries, error } = await supabase.from('client_payment_entries').select('*').eq('workspace_id', workspaceId).gte('occurred_at', since).order('occurred_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    const rows = entries ?? [];
    const actualIncome = rows.reduce((sum: number, row: any) => sum + incomeEffect(row), 0);
    const byMethod: Record<string, number> = {};
    for (const row of rows as any[]) {
      const effect = incomeEffect(row);
      if (!effect) continue;
      const key = row.method || 'other';
      byMethod[key] = (byMethod[key] ?? 0) + effect;
    }
    return { days: safeDays, actualIncome, byMethod, entries: rows.slice(0, 100) };
  }
}

function summarizeLedger(entries: any[], appointmentPrice: number) {
  const explicitExpected = entries.filter((row) => row.entry_type === 'expected').reduce((sum: number, row) => sum + Number(row.amount || 0), 0);
  let expected = explicitExpected > 0 ? explicitExpected : appointmentPrice;
  let received = 0;
  let discounts = 0;
  let refunds = 0;
  for (const row of entries) {
    const amount = Number(row.amount || 0);
    if (row.entry_type === 'discount') discounts += amount;
    if (row.entry_type === 'deposit' || row.entry_type === 'payment') received += amount;
    if (row.entry_type === 'refund') { refunds += amount; received -= amount; }
    if (row.entry_type === 'correction') {
      if (row.correction_effect === 'increase_expected') expected += amount;
      if (row.correction_effect === 'decrease_expected') expected -= amount;
      if (row.correction_effect === 'increase_income') received += amount;
      if (row.correction_effect === 'decrease_income') received -= amount;
    }
  }
  const amountDue = Math.max(0, expected - discounts - received);
  return { expectedTotal: expected, discounts, actualReceived: received, refunds, amountDue, requiresOwnerConfirmationBeforeClientReminder: amountDue > 0 };
}

function incomeEffect(row: any) {
  const amount = Number(row.amount || 0);
  if (row.entry_type === 'deposit' || row.entry_type === 'payment') return amount;
  if (row.entry_type === 'refund') return -amount;
  if (row.entry_type === 'correction' && row.correction_effect === 'increase_income') return amount;
  if (row.entry_type === 'correction' && row.correction_effect === 'decrease_income') return -amount;
  return 0;
}
