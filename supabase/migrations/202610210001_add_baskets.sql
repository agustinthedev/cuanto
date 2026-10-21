create table if not exists public.baskets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_published boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basket_items (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 99),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (basket_id, product_id),
  unique (basket_id, position)
);

create index if not exists basket_items_product_idx on public.basket_items (product_id);
create index if not exists baskets_published_idx on public.baskets (is_published, created_at desc);

drop trigger if exists baskets_set_updated_at on public.baskets;
create trigger baskets_set_updated_at
before update on public.baskets
for each row execute function public.set_updated_at();

alter table public.baskets enable row level security;
alter table public.basket_items enable row level security;

drop policy if exists "Public can read published baskets" on public.baskets;
create policy "Public can read published baskets"
  on public.baskets for select to anon, authenticated
  using (is_published);

drop policy if exists "Admins can read all baskets" on public.baskets;
create policy "Admins can read all baskets"
  on public.baskets for select to authenticated
  using (public.is_admin());

drop policy if exists "Public can read items from published baskets" on public.basket_items;
create policy "Public can read items from published baskets"
  on public.basket_items for select to anon, authenticated
  using (exists (
    select 1 from public.baskets b
    where b.id = basket_id and b.is_published
  ));

drop policy if exists "Admins can read all basket items" on public.basket_items;
create policy "Admins can read all basket items"
  on public.basket_items for select to authenticated
  using (public.is_admin());

revoke all on public.baskets, public.basket_items from anon, authenticated;
grant select on public.baskets, public.basket_items to anon, authenticated;

create or replace function public.create_basket(p_name text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_base_slug text;
  v_slug text;
  v_suffix integer := 2;
  v_basket_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_position integer := 0;
  v_item_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'The basket name must contain between 1 and 120 characters';
  end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Basket items must be a JSON array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count not between 2 and 50 then
    raise exception 'A basket must contain between 2 and 50 products';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where coalesce(item.value->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(item.value->>'quantity', '') !~ '^[0-9]{1,2}$'
       or case
            when coalesce(item.value->>'quantity', '') ~ '^[0-9]{1,2}$'
              then (item.value->>'quantity')::integer not between 1 and 99
            else true
          end
  ) then
    raise exception 'Each basket item needs a valid product id and a quantity between 1 and 99';
  end if;

  if (
    select count(distinct (item.value->>'product_id')::uuid)
    from jsonb_array_elements(p_items) as item(value)
  ) <> v_item_count then
    raise exception 'A product can only appear once in a basket';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    left join public.products p on p.id = (item.value->>'product_id')::uuid
    where p.id is null
  ) then
    raise exception 'One or more selected products do not exist';
  end if;

  v_base_slug := lower(regexp_replace(
    translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  v_base_slug := trim(both '-' from left(v_base_slug, 90));
  if v_base_slug = '' then
    v_base_slug := 'canasta';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_base_slug, 0::bigint));
  v_slug := v_base_slug;
  while exists (select 1 from public.baskets where slug = v_slug) loop
    v_slug := rtrim(left(v_base_slug, 84), '-') || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.baskets (name, slug, is_published, created_by)
  values (v_name, v_slug, true, auth.uid())
  returning id into v_basket_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    insert into public.basket_items (basket_id, product_id, quantity, position)
    values (v_basket_id, v_product_id, v_quantity, v_position);
    v_position := v_position + 1;
  end loop;

  return jsonb_build_object('id', v_basket_id, 'slug', v_slug, 'name', v_name);
end;
$$;

revoke all on function public.create_basket(text, jsonb) from public, anon, authenticated;
grant execute on function public.create_basket(text, jsonb) to authenticated;

create or replace function public.set_basket_published(p_basket_id uuid, p_is_published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.baskets
  set is_published = p_is_published
  where id = p_basket_id;

  if not found then
    raise exception 'Basket not found';
  end if;
end;
$$;

revoke all on function public.set_basket_published(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_basket_published(uuid, boolean) to authenticated;

create or replace view public.current_basket_store_prices as
with component_prices as (
  select
    b.id as basket_id,
    sp.store_id,
    s.name as store_name,
    s.slug as store_slug,
    bi.id as basket_item_id,
    bi.quantity as basket_quantity,
    round(avg(cp.price), 2) as component_price,
    min(cp.date) as last_observation_date
  from public.baskets b
  join public.basket_items bi on bi.basket_id = b.id
  join public.store_products sp on sp.product_id = bi.product_id and sp.active
  join public.current_store_product_prices cp on cp.store_product_id = sp.id
  join public.stores s on s.id = sp.store_id
  where b.is_published
  group by b.id, sp.store_id, s.name, s.slug, bi.id, bi.quantity
), basket_totals as (
  select
    basket_id,
    store_id,
    store_name,
    store_slug,
    round(sum(component_price * basket_quantity), 2) as price,
    count(*)::integer as item_count,
    min(last_observation_date) as date
  from component_prices
  group by basket_id, store_id, store_name, store_slug
)
select totals.*
from basket_totals totals
where totals.item_count = (
  select count(*)::integer from public.basket_items bi where bi.basket_id = totals.basket_id
);

create or replace view public.basket_daily_store_prices as
with component_prices as (
  select
    b.id as basket_id,
    sp.store_id,
    s.name as store_name,
    s.slug as store_slug,
    p.date,
    bi.id as basket_item_id,
    bi.quantity as basket_quantity,
    round(avg(p.price), 2) as component_price
  from public.baskets b
  join public.basket_items bi on bi.basket_id = b.id
  join public.store_products sp on sp.product_id = bi.product_id and sp.active
  join public.prices p on p.store_product_id = sp.id
  join public.stores s on s.id = sp.store_id
  where b.is_published
  group by b.id, sp.store_id, s.name, s.slug, p.date, bi.id, bi.quantity
), basket_totals as (
  select
    basket_id,
    store_id,
    store_name,
    store_slug,
    date,
    round(sum(component_price * basket_quantity), 2) as price,
    count(*)::integer as observation_count
  from component_prices
  group by basket_id, store_id, store_name, store_slug, date
)
select totals.*
from basket_totals totals
where totals.observation_count = (
  select count(*)::integer from public.basket_items bi where bi.basket_id = totals.basket_id
);

create or replace view public.basket_daily_average_prices as
select
  basket_id,
  date,
  round(avg(price), 2) as average_price,
  count(*)::integer as observation_count
from public.basket_daily_store_prices
group by basket_id, date
order by date;

grant select on public.current_basket_store_prices, public.basket_daily_store_prices, public.basket_daily_average_prices to anon, authenticated;
