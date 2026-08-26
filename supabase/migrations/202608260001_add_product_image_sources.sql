-- Keep the image found on each supermarket listing so one listing can donate
-- its image to the canonical product without duplicating asset metadata.
alter table public.store_products
  add column if not exists image_url text,
  add column if not exists image_fetched_at timestamptz;

alter table public.products
  add column if not exists image_source_store_product_id uuid references public.store_products(id) on delete set null,
  add column if not exists image_updated_at timestamptz;

create index if not exists store_products_image_source_idx
  on public.store_products (product_id, image_fetched_at desc)
  where image_url is not null;
