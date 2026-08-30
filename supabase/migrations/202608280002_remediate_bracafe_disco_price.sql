-- The Disco scraper previously concatenated the promotional price and its
-- discount percentage for this listing, recording 19720 instead of 246.
do $$
declare
  v_updated integer;
begin
  update public.prices p
  set price = 246.00
  from public.store_products sp
  join public.products pr on pr.id = sp.product_id
  join public.stores s on s.id = sp.store_id
  where p.store_product_id = sp.id
    and pr.name = 'Café BRACAFÉ pack ahorro 100 g'
    and s.slug = 'disco'
    and sp.url = 'https://www.disco.com.uy/product/cafe-bracafe-pack-ahorro-100-g/602401'
    and p.date = date '2026-08-28'
    and p.price = 19720.00;

  get diagnostics v_updated = row_count;

  -- This is a production-only backfill. Other environments may not have the
  -- manually created listing or its observation, so absence is a no-op. Keep
  -- failing when a matching observation exists with an unexpected value.
  if v_updated = 0 and exists (
    select 1
    from public.prices p
    join public.store_products sp on sp.id = p.store_product_id
    join public.products pr on pr.id = sp.product_id
    join public.stores s on s.id = sp.store_id
    where pr.name = 'Café BRACAFÉ pack ahorro 100 g'
      and s.slug = 'disco'
      and sp.url = 'https://www.disco.com.uy/product/cafe-bracafe-pack-ahorro-100-g/602401'
      and p.date = date '2026-08-28'
      and p.price <> 246.00
  ) then
    raise exception 'El precio existente de Café BRACAFÉ en Disco no coincide con el valor esperado';
  end if;

  if v_updated > 1 then
    raise exception 'Se encontraron demasiados precios erróneos para Café BRACAFÉ en Disco: %', v_updated;
  end if;
end;
$$;
