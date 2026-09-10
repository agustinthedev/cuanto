-- Current prices are only trustworthy when the daily scraper observed them
-- today or yesterday. Historical aggregation views intentionally stay unchanged.
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
  and p.date between
    (now() at time zone 'America/Montevideo')::date - 1
    and (now() at time zone 'America/Montevideo')::date
order by sp.id, p.date desc, p.scraped_at desc;
