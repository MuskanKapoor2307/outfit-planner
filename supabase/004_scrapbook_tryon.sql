-- ============================================================
-- Outfit Planner — update 004: scrapbook themes + free try-on board
-- Run once in Supabase → SQL Editor → New query → Run (after 003).
-- ============================================================

-- 1. New scrapbook themes (old themes are mapped to the closest new one)
alter table public.style_profiles drop constraint if exists style_profiles_theme_check;
update public.style_profiles set theme = case theme
  when 'pink-pop' then 'happiness'   when 'coquette' then 'picnic'
  when 'vanilla-latte' then 'vloset' when 'riviera' then 'stylebook'
  when 'y2k' then 'vloset'           when 'quiet-luxury' then 'kraft'
  when 'street' then 'denim'         when 'tailored' then 'varsity'
  when 'trail' then 'matcha'         when 'mono' then 'stylebook'
  when 'desert-boho' then 'kraft'    when 'academia' then 'darkroom'
  else theme end;
alter table public.style_profiles add constraint style_profiles_theme_check check (theme in (
  'picnic','stylebook','vloset','matcha','happiness','denim','kraft','varsity','darkroom'));
alter table public.style_profiles alter column theme set default 'vloset';

-- 2. Try-on photo per profile (kept in its own extra-private storage area)
alter table public.style_profiles add column if not exists body_photo_path text;
alter table public.style_profiles add column if not exists body_photo_consent_at timestamptz;
alter table public.style_profiles drop constraint if exists body_photo_in_owner_folder;
alter table public.style_profiles add constraint body_photo_in_owner_folder
  check (body_photo_path is null or split_part(body_photo_path, '/', 1) = owner_id::text);

-- 3. Where each piece sits on the try-on board (positions only, no images)
alter table public.outfits add column if not exists tryon jsonb;
alter table public.outfits drop constraint if exists outfits_tryon_size;
alter table public.outfits add constraint outfits_tryon_size
  check (tryon is null or (jsonb_typeof(tryon) = 'array' and pg_column_size(tryon) < 16000));

-- 4. Private bucket for try-on photos: only the owner can read/upload/delete
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('people', 'people', false, 4194304, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "people: read own"   on storage.objects;
drop policy if exists "people: upload own" on storage.objects;
drop policy if exists "people: delete own" on storage.objects;

create policy "people: read own" on storage.objects for select to authenticated
  using (bucket_id = 'people' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "people: upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'people'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o
         where o.bucket_id = 'people' and (storage.foldername(o.name))[1] = auth.uid()::text) < 20
  );
create policy "people: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'people' and (storage.foldername(name))[1] = auth.uid()::text);
