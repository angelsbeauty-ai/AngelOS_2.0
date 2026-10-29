import { supabase } from './supabase';
import { runtimeConfig } from './runtime-config';
import { handleSessionExpired, handleSignedOut401 } from './session';

const apiUrl = runtimeConfig.apiUrl.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) { super(message); this.name = 'ApiError'; }
}

export async function apiFetch<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
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
  // Only a real session that stopped working counts as "expired"; logged-out visitors on public pages (signup, forgot/reset password) stay put.
  if (response.status === 401 && token) {
    // O33: a token that expired while the phone slept (or was refreshed on another device) gets one silent refresh + retry first.
    if (!retried) { const { data: fresh } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } })); if (fresh.session?.access_token && fresh.session.access_token !== token) return apiFetch<T>(path, init, true); }
    await handleSessionExpired();
  } else if (response.status === 401) {
    // Signed out (no token): go to /login instead of showing "couldn't load" on a studio screen.
    handleSignedOut401();
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? String((payload as any).message) : raw || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, payload, message);
  }
  return payload as T;
}
