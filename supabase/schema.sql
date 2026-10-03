-- ============================================================
-- Outfit Planner — Phase 1 database
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to re-run: it drops and recreates the policies.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Admins (only you). Rows are added by hand in the SQL editor.
-- ------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists "admin sees own row" on public.app_admins;
create policy "admin sees own row" on public.app_admins
  for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: nobody can make themselves admin from the app.

-- ------------------------------------------------------------
-- 2. Invites log (only the server, with the secret key, can touch this)
-- ------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_link_at timestamptz not null default now()
);
alter table public.invites enable row level security;
-- No policies at all = no access from the browser.

-- ------------------------------------------------------------
-- 3. Style profiles (Me, Mom, Sister...) each with its own theme
-- ------------------------------------------------------------
create table if not exists public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  theme text not null default 'clean-girl'
    check (theme in ('girly-pop','old-money','clean-girl','boho-sunset','dark-academia')),
  emoji text check (emoji is null or char_length(emoji) <= 8),
  created_at timestamptz not null default now()
);
create index if not exists style_profiles_owner_idx on public.style_profiles(owner_id);

-- ------------------------------------------------------------
-- 4. Wardrobe items (photo with background removed)
-- ------------------------------------------------------------
create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.style_profiles(id) on delete cascade,
  image_path text not null,
  name text not null check (char_length(trim(name)) between 1 and 60),
  category text not null check (category in (
    'top','bottom','dress','set','outerwear','ethnic','footwear','bag','jewellery','accessory','other')),
  color text check (color is null or char_length(color) <= 30),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  created_at timestamptz not null default now(),
  -- the photo must live inside the owner's own folder
  constraint image_in_owner_folder check (split_part(image_path, '/', 1) = owner_id::text)
);
create index if not exists wardrobe_profile_idx on public.wardrobe_items(profile_id);

-- ------------------------------------------------------------
-- 5. Trips (folders like "Goa")
-- ------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null references public.style_profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  destination text check (destination is null or char_length(destination) <= 60),
  start_date date not null,
  end_date date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  constraint trip_dates_valid check (end_date >= start_date and end_date - start_date <= 30)
);
create index if not exists trips_profile_idx on public.trips(profile_id);

-- ------------------------------------------------------------
-- 6. Outfits (many per day and time slot)
-- ------------------------------------------------------------
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('morning','afternoon','evening','night')),
  title text not null check (char_length(trim(title)) between 1 and 60),
  aesthetic text check (aesthetic is null or char_length(aesthetic) <= 40),
  footwear text check (footwear is null or char_length(footwear) <= 200),
  accessories text check (accessories is null or char_length(accessories) <= 300),
  hairstyle text check (hairstyle is null or char_length(hairstyle) <= 200),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists outfits_trip_idx on public.outfits(trip_id, day);

create table if not exists public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  item_id uuid not null references public.wardrobe_items(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position int not null default 0,
  primary key (outfit_id, item_id)
);

-- ------------------------------------------------------------
-- 7. Per-account limits (protects the free storage/database quota)
-- ------------------------------------------------------------
create or replace function public.enforce_row_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim int := tg_argv[0]::int;
  cnt int;
begin
  execute format('select count(*) from %I.%I where owner_id = $1', tg_table_schema, tg_table_name)
    into cnt using new.owner_id;
  if cnt >= lim then
    raise exception 'limit_reached: you can have at most % of these', lim;
  end if;
  return new;
end $$;
revoke all on function public.enforce_row_limit() from public, anon, authenticated;

drop trigger if exists limit_profiles on public.style_profiles;
create trigger limit_profiles before insert on public.style_profiles
  for each row execute function public.enforce_row_limit('8');
drop trigger if exists limit_items on public.wardrobe_items;
create trigger limit_items before insert on public.wardrobe_items
  for each row execute function public.enforce_row_limit('400');
drop trigger if exists limit_trips on public.trips;
create trigger limit_trips before insert on public.trips
  for each row execute function public.enforce_row_limit('60');
drop trigger if exists limit_outfits on public.outfits;
create trigger limit_outfits before insert on public.outfits
  for each row execute function public.enforce_row_limit('2000');

-- ------------------------------------------------------------
-- 8. Row Level Security: everyone sees ONLY their own rows
-- ------------------------------------------------------------
alter table public.style_profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.trips          enable row level security;
alter table public.outfits        enable row level security;
alter table public.outfit_items   enable row level security;

-- style_profiles
drop policy if exists "own profiles" on public.style_profiles;
create policy "own profiles" on public.style_profiles for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- wardrobe_items: own rows, and the profile must also be yours
drop policy if exists "own items" on public.wardrobe_items;
create policy "own items" on public.wardrobe_items for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.style_profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );

-- trips
drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.style_profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );

-- outfits: the trip must be yours and the day must be inside the trip
drop policy if exists "own outfits" on public.outfits;
create policy "own outfits" on public.outfits for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = auth.uid()
        and day between t.start_date and t.end_date
    )
  );

-- outfit_items: both the outfit and the item must be yours
drop policy if exists "own outfit items" on public.outfit_items;
create policy "own outfit items" on public.outfit_items for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid())
    and exists (select 1 from public.wardrobe_items w where w.id = item_id and w.owner_id = auth.uid())
  );

-- Logged-out visitors get nothing at all
revoke all on public.style_profiles, public.wardrobe_items, public.trips,
              public.outfits, public.outfit_items, public.invites, public.app_admins from anon;

-- ------------------------------------------------------------
-- 9. Private photo storage
-- Every file lives at  <your-user-id>/<random-id>.webp
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 2097152, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "wardrobe: read own"   on storage.objects;
drop policy if exists "wardrobe: upload own" on storage.objects;
drop policy if exists "wardrobe: delete own" on storage.objects;

create policy "wardrobe: read own" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe: upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o
         where o.bucket_id = 'wardrobe'
           and (storage.foldername(o.name))[1] = auth.uid()::text) < 450
  );

create policy "wardrobe: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
-- No update policy: photos can't be silently overwritten.

-- ============================================================
-- AFTER your own account exists, make yourself admin (once):
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ============================================================
