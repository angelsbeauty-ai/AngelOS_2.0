-- AngelOS V1 B0.2: social composer platforms.
-- NOT APPLIED. Needs Angel's yes before running on staging.
--
-- Widens content_variants.platform so the composer can save LINE broadcast drafts and,
-- later, per-placement Instagram variants (feed / reel / story) as in GORDON_PACKET_V1_FULL B0.4.
-- Existing values ('instagram','facebook','tiktok','manual') stay valid, so no data changes.
-- Until this runs, the API answers a LINE draft with a clear 409 instead of saving it;
-- Instagram, Facebook and TikTok drafts already work on the current schema.

do $$
declare
  existing record;
begin
  -- 0007 declared the check inline, so drop it by definition rather than trusting its generated name.
  for existing in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.content_variants'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%platform%'
  loop
    execute format('alter table public.content_variants drop constraint %I', existing.conname);
  end loop;
end $$;

alter table public.content_variants
  add constraint content_variants_platform_check
  check (platform in ('instagram','instagram_feed','instagram_reel','instagram_story','facebook','line','tiktok','manual'));
