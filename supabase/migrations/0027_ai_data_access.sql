-- 0027 What AngelOS can see: per-area read switches for the assistant (text + voice).
-- Approved by Angel 20 Oct 2026 18:44 JST. FILE ONLY: apply with Angel's yes.
-- Until it runs, the API treats every area as on (the approved default).

create table if not exists public.ai_data_access (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  area text not null check (area in ('bookings','clients','messages','posts','analytics','money','services','campaigns')),
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, area)
);

alter table public.ai_data_access enable row level security;

create policy "members read ai data access" on public.ai_data_access for select
using (public.is_workspace_member(workspace_id));

create policy "members manage ai data access" on public.ai_data_access for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
