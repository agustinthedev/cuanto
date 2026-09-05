insert into public.stores (name, slug)
values
  ('Disco', 'disco'),
  ('Tienda Inglesa', 'tienda-inglesa'),
  ('Ta-Ta', 'ta-ta'),
  ('El Dorado', 'el-dorado')
on conflict (slug) do update set name = excluded.name;

insert into public.categories (name, slug)
values
  ('Bebidas', 'bebidas'),
  ('Lácteos', 'lacteos'),
  ('Carnes', 'carnes'),
  ('Limpieza', 'limpieza'),
  ('Almacén', 'almacen')
on conflict (slug) do update set name = excluded.name;

-- Products and store-product URLs are intentionally not seeded with fake data.
-- Add them through Supabase Table Editor after applying the migration.
