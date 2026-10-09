-- 0021 V1 roles + Academy (B9) and invite types (B10). Written for Angel's review. NOT applied.
-- 1) Members can be 'owner' or 'student'. 2) Studio data stays owner-only (restrictive policies added on top of
-- the existing member policies, so current owners see no change). 3) Academy tables. 4) Invite types.

alter table public.workspace_memberships drop constraint if exists workspace_memberships_role_check;
alter table public.workspace_memberships add constraint workspace_memberships_role_check check (role in ('owner', 'student'));

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_memberships m where m.workspace_id = p_workspace_id and m.user_id = auth.uid() and m.role = 'owner');
$$;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- Owner-only on every studio table that has a workspace_id (clients, client_*, appointments, calendar_blocks, services,
-- finance/payment, messages, media, content, automations, AI, ...). Academy, beta and platform tables are excluded.
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'workspace_id'
      and c.table_name not in ('workspace_memberships', 'workspace_invites')
      and c.table_name not like 'academy\_%' and c.table_name not like 'beta\_%' and c.table_name not like 'platform\_%' and c.table_name not like 'product\_%'
  loop
    execute format('drop policy if exists v1_owner_only on public.%I', t);
    execute format('create policy v1_owner_only on public.%I as restrictive for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id))', t);
  end loop;
end $$;

create table if not exists public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 4000),
  cover_media_id uuid references public.media_assets(id) on delete set null,
  published boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create table if not exists public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  course_id uuid not null,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  body text check (char_length(body) <= 20000),
  video_url text check (video_url is null or video_url ~ '^https://'),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (course_id, workspace_id) references public.lms_courses(id, workspace_id) on delete cascade
);
create index if not exists lms_lessons_course_idx on public.lms_lessons(course_id, position);
create table if not exists public.lms_enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  course_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, user_id),
  foreign key (course_id, workspace_id) references public.lms_courses(id, workspace_id) on delete cascade
);
create table if not exists public.lms_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lesson_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_done jsonb not null default '[]'::jsonb,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id),
  foreign key (lesson_id, workspace_id) references public.lms_lessons(id, workspace_id) on delete cascade
);
create table if not exists public.lms_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lesson_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text,
  note text check (char_length(note) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'try_again')),
  feedback text check (char_length(feedback) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (lesson_id, workspace_id) references public.lms_lessons(id, workspace_id) on delete cascade
);
create index if not exists lms_submissions_status_idx on public.lms_submissions(workspace_id, status, created_at desc);

alter table public.lms_courses enable row level security;
alter table public.lms_lessons enable row level security;
alter table public.lms_enrollments enable row level security;
alter table public.lms_progress enable row level security;
alter table public.lms_submissions enable row level security;

-- Owners manage everything in their workspace; students read published courses they are enrolled in and their own rows.
create policy lms_courses_owner on public.lms_courses for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy lms_courses_student on public.lms_courses for select to authenticated using (published and exists (select 1 from public.lms_enrollments e where e.course_id = lms_courses.id and e.user_id = auth.uid()));
create policy lms_lessons_owner on public.lms_lessons for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy lms_lessons_student on public.lms_lessons for select to authenticated using (exists (select 1 from public.lms_enrollments e join public.lms_courses c on c.id = e.course_id where e.course_id = lms_lessons.course_id and e.user_id = auth.uid() and c.published));
create policy lms_enrollments_owner on public.lms_enrollments for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy lms_enrollments_self on public.lms_enrollments for select to authenticated using (user_id = auth.uid());
create policy lms_progress_owner on public.lms_progress for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy lms_progress_self on public.lms_progress for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy lms_submissions_owner on public.lms_submissions for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy lms_submissions_self_read on public.lms_submissions for select to authenticated using (user_id = auth.uid());
create policy lms_submissions_self_insert on public.lms_submissions for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and public.is_workspace_member(workspace_id));

-- Practice photos: private bucket; the API uploads and hands out short signed links.
insert into storage.buckets (id, name, public) values ('academy-submissions', 'academy-submissions', false) on conflict (id) do nothing;

-- Invites: business owner (founder) or student (founder or a studio owner, for their own workspace).
alter table public.beta_invites add column if not exists invite_type text not null default 'business_owner' check (invite_type in ('business_owner', 'student'));
alter table public.beta_invites add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.beta_invites drop constraint if exists beta_invites_student_workspace_check;
alter table public.beta_invites add constraint beta_invites_student_workspace_check check (invite_type <> 'student' or workspace_id is not null);
