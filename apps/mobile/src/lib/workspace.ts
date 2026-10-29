import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, ApiError } from './api';
import { hasSession } from './session';

const ACTIVE_KEY = 'angelos.activeWorkspaceId';

export interface WorkspaceSummary {
  id: string;
  name: string;
  business_type?: string | null;
  timezone: string;
  currency: string;
  locale: string;
  role?: 'owner' | 'student';
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  // Signed out (e.g. on the login screen): no point asking the API, it can only answer 401.
  if (!(await hasSession())) throw new ApiError(401, null, 'Signed out');
  return apiFetch<WorkspaceSummary[]>('/workspaces');
}

export async function getActiveWorkspace(): Promise<WorkspaceSummary> {
  const workspaces = await listWorkspaces();
  if (!workspaces.length) throw new NoWorkspaceError();
  const saved = await AsyncStorage.getItem(ACTIVE_KEY);
  const match = saved ? workspaces.find((w) => w.id === saved) : null;
  return match ?? workspaces[0];
}

export async function setActiveWorkspace(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

export const updateWorkspace = (id: string, input: { name?: string; currency?: string; timezone?: string; locale?: string }) =>
  apiFetch<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export class NoWorkspaceError extends Error { constructor() { super('No business workspace found. Create your workspace first.'); this.name = 'NoWorkspaceError'; } }
export const isNoWorkspace = (e: unknown) => e instanceof NoWorkspaceError || (e instanceof Error && e.name === 'NoWorkspaceError');
