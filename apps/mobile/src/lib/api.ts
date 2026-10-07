import { supabase } from './supabase';
import { runtimeConfig } from './runtime-config';
import { handleSessionExpired } from './session';

const apiUrl = runtimeConfig.apiUrl.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) { super(message); this.name = 'ApiError'; }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) } });
  } catch (error) {
    throw new ApiError(0, error, 'Network request failed');
  } finally { clearTimeout(timeout); }
  const raw = await response.text();
  let payload: unknown = raw;
  if (raw) { try { payload = JSON.parse(raw); } catch { /* keep text */ } }
  if (response.status === 401) await handleSessionExpired();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? String((payload as any).message) : raw || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, payload, message);
  }
  return payload as T;
}
