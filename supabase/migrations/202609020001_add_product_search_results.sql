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
left join public.latest_store_product_prices l on l.product_id = p.id
group by p.id, p.name, p.brand, p.quantity, p.unit, p.image_url, p.created_at, c.id, c.name, c.slug;

grant select on public.product_search_results to anon, authenticated;
