import { applyLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface Me { userId: string; email: string | null; founder: boolean; displayName: string | null; language: 'en' | 'ja' | null; memberships: Array<{ workspaceId: string; role: 'owner' | 'student'; workspaceName: string | null }> }

let cached: Promise<Me> | null = null;
export function getMe(force = false) {
  if (!cached || force) cached = apiFetch<Me>('/me').then((me) => { applyLanguage(me.language); return me; }).catch((e) => { cached = null; throw e; });
  return cached;
}
export function clearMe() { cached = null; }
export const updateMe = (input: { displayName?: string; language?: 'en' | 'ja' }) => apiFetch<Me>('/me', { method: 'PATCH', body: JSON.stringify(input) }).then((me) => { cached = Promise.resolve(me); applyLanguage(me.language); return me; });
export const deleteMe = () => apiFetch<{ deleted: boolean }>('/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });

/** 'student' only when the user is a student and owns no studio. null while loading or signed out. */
export function roleOf(me: Me | null): 'owner' | 'student' | null {
  if (!me) return null;
  if (me.memberships.some((m) => m.role === 'owner')) return 'owner';
  return me.memberships.some((m) => m.role === 'student') ? 'student' : 'owner';
}

export function useRole() {
  const [role, setRole] = useState<'owner' | 'student' | null>(null);
  useEffect(() => { let live = true; void getMe().then((me) => { if (live) setRole(roleOf(me)); }).catch(() => undefined); return () => { live = false; }; }, []);
  return role;
}

/** Studio pages a student may open. Everything else redirects to Profile. */
export const STUDENT_ALLOWED = /^\/(account|profile|settings|login|onboarding|forgot-password|reset-password|privacy|terms|help)(\/|$)/;

/** Internal founder tools. Everyone else is sent to Profile and never sees the screen render. */
export const FOUNDER_ONLY = /^\/(founder-admin|system-health|beta-feedback)(\/|$)/;

export function useFounder() {
  const [founder, setFounder] = useState<boolean | null>(null);
  useEffect(() => { let live = true; void getMe().then((me) => { if (live) setFounder(Boolean(me.founder)); }).catch(() => { if (live) setFounder(false); }); return () => { live = false; }; }, []);
  return founder;
}
