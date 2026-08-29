-- The initial scrape could not read Tienda Inglesa's canonical origin.
-- Backfill the original Montevideo price exposed by its fallback origin.
do $$
declare
  v_store_product_id uuid;
  v_updated integer;
begin
  select sp.id
  into v_store_product_id
  from public.store_products sp
  join public.products pr on pr.id = sp.product_id
  join public.stores s on s.id = sp.store_id
  where pr.name = 'Café BRACAFÉ pack ahorro 100 g'
    and s.slug = 'tienda-inglesa'
    and sp.url = 'https://www.tiendainglesa.com.uy/supermercado/cafe-bracafe-pack-ahorro-100-g.producto?1584835,,42';

  if v_store_product_id is null then
    raise exception 'No se encontró la publicación de Tienda Inglesa para Café BRACAFÉ';
  end if;

  update public.prices
  set price = 264.00
  where store_product_id = v_store_product_id
    and date = date '2026-08-28';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into public.prices (store_product_id, price, date)
    values (v_store_product_id, 264.00, date '2026-08-28');
  end if;

  if not exists (
    select 1
    from public.prices
    where store_product_id = v_store_product_id
      and date = date '2026-08-28'
      and price = 264.00
  ) then
    raise exception 'No se pudo verificar el precio de Tienda Inglesa para Café BRACAFÉ';
  end if;
end;
$$;
