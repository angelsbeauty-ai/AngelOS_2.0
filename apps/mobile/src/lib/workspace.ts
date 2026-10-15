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
    throw new NoWorkspaceError();
  }
  return workspace;
}

export const updateWorkspace = (id: string, input: { name?: string; currency?: string; timezone?: string; locale?: string }) =>
  apiFetch<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

/** Thrown when the signed-in user has no studio yet. Screens show <NoStudio /> instead of an error. */
export class NoWorkspaceError extends Error { constructor() { super('No business workspace found. Create your workspace first.'); this.name = 'NoWorkspaceError'; } }
export const isNoWorkspace = (e: unknown) => e instanceof NoWorkspaceError || (e instanceof Error && e.name === 'NoWorkspaceError');
