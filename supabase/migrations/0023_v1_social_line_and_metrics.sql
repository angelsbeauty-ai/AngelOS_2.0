-- 0023 Social minimum loop: per-studio LINE Official Account connection + daily account numbers.
-- APPLIED on staging (hhzegavoyuicclsmrkwf). Header updated 2026-10-16; comment only, SQL unchanged.
-- Until this runs, the API answers "LINE setup needs database update 0023" and numbers fall back to a live read.

-- One LINE Official Account (Messaging API channel) per studio, entered once on the guided setup screen.
-- Secrets are AES-256-GCM encrypted by the API (key: SOCIAL_TOKEN_KEY env); the DB never sees plaintext.
-- No RLS policies on purpose: only the API (service role) reads/writes this table.
create table if not exists public.line_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  channel_id text not null,
  channel_secret_enc text not null,
  access_token_enc text not null,
  bot_user_id text not null unique,      -- one LINE OA can belong to only one studio
  display_name text,
  picture_url text,
  basic_id text,
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect', 'disconnected')),
  last_error text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.line_connections enable row level security;

-- Daily pull of followers + simple engagement per connected account.
create table if not exists public.social_account_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'line')),
  metric_date date not null,
  followers integer,
  engagement integer,                    -- IG/FB: likes+comments on recent posts; LINE: null
  reach integer,
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (workspace_id, platform, metric_date)
);
create index if not exists social_account_metrics_ws_idx on public.social_account_metrics (workspace_id, platform, metric_date desc);
alter table public.social_account_metrics enable row level security;
create policy "members read social account metrics" on public.social_account_metrics for select
using (public.is_workspace_member(workspace_id));
