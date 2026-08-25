-- Add the remaining manually curated products from the first comparison list.
-- The Cañuelas flour candidate was intentionally excluded because the Ta-Ta
-- listing is a different variant. No price rows are inserted here.
do $$
declare
  v_listing record;
  v_category_id uuid;
  v_product_id uuid;
  v_store_id uuid;
begin
  for v_listing in
    select *
    from (
      values
        ('COCA-COLA Zero 3 L', 'COCA-COLA', 3, 'L', 'bebidas', 'disco', 'https://www.disco.com.uy/product/refresco-coca-cola-zero-3-l/590738', 'Refresco COCA COLA Zero 3 L'),
        ('COCA-COLA Zero 3 L', 'COCA-COLA', 3, 'L', 'bebidas', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/coca-cola-zero-3-l.producto?371942,,42', 'COCA-COLA Zero 3 L'),
        ('COCA-COLA Zero 3 L', 'COCA-COLA', 3, 'L', 'bebidas', 'ta-ta', 'https://www.tata.com.uy/coca-cola-zero-azucares-3-l-1000048394/p', 'Coca-Cola Zero Azúcares 3 L'),

        ('Arroz Blanco SAMAN 1 kg', 'SAMAN', 1, 'kg', 'almacen', 'disco', 'https://www.disco.com.uy/product/arroz-blanco-saman-1-kg/523035', 'Arroz blanco SAMAN 1 kg'),
        ('Arroz Blanco SAMAN 1 kg', 'SAMAN', 1, 'kg', 'almacen', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/arroz-blanco-saman-1-kg.producto?3451,,42', 'Arroz Blanco SAMAN 1 Kg'),
        ('Arroz Blanco SAMAN 1 kg', 'SAMAN', 1, 'kg', 'almacen', 'ta-ta', 'https://www.tata.com.uy/arroz-blanco-saman-1-kg/p', 'Arroz Blanco Saman 1 Kg'),

        ('Leche fresca entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-fresca-entera-conaprole-sachet-1-l/240501', 'Leche fresca entera CONAPROLE 1 L'),
        ('Leche fresca entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-conaprole-fresca-entera-sachet-1-l.producto?1531,,42', 'Leche CONAPROLE Fresca Entera Sachet 1 L'),
        ('Leche fresca entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-fresca-entera-conaprole-sachet-1-l/p', 'Leche Fresca Entera Conaprole Sachet 1 L'),

        ('Leche fresca descremada CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-fresca-conaprole-descremada-1-l/240510', 'Leche fresca CONAPROLE descremada 1 L'),
        ('Leche fresca descremada CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-conaprole-fresca-descremada-sachet-1-l.producto?23152,,42', 'Leche CONAPROLE Fresca Descremada Sachet 1 L'),
        ('Leche fresca descremada CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-fresca-descremada-conaprole-sachet-1-l/p', 'Leche Fresca Descremada Conaprole Sachet 1 L'),

        ('Leche ultra entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-ultra-entera-conaprole-sachet-1-l/240517', 'Leche ultra CONAPROLE entera 1 L'),
        ('Leche ultra entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-entera-conaprole-ultrapasteurizada-sachet-1-l.producto?5739,,42', 'Leche Entera CONAPROLE Ultrapasteurizada Sachet 1 L'),
        ('Leche ultra entera CONAPROLE sachet 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-ultrapasteurizada-entera-conaprole-sachet-1-l/p', 'Leche Ultrapasteurizada Entera Conaprole Sachet 1 L'),

        ('Leche ultra descremada CONAPROLE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-ultra-descremada-conaprole-1-l/240518', 'Leche ultra descremada CONAPROLE 1 L'),
        ('Leche ultra descremada CONAPROLE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-conaprole-ultrapasteurizada-descremada-sachet-1-l.producto?5740,,42', 'Leche CONAPROLE Ultrapasteurizada Descremada Sachet 1 L'),
        ('Leche ultra descremada CONAPROLE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-ultra-descremada-conaprole-1-l/p', 'Leche Ultra Descremada Conaprole 1 L'),

        ('Leche chocolatada LACTOLATE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-chocolatada-lactolate-conaprole-1-l/241895', 'Leche chocolatada LACTOLATE 1 L'),
        ('Leche chocolatada LACTOLATE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-chocolatada-lactolate-conaprole-1-l.producto?414,,42', 'Leche Chocolatada Lactolate CONAPROLE 1 L'),
        ('Leche chocolatada LACTOLATE 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-chocolatada-conaprole-lactolate-sachet-1-l-1000047775/p', 'Leche Chocolatada Conaprole Lactolate Sachet 1 L'),

        ('Leche chocolatada COLET dulce de leche 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'disco', 'https://www.disco.com.uy/product/leche-chocolatada-colet-dulce-de-leche-1-l/242725', 'Leche Chocolatada COLET Dulce de Leche 1 L'),
        ('Leche chocolatada COLET dulce de leche 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/leche-colet-sabor-dulce-de-leche-1-l.producto?1605090,,42', 'Leche COLET sabor Dulce de Leche 1 L'),
        ('Leche chocolatada COLET dulce de leche 1 L', 'CONAPROLE', 1, 'L', 'lacteos', 'ta-ta', 'https://www.tata.com.uy/leche-chocolatada-conaprole-colet-dulce-de-leche-1-l-1000584289/p', 'Leche Chocolatada Conaprole Colet Dulce De Leche 1 L')
    ) as listing(name, brand, quantity, unit, category_slug, store_slug, url, external_name)
  loop
    select id
    into v_category_id
    from public.categories
    where slug = v_listing.category_slug;

    if v_category_id is null then
      raise exception 'No existe la categoría %', v_listing.category_slug;
    end if;

    select p.id
    into v_product_id
    from public.products p
    where p.name = v_listing.name
      and p.brand = v_listing.brand
      and p.quantity = v_listing.quantity
      and p.unit = v_listing.unit
    order by p.created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (name, brand, quantity, unit, category_id)
      values (
        v_listing.name,
        v_listing.brand,
        v_listing.quantity,
        v_listing.unit,
        v_category_id
      )
      returning id into v_product_id;
    end if;

    select id
    into v_store_id
    from public.stores
    where slug = v_listing.store_slug;

    if v_store_id is null then
      raise exception 'No existe la cadena %', v_listing.store_slug;
    end if;

    insert into public.store_products (product_id, store_id, url, external_name)
    select v_product_id, v_store_id, v_listing.url, v_listing.external_name
    where not exists (
      select 1
      from public.store_products sp
      where sp.product_id = v_product_id
        and sp.store_id = v_store_id
        and sp.location_id is null
    );
  end loop;
end
$$;
