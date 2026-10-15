-- 0022 Meta (Instagram / Facebook) per-studio connections via OAuth.
-- NOT APPLIED. Needs founder approval before running on staging/production.
-- Tokens are stored AES-256-GCM encrypted by the API (key: META_TOKEN_KEY env); the DB never sees plaintext.
-- No RLS policies on purpose: only the API (service role) reads/writes this table. Clients see status via the API.

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id text not null,
  page_name text,
  ig_user_id text,
  ig_username text,
  page_token_enc text not null,          -- encrypted long-lived Page access token
  user_token_enc text,                   -- encrypted long-lived user token (used to refresh the page list)
  token_expires_at timestamptz,          -- null = page tokens from a long-lived user token do not expire
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect', 'disconnected')),
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, page_id),
  unique (page_id)                       -- one Page can belong to only one studio
);

create index if not exists meta_connections_ig_idx on public.meta_connections (ig_user_id);
alter table public.meta_connections enable row level security;
-- (no policies: service role only)
