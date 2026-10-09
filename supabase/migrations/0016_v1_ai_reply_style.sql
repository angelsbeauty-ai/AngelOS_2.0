-- AngelOS V1 C2/C4: the assistant learns how the owner replies to clients.
-- NOT APPLIED. Needs Angel's yes before running on staging.
--
-- Stores LEARNINGS, not transcripts:
-- * ai_style_profiles: the owner's manual reply settings + a small derived style summary
--   (tone, typical length, emoji use, greeting/closing patterns with names masked, language mix, formality).
-- * saved_replies.status/source/occurrences: replies the owner sent 3+ times become
--   "suggested" saved replies (names masked) that she approves or rejects. Nothing else is copied.
-- Depends on 0015_v1_messaging_inbox.sql (saved_replies).

create table if not exists public.ai_style_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  learn_from_replies boolean not null default true,
  reply_tone text not null default 'casual_friendly'
    check (reply_tone in ('casual_friendly','warm_polite','professional','playful')),
  emoji_level text not null default 'light' check (emoji_level in ('none','light','lots')),
  reply_length text not null default 'short' check (reply_length in ('short','medium','detailed')),
  style_notes text not null default '' check (char_length(style_notes) <= 1000),
  learned jsonb not null default '{}'::jsonb,
  sample_count integer not null default 0 check (sample_count >= 0),
  learned_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ai_style_profiles enable row level security;
create policy "members manage ai style profile" on public.ai_style_profiles for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.saved_replies add column if not exists status text not null default 'approved';
alter table public.saved_replies add column if not exists source text not null default 'owner';
alter table public.saved_replies add column if not exists occurrences integer not null default 0;
alter table public.saved_replies add column if not exists fingerprint text;
alter table public.saved_replies add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_replies_status_check') then
    alter table public.saved_replies add constraint saved_replies_status_check check (status in ('approved','suggested','rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_replies_source_check') then
    alter table public.saved_replies add constraint saved_replies_source_check check (source in ('owner','starter','learned'));
  end if;
end $$;

create unique index if not exists saved_replies_workspace_fingerprint_idx
  on public.saved_replies(workspace_id, fingerprint) where fingerprint is not null;
create index if not exists saved_replies_workspace_status_idx on public.saved_replies(workspace_id, status);
