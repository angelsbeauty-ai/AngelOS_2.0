-- AngelOS V1 B8: Messages inbox (saved replies, unread state, archive).
-- NOT APPLIED. Needs Angel's yes before running on staging.
--
-- * saved_replies: reusable answers (prices, directions, deposit, aftercare, cancellation) in EN and/or JA.
-- * message_threads.owner_unread / archived_at: unread dot and archive in the inbox.
-- Until this runs, the inbox still lists and opens conversations; saved replies, the unread dot
-- and archive answer with a clear "needs database update" message instead of failing silently.

create table if not exists public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'other'
    check (category in ('prices','directions','deposit','aftercare','cancellation','booking','follow_up','other')),
  body_en text check (body_en is null or char_length(body_en) <= 2000),
  body_ja text check (body_ja is null or char_length(body_ja) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(body_en, body_ja) is not null)
);
create index if not exists saved_replies_workspace_idx on public.saved_replies(workspace_id, category);

alter table public.saved_replies enable row level security;
create policy "members manage saved replies" on public.saved_replies for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.message_threads add column if not exists owner_unread boolean not null default false;
alter table public.message_threads add column if not exists archived_at timestamptz;
create index if not exists message_threads_workspace_unread_idx on public.message_threads(workspace_id, owner_unread) where archived_at is null;
