-- AngelOS V1 B1–B7: clients (contact fields, archive, health forms), PMU treatment details,
-- booking deposit, service description/deposit, business expenses.
-- NOT APPLIED. Needs Angel's yes before running on staging.
-- Until this runs: the matching screens say "needs database update" for the new fields only;
-- everything that already existed keeps working.

alter table public.clients add column if not exists line_id text check (line_id is null or char_length(line_id) <= 80);
alter table public.clients add column if not exists instagram_handle text check (instagram_handle is null or char_length(instagram_handle) <= 80);
alter table public.clients add column if not exists birthday date;
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.clients add column if not exists health_flag boolean not null default false;
create index if not exists clients_workspace_archived_idx on public.clients (workspace_id, archived_at);

create table if not exists public.client_health_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  red_flags text[] not null default '{}',
  form_version text not null default 'v1',
  signed_name text check (signed_name is null or char_length(signed_name) <= 160),
  signed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_id, workspace_id) references public.clients(id, workspace_id) on delete cascade
);
create index if not exists client_health_forms_client_idx on public.client_health_forms (workspace_id, client_id, created_at desc);
alter table public.client_health_forms enable row level security;
create policy "members manage client health forms" on public.client_health_forms for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.client_consents add column if not exists signed_name text check (signed_name is null or char_length(signed_name) <= 160);
alter table public.client_consents add column if not exists signature_method text check (signature_method is null or signature_method in ('typed_name','paper','verbal'));

alter table public.treatment_records add column if not exists area text;
alter table public.treatment_records add column if not exists pigments text;
alter table public.treatment_records add column if not exists needle text;
alter table public.treatment_records add column if not exists numbing text;
alter table public.treatment_records add column if not exists reaction text;

alter table public.appointments add column if not exists deposit_amount numeric(12,2) check (deposit_amount is null or deposit_amount >= 0);
alter table public.appointments add column if not exists deposit_method text;

alter table public.services add column if not exists description text check (description is null or char_length(description) <= 2000);
alter table public.services add column if not exists deposit_amount numeric(12,2) check (deposit_amount is null or deposit_amount >= 0);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null,
  category text not null default 'other' check (category in ('supplies','rent','marketing','education','equipment','fees','other')),
  method text,
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null default now(),
  idempotency_key text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists business_expenses_workspace_idx on public.business_expenses (workspace_id, occurred_at desc);
alter table public.business_expenses enable row level security;
create policy "members manage business expenses" on public.business_expenses for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
