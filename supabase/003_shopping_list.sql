-- ============================================================
-- Outfit Planner — update 003: shopping list per trip
-- Run once in Supabase → SQL Editor → New query → Run (after 002).
-- ============================================================

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  url text check (url is null or (char_length(url) <= 1000 and url ~* '^https?://')),
  price numeric(10, 2) check (price is null or price >= 0),
  category text check (category is null or char_length(category) <= 20),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'to_buy' check (status in ('to_buy', 'bought', 'in_wardrobe')),
  wardrobe_item_id uuid references public.wardrobe_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shopping_trip_idx on public.shopping_items(trip_id, status);

drop trigger if exists limit_shopping on public.shopping_items;
create trigger limit_shopping before insert on public.shopping_items
  for each row execute function public.enforce_row_limit('1000');

alter table public.shopping_items enable row level security;
drop policy if exists "own shopping" on public.shopping_items;
create policy "own shopping" on public.shopping_items for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
    and (wardrobe_item_id is null or exists (
      select 1 from public.wardrobe_items w where w.id = wardrobe_item_id and w.owner_id = auth.uid()))
  );
revoke all on public.shopping_items from anon;
