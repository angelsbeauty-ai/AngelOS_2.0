import { apiFetch } from './api';

export interface WorkspaceSummary {
  id: string;
  name: string;
  business_type?: string | null;
  timezone: string;
  currency: string;
  locale: string;
  role?: 'owner' | 'student';
}

export async function getActiveWorkspace(): Promise<WorkspaceSummary> {
  const workspaces = await apiFetch<WorkspaceSummary[]>('/workspaces');
  const workspace = workspaces[0];
  if (!workspace) {
    throw new Error('No business workspace found. Create your workspace first.');
  }
  return workspace;
}

export const updateWorkspace = (id: string, input: { name?: string; currency?: string; timezone?: string; locale?: string }) =>
  apiFetch<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
