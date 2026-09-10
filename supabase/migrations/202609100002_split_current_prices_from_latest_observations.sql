-- Keep the latest observation available for status display while exposing a
-- freshness-filtered view for current-price consumers.
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

create or replace view public.current_store_product_prices as
select latest.*
from public.latest_store_product_prices latest
where latest.date between
  (now() at time zone 'America/Montevideo')::date - 1
  and (now() at time zone 'America/Montevideo')::date;

create or replace view public.product_search_results as
select
  p.id,
  p.name,
  p.brand,
  p.quantity,
  p.unit,
  p.image_url,
  p.created_at,
  c.id as category_id,
  c.name as category_name,
  c.slug as category_slug,
  concat_ws(' ', p.name, p.brand) as search_text,
  min(l.price) as current_price,
  (array_agg(l.store_name order by l.price asc nulls last, l.store_name asc)
    filter (where l.store_name is not null))[1] as best_store,
  count(distinct l.store_id)::integer as comparison_count
from public.products p
left join public.categories c on c.id = p.category_id
left join public.current_store_product_prices l on l.product_id = p.id
group by p.id, p.name, p.brand, p.quantity, p.unit, p.image_url, p.created_at, c.id, c.name, c.slug;

grant select on public.current_store_product_prices to anon, authenticated;
