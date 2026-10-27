import { apiFetch } from './api';

export interface ClientSummary {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  language: string;
  status: string;
  source: string | null;
  do_not_auto_message: boolean;
  line_id?: string | null;
  instagram_handle?: string | null;
  birthday?: string | null;
  archived_at?: string | null;
  health_flag?: boolean | null;
  notes_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDetail {
  client: ClientSummary;
  notes: Array<{ id: string; note_type: string; content: string; created_at: string }>;
  treatments: Array<{ id: string; service_name: string; stage: string; technique: string | null; performed_at: string; notes: string | null }>;
  consents: Array<{ id: string; consent_type: string; status: string; scope: Record<string, unknown>; created_at: string }>;
  payments: Array<{ id: string; entry_type: string; amount: number; currency: string; method: string | null; occurred_at: string }>;
  followups: Array<{ id: string; reason: string; due_at: string | null; status: string }>;
  healthForms: Array<{ id: string; answers: Record<string, { answer: 'yes' | 'no'; detail?: string }>; red_flags: string[]; signed_name: string | null; signed_at: string | null; created_at: string }>;
  appointments: Array<{ id: string; service_name: string; start_at: string; status: string; price_snapshot: number }>;
  touchUpDue: boolean;
}

export type ClientFilter = 'all' | 'new' | 'active' | 'touch_up' | 'archived';
export interface HealthQuestion { key: string; en: string; ja: string; redFlag: boolean }

/**
 * Legacy demo / proof / test contacts left by earlier seeds are hidden everywhere, never deleted.
 * Keep in sync with apps/api/src/clients/demo-seed.ts (isDemoSeedClient).
 */
const DEMO_NAMES = [/^Demo Client$/, /^Proof Client/, /^Walk Client/, /^Test Client [A-Z]$/];
const DEMO_SOURCES = new Set(['test seed', 'manual-demo']);
export const isDemoSeed = (c: Pick<ClientSummary, 'display_name' | 'source'>) =>
  DEMO_SOURCES.has(String(c.source ?? '').trim().toLowerCase()) || DEMO_NAMES.some((re) => re.test(String(c.display_name ?? '').trim()));
/** Every client picker reads through here, so demo seeds never show up anywhere in the app. */
export function listClients(workspaceId: string, search = '', filter: ClientFilter = 'all') {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (filter === 'new') params.set('status', 'lead');
  if (filter === 'active') params.set('status', 'active');
  if (filter === 'touch_up') params.set('touchUpDue', 'true');
  if (filter === 'archived') params.set('archived', 'true');
  const query = params.toString();
  return apiFetch<ClientSummary[]>(`/workspaces/${workspaceId}/clients${query ? `?${query}` : ''}`).then((rows) => (rows ?? []).filter((c) => !isDemoSeed(c)));
}

export function updateClient(workspaceId: string, clientId: string, input: Record<string, unknown>) {
  return apiFetch<ClientSummary>(`/workspaces/${workspaceId}/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export function setClientArchived(workspaceId: string, clientId: string, archived: boolean) {
  return apiFetch(`/workspaces/${workspaceId}/clients/${clientId}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
}
export function getHealthForms(workspaceId: string, clientId: string) {
  return apiFetch<{ forms: ClientDetail['healthForms']; questions: HealthQuestion[]; needsMigration: string | null }>(`/workspaces/${workspaceId}/clients/${clientId}/health-forms`);
}
export function addHealthForm(workspaceId: string, clientId: string, input: { answers: Record<string, unknown>; signedName: string }) {
  return apiFetch(`/workspaces/${workspaceId}/clients/${clientId}/health-forms`, { method: 'POST', body: JSON.stringify(input) });
}
export function addConsent(workspaceId: string, clientId: string, input: Record<string, unknown>) {
  return apiFetch(`/workspaces/${workspaceId}/clients/${clientId}/consents`, { method: 'POST', body: JSON.stringify(input) });
}

export function getClient(workspaceId: string, clientId: string) {
  return apiFetch<ClientDetail>(`/workspaces/${workspaceId}/clients/${clientId}`);
}

export function createClient(workspaceId: string, input: Record<string, unknown>) {
  return apiFetch<ClientSummary>(`/workspaces/${workspaceId}/clients`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function addClientNote(workspaceId: string, clientId: string, content: string) {
  return apiFetch(`/workspaces/${workspaceId}/clients/${clientId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ noteType: 'general', content })
  });
}

export function addTreatment(workspaceId: string, clientId: string, input: Record<string, unknown>) {
  return apiFetch(`/workspaces/${workspaceId}/clients/${clientId}/treatments`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
