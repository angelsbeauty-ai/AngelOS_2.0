import { apiFetch } from './api';
export interface ServiceItem { id: string; name: string; duration_minutes: number; buffer_before_minutes: number; buffer_after_minutes: number; standard_price: number; currency: string; }
export interface CalendarAppointment { id: string; service_name: string; start_at: string; end_at: string; status: string; client: { id: string; display_name: string } | null; }
export interface CalendarBlock { id: string; title: string; block_type: string; start_at: string; end_at: string; }
export function listServices(workspaceId: string) { return apiFetch<ServiceItem[]>(`/workspaces/${workspaceId}/services`); }
export function createService(workspaceId: string, input: Record<string, unknown>) { return apiFetch<ServiceItem>(`/workspaces/${workspaceId}/services`, { method: 'POST', body: JSON.stringify(input) }); }
export function getCalendar(workspaceId: string, start: string, end: string) { return apiFetch<{ appointments: CalendarAppointment[]; blocks: CalendarBlock[] }>(`/workspaces/${workspaceId}/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`); }
export function createAppointment(workspaceId: string, input: Record<string, unknown>) { return apiFetch<{ appointment: CalendarAppointment; softConflictsAccepted: unknown[] }>(`/workspaces/${workspaceId}/appointments`, { method: 'POST', body: JSON.stringify(input) }); }
export function confirmAppointment(workspaceId: string, appointmentId: string) { return apiFetch(`/workspaces/${workspaceId}/appointments/${appointmentId}/confirm`, { method: 'POST' }); }
export function cancelAppointment(workspaceId: string, appointmentId: string) { return apiFetch(`/workspaces/${workspaceId}/appointments/${appointmentId}/cancel`, { method: 'POST' }); }
export function rescheduleAppointment(workspaceId: string, appointmentId: string, input: { startAt: string; overrideSoftConflict?: boolean }) { return apiFetch(`/workspaces/${workspaceId}/appointments/${appointmentId}/reschedule`, { method: 'POST', body: JSON.stringify(input) }); }

export interface BusinessHour { day_of_week: number; start_time: string | null; end_time: string | null; is_closed: boolean }
export interface AppointmentDetail {
  appointment: CalendarAppointment & { client_id: string; price_snapshot: number; currency: string; notes: string | null; deposit_amount?: number | null; deposit_method?: string | null; client?: { id?: string; display_name: string; language?: string; phone?: string | null } | null };
  events: Array<{ id: string; event_type: string; created_at: string }>;
  money: { price: number; received: number; due: number };
  health: { status: 'ok' | 'check_before_treatment' | 'missing'; redFlags: string[] };
}
const ws = (id: string) => `/workspaces/${id}`;
export function listAllServices(workspaceId: string) { return apiFetch<Array<ServiceItem & { active: boolean; description?: string | null; deposit_amount?: number | null }>>(`${ws(workspaceId)}/services/all`); }
export function updateService(workspaceId: string, id: string, input: Record<string, unknown>) { return apiFetch(`${ws(workspaceId)}/services/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function getBusinessHours(workspaceId: string) { return apiFetch<BusinessHour[]>(`${ws(workspaceId)}/business-hours`); }
export function setBusinessHours(workspaceId: string, hours: Array<{ dayOfWeek: number; startTime?: string; endTime?: string; isClosed: boolean }>) { return apiFetch(`${ws(workspaceId)}/business-hours`, { method: 'PUT', body: JSON.stringify({ hours }) }); }
export function createBlock(workspaceId: string, input: { title: string; blockType: string; startAt: string; endAt: string; notes?: string }) { return apiFetch(`${ws(workspaceId)}/calendar/blocks`, { method: 'POST', body: JSON.stringify(input) }); }
export function deleteBlock(workspaceId: string, id: string) { return apiFetch(`${ws(workspaceId)}/calendar/blocks/${id}`, { method: 'DELETE' }); }
export function getAppointment(workspaceId: string, id: string) { return apiFetch<AppointmentDetail>(`${ws(workspaceId)}/appointments/${id}`); }
export function updateAppointment(workspaceId: string, id: string, input: Record<string, unknown>) { return apiFetch(`${ws(workspaceId)}/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function completeAppointment(workspaceId: string, id: string) { return apiFetch(`${ws(workspaceId)}/appointments/${id}/complete`, { method: 'POST' }); }
export function markNoShow(workspaceId: string, id: string) { return apiFetch(`${ws(workspaceId)}/appointments/${id}/no-show`, { method: 'POST' }); }
