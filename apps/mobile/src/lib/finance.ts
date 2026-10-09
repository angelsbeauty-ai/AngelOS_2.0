import { apiFetch } from './api';

export interface FinanceOverview {
  days: number;
  actualIncome: number;
  byMethod: Record<string, number>;
  entries: Array<{ id: string; entry_type: string; amount: number; currency: string; method: string | null; occurred_at: string; client_id: string; appointment_id: string | null }>;
}

export function getFinanceOverview(workspaceId: string, days = 30) {
  return apiFetch<FinanceOverview>(`/workspaces/${workspaceId}/finance/overview?days=${days}`);
}

export function recordFinanceEntry(workspaceId: string, input: Record<string, unknown>) {
  return apiFetch(`/workspaces/${workspaceId}/finance/entries`, { method: 'POST', body: JSON.stringify(input) });
}

export type MoneyRow = { kind: 'income' | 'expense'; id: string; type: string; amount: number; method: string | null; at: string; who: string | null; note: string | null };
export interface MoneySummary {
  currency: string;
  income: { today: number; week: number; month: number };
  expenses: { today: number; week: number; month: number; needsMigration: string | null };
  byMethod: Record<string, number>;
  owes: Array<{ appointmentId: string; clientId: string; clientName?: string; service: string; startAt: string; due: number }>;
  recent: MoneyRow[];
}
export function getMoneySummary(workspaceId: string) { return apiFetch<MoneySummary>(`/workspaces/${workspaceId}/finance/summary`); }
export function recordExpense(workspaceId: string, input: { amount: number; category: string; method?: string; note?: string; idempotencyKey?: string }) {
  return apiFetch(`/workspaces/${workspaceId}/finance/expenses`, { method: 'POST', body: JSON.stringify(input) });
}
export function exportMoneyCsv(workspaceId: string) { return apiFetch<string>(`/workspaces/${workspaceId}/finance/export.csv`); }
export function formatYen(value: number, currency = 'JPY') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value); } catch { return `${currency} ${Math.round(value)}`; }
}
