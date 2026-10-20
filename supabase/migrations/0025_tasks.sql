-- 0025 Tasks: simple per-studio tasks so the calendar can mark them.
-- Apply with Angel's yes. Until it runs, the calendar shows no task markers.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_workspace_due_idx on public.tasks (workspace_id, due_at);
alter table public.tasks enable row level security;

create policy "members manage tasks" on public.tasks for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
