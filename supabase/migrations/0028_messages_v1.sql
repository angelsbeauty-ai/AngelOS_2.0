-- 0028 Messages v1: pin/mute/delete per thread, reply-to, reactions, attachments, push tokens.
-- FILE ONLY. Apply with Angel's yes. Until it runs the API answers "needs the 0028 update" for these
-- features and everything else keeps working.

-- M12 pin / mute / delete (soft delete: hidden from the inbox, history kept).
alter table public.message_threads add column if not exists pinned_at timestamptz;
alter table public.message_threads add column if not exists muted_until timestamptz;
alter table public.message_threads add column if not exists deleted_at timestamptz;
create index if not exists message_threads_ws_pinned_idx on public.message_threads (workspace_id, pinned_at desc nulls last);

-- M51 reply-to: which message a reply quotes.
alter table public.client_messages add column if not exists reply_to_message_id uuid references public.client_messages(id) on delete set null;

-- M20 attachments: a sent photo points at the media library asset (angelos-media bucket).
alter table public.client_messages add column if not exists attachment_asset_id uuid references public.media_assets(id) on delete set null;

-- Checklist 3/4 reactions: the owner's own reactions on a message (one row per emoji per person).
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid not null references public.client_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
alter table public.message_reactions enable row level security;
create policy "members manage message reactions" on public.message_reactions for all
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

-- M48 push: the phone's Expo push token, per user and device.
create table if not exists public.push_tokens (
  token text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_ws_idx on public.push_tokens (workspace_id);
alter table public.push_tokens enable row level security;
create policy "users manage own push tokens" on public.push_tokens for all
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
