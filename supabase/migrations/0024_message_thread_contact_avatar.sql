-- Contact profile photo for inbox rows (Instagram/Messenger profile_pic, LINE pictureUrl). Nullable; filled during sync/webhook.
alter table public.message_threads add column if not exists contact_avatar_url text;
alter table public.message_threads add column if not exists contact_avatar_checked_at timestamptz;
