-- Keep chains available for future administration while allowing the product
-- forms to hide chains that are temporarily out of service.
alter table public.stores
  add column if not exists active boolean not null default true;

create index if not exists stores_active_idx on public.stores (active);

update public.stores
set active = (slug <> 'tienda-inglesa');
