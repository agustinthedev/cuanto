create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  slug text not null,
  external_id text,
  region text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);

comment on table public.store_locations is 'Optional location context for chains whose online prices depend on branch or delivery area, initially used by Red Express.';

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  location_id uuid references public.store_locations(id) on delete set null,
  url text not null,
  external_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_products_product_store_without_location_idx
  on public.store_products (product_id, store_id)
  where location_id is null;

create unique index if not exists store_products_product_store_location_idx
  on public.store_products (product_id, store_id, location_id)
  where location_id is not null;

create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  store_product_id uuid not null references public.store_products(id) on delete cascade,
  price numeric(12, 2) not null check (price > 0),
  date date not null,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (store_product_id, date)
);

create index if not exists prices_product_date_idx on public.prices (store_product_id, date desc);
create index if not exists store_products_product_idx on public.store_products (product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists store_products_set_updated_at on public.store_products;
create trigger store_products_set_updated_at
before update on public.store_products
for each row execute function public.set_updated_at();

create or replace view public.latest_store_product_prices as
select distinct on (sp.id)
  sp.id as store_product_id,
  sp.product_id,
  sp.store_id,
  s.name as store_name,
  s.slug as store_slug,
  sp.location_id,
  sl.name as location_name,
  sl.external_id as location_external_id,
  sp.url,
  p.price,
  p.date,
  p.scraped_at
from public.store_products sp
join public.stores s on s.id = sp.store_id
left join public.store_locations sl on sl.id = sp.location_id
join public.prices p on p.store_product_id = sp.id
where sp.active = true
order by sp.id, p.date desc, p.scraped_at desc;

create or replace view public.product_daily_average_prices as
select
  sp.product_id,
  p.date,
  round(avg(p.price), 2) as average_price,
  count(*)::integer as observation_count
from public.store_products sp
join public.prices p on p.store_product_id = sp.id
where sp.active = true
group by sp.product_id, p.date
order by p.date;

create or replace view public.product_daily_store_prices as
select
  sp.product_id,
  sp.store_id,
  s.name as store_name,
  s.slug as store_slug,
  p.date,
  round(avg(p.price), 2) as price,
  count(*)::integer as observation_count
from public.store_products sp
join public.stores s on s.id = sp.store_id
join public.prices p on p.store_product_id = sp.id
where sp.active = true
group by sp.product_id, sp.store_id, s.name, s.slug, p.date
order by p.date;

create or replace view public.price_observation_days as
select date, count(*)::integer as observation_count
from public.prices
group by date
order by date;

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_locations enable row level security;
alter table public.store_products enable row level security;
alter table public.prices enable row level security;

drop policy if exists "Public can read stores" on public.stores;
create policy "Public can read stores" on public.stores for select using (true);
drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories for select using (true);
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products for select using (true);
drop policy if exists "Public can read store locations" on public.store_locations;
create policy "Public can read store locations" on public.store_locations for select using (active = true);
drop policy if exists "Public can read store products" on public.store_products;
create policy "Public can read store products" on public.store_products for select using (active = true);
drop policy if exists "Public can read prices" on public.prices;
create policy "Public can read prices" on public.prices for select using (true);

revoke all on public.stores from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.store_locations from anon, authenticated;
revoke all on public.store_products from anon, authenticated;
revoke all on public.prices from anon, authenticated;
grant select on public.stores, public.categories, public.products, public.store_locations, public.store_products, public.prices to anon, authenticated;
grant select on public.latest_store_product_prices, public.product_daily_average_prices, public.product_daily_store_prices to anon, authenticated;
grant select on public.price_observation_days to anon, authenticated;
