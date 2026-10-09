-- AngelOS V1 C4: "AngelOS suggests" Dismiss is remembered for the day.
-- NOT APPLIED. Needs Angel's yes before running on staging.
-- Until this runs, suggestions still show and Approve works; Dismiss only hides the card on the device.

create table if not exists public.ai_suggestion_dismissals (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  suggestion_key text not null check (char_length(suggestion_key) <= 200),
  dismissed_on date not null default current_date,
  dismissed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, suggestion_key, dismissed_on)
);

alter table public.ai_suggestion_dismissals enable row level security;
create policy "members manage suggestion dismissals" on public.ai_suggestion_dismissals for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
