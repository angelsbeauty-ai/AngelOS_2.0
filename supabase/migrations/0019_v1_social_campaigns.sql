-- AngelOS V1 B0.5: campaigns + saved hashtag sets.
-- NOT APPLIED. Needs Angel's yes before running on staging.
-- Until this runs: the Campaigns screen says "needs database update"; the 30-day plan,
-- ideas, before/after maker, "Mark as posted" and LINE broadcast drafts work without it.

create table if not exists public.content_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  goal text not null default 'bookings' check (goal in ('bookings','academy_students','trust','reach','touch_ups')),
  starts_on date not null,
  ends_on date not null,
  offer text check (offer is null or char_length(offer) <= 300),
  status text not null default 'draft' check (status in ('draft','planned','active','done','archived')),
  plan jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92),
  unique (id, workspace_id)
);
create index if not exists content_campaigns_workspace_idx on public.content_campaigns (workspace_id, starts_on desc);

alter table public.content_posts add column if not exists campaign_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_posts_campaign_fk') then
    alter table public.content_posts add constraint content_posts_campaign_fk
      foreign key (campaign_id, workspace_id) references public.content_campaigns(id, workspace_id) on delete set null (campaign_id);
  end if;
end $$;
create index if not exists content_posts_campaign_idx on public.content_posts (workspace_id, campaign_id);

create table if not exists public.hashtag_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  language text not null default 'both' check (language in ('en','ja','both')),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table public.content_campaigns enable row level security;
alter table public.hashtag_sets enable row level security;
create policy "members manage content campaigns" on public.content_campaigns for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage hashtag sets" on public.hashtag_sets for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
