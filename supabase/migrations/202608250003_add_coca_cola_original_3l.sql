-- First manually curated product and its exact listings.
-- No price rows are inserted here; prices come from the daily Worker.
do $$
declare
  v_category_id uuid;
  v_product_id uuid;
begin
  select id
  into v_category_id
  from public.categories
  where slug = 'bebidas';

  if v_category_id is null then
    raise exception 'No existe la categoría bebidas';
  end if;

  select p.id
  into v_product_id
  from public.products p
  where p.name = 'COCA-COLA Original 3 L'
    and p.brand = 'COCA-COLA'
    and p.quantity = 3
    and p.unit = 'L'
  order by p.created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, brand, quantity, unit, category_id)
    values ('COCA-COLA Original 3 L', 'COCA-COLA', 3, 'L', v_category_id)
    returning id into v_product_id;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name)
  select v_product_id, s.id, listing.url, listing.external_name
  from (
    values
      ('disco', 'https://www.disco.com.uy/product/refresco-coca-cola-3-l/590430', 'Refresco COCA COLA 3 L'),
      ('tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/coca-cola-original-3-l.producto?124536', 'Coca-Cola Original 3 L'),
      ('ta-ta', 'https://www.tata.com.uy/coca-cola-original-3-l-1000049906-2770/p', 'Coca-Cola Original 3 L')
  ) as listing(slug, url, external_name)
  join public.stores s on s.slug = listing.slug
  where not exists (
    select 1
    from public.store_products sp
    where sp.product_id = v_product_id
      and sp.store_id = s.id
      and sp.location_id is null
  );
end
$$;
