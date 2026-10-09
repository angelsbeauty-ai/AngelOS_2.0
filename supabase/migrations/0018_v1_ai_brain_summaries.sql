-- AngelOS V1 "brain": short usage SUMMARIES only.
-- NOT APPLIED. Needs Angel's yes before running on staging.
--
-- Hard rules this table is built around:
--   * No voice, no transcripts, no raw message text. Rows hold a fixed topic key, a short
--     template summary written by AngelOS (never copied from a message), a few tags and counts.
--   * Per-workspace isolation: members can only read their own workspace's rows (RLS).
--     Writes happen only from the AngelOS backend (service role).
--   * The only cross-workspace view is ai_brain_topic_aggregates(): topic -> number of
--     workspaces and number of requests. No workspace ids, names, emails or text leave it,
--     and only the backend (service role) may call it (used by the founder-only API).

create table if not exists public.ai_brain_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('owner_request', 'owner_preference', 'client_request')),
  topic text not null check (topic ~ '^[a-z0-9_]{2,60}$'),
  summary text not null check (char_length(summary) between 1 and 140),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  request_count integer not null default 1 check (request_count >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (workspace_id, kind, topic)
);

create index if not exists ai_brain_summaries_topic_idx on public.ai_brain_summaries (kind, topic, last_seen_at desc);

alter table public.ai_brain_summaries enable row level security;
create policy "members read own brain summaries" on public.ai_brain_summaries for select
using (public.is_workspace_member(workspace_id));
-- No insert/update/delete policies: only the backend (service role) writes.

-- Atomic "seen again" counter used by the backend.
create or replace function public.ai_brain_record(
  p_workspace_id uuid, p_kind text, p_topic text, p_summary text, p_tags text[]
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.ai_brain_summaries (workspace_id, kind, topic, summary, tags)
  values (p_workspace_id, p_kind, p_topic, p_summary, coalesce(p_tags, '{}'))
  on conflict (workspace_id, kind, topic) do update
    set request_count = public.ai_brain_summaries.request_count + 1,
        summary = excluded.summary,
        tags = excluded.tags,
        last_seen_at = now();
$$;

-- Anonymised cross-workspace counts. Returns topics and numbers only.
create or replace function public.ai_brain_topic_aggregates(p_days integer default 90, p_min_workspaces integer default 1)
returns table (kind text, topic text, workspaces bigint, requests bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.kind, s.topic, count(distinct s.workspace_id) as workspaces, sum(s.request_count)::bigint as requests
  from public.ai_brain_summaries s
  where s.last_seen_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  group by s.kind, s.topic
  having count(distinct s.workspace_id) >= greatest(1, coalesce(p_min_workspaces, 1))
  order by count(distinct s.workspace_id) desc, sum(s.request_count) desc;
$$;

revoke all on function public.ai_brain_record(uuid, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.ai_brain_topic_aggregates(integer, integer) from public, anon, authenticated;
grant execute on function public.ai_brain_record(uuid, text, text, text, text[]) to service_role;
grant execute on function public.ai_brain_topic_aggregates(integer, integer) to service_role;
