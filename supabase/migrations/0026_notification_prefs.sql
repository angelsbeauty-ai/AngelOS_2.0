-- 0026 Notification preferences: which alerts the owner wants.
-- Apply with Angel's yes. Until it runs, the phone still saves these locally.

create table if not exists public.notification_prefs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  messages boolean not null default true,
  bookings boolean not null default true,
  ai boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy "members manage notification prefs" on public.notification_prefs for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
