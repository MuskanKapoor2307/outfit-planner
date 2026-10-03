-- ============================================================
-- Outfit Planner — update 002
-- Run once in Supabase → SQL Editor → New query → Run,
-- AFTER schema.sql. Safe to run on a database that already has data:
-- existing Morning/Afternoon/Evening/Night outfits are moved into sections.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New themes (for her, for him, for anyone) + "style for"
-- ------------------------------------------------------------
alter table public.style_profiles drop constraint if exists style_profiles_theme_check;

update public.style_profiles set theme = case theme
  when 'girly-pop' then 'pink-pop'
  when 'old-money' then 'riviera'
  when 'clean-girl' then 'vanilla-latte'
  when 'boho-sunset' then 'desert-boho'
  when 'dark-academia' then 'academia'
  else theme end;

alter table public.style_profiles add constraint style_profiles_theme_check check (theme in (
  'pink-pop','coquette','vanilla-latte','riviera','y2k',
  'quiet-luxury','street','tailored','trail',
  'mono','desert-boho','academia'));
alter table public.style_profiles alter column theme set default 'vanilla-latte';

alter table public.style_profiles add column if not exists style_for text not null default 'any';
alter table public.style_profiles drop constraint if exists style_profiles_style_for_check;
alter table public.style_profiles add constraint style_profiles_style_for_check
  check (style_for in ('women','men','any'));

-- ------------------------------------------------------------
-- 2. More wardrobe categories (watches, eyewear)
-- ------------------------------------------------------------
alter table public.wardrobe_items drop constraint if exists wardrobe_items_category_check;
alter table public.wardrobe_items add constraint wardrobe_items_category_check check (category in (
  'top','bottom','dress','set','outerwear','ethnic','footwear','bag','jewellery',
  'watch','eyewear','accessory','other'));

-- ------------------------------------------------------------
-- 3. Sections: your own names per day ("Morning", "Pool party", "Baga beach")
-- ------------------------------------------------------------
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  kind text not null default 'time' check (kind in ('time','event','place')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sections_trip_day_idx on public.sections(trip_id, day, position);

drop trigger if exists limit_sections on public.sections;
create trigger limit_sections before insert on public.sections
  for each row execute function public.enforce_row_limit('1500');

alter table public.sections enable row level security;
drop policy if exists "own sections" on public.sections;
create policy "own sections" on public.sections for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = auth.uid()
        and day between t.start_date and t.end_date
    )
  );
revoke all on public.sections from anon;

-- ------------------------------------------------------------
-- 4. Outfits now belong to a section; can be the "final pick"; can be AI-made
-- ------------------------------------------------------------
alter table public.outfits add column if not exists section_id uuid references public.sections(id) on delete cascade;
alter table public.outfits add column if not exists is_pick boolean not null default false;
alter table public.outfits add column if not exists ai_generated boolean not null default false;

-- Move old fixed time slots into sections (only if the old column exists)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'outfits' and column_name = 'slot') then
    insert into public.sections (owner_id, trip_id, day, name, kind, position)
    select distinct o.owner_id, o.trip_id, o.day, initcap(o.slot), 'time',
      case o.slot when 'morning' then 0 when 'afternoon' then 1 when 'evening' then 2 else 3 end
    from public.outfits o
    where o.section_id is null;

    update public.outfits o set section_id = s.id
    from public.sections s
    where o.section_id is null
      and s.trip_id = o.trip_id and s.day = o.day and s.name = initcap(o.slot);
  end if;
end $$;

drop policy if exists "own outfits" on public.outfits;
alter table public.outfits drop column if exists slot;
alter table public.outfits drop column if exists day;
delete from public.outfits where section_id is null;
alter table public.outfits alter column section_id set not null;
create index if not exists outfits_section_idx on public.outfits(section_id);

create policy "own outfits" on public.outfits for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.sections s
      where s.id = section_id and s.owner_id = auth.uid() and s.trip_id = trip_id
    )
  );

-- Check: every table should say true
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
