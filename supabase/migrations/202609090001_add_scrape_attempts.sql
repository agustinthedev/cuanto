create table if not exists public.scrape_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  product_id uuid not null references public.products(id) on delete cascade,
  store_product_id uuid not null references public.store_products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  attempted_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed')),
  source_type text check (source_type is null or source_type in ('html', 'json')),
  source_url text not null,
  response_url text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  content_type text,
  response_size_bytes bigint check (response_size_bytes is null or response_size_bytes >= 0),
  response_sha256 text check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),
  raw_object_key text,
  price numeric(12, 2) check (price is null or price > 0),
  selected_path text,
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array'),
  error text
);

comment on table public.scrape_attempts is 'One provenance record per store product scrape attempt, including attempts that do not produce a price.';
comment on column public.scrape_attempts.raw_object_key is 'R2 object key for the gzip-compressed original product response, when available.';

create index if not exists scrape_attempts_store_product_attempted_idx
  on public.scrape_attempts (store_product_id, attempted_at desc);
create index if not exists scrape_attempts_run_attempted_idx
  on public.scrape_attempts (run_id, attempted_at desc);
create index if not exists scrape_attempts_attempted_idx
  on public.scrape_attempts (attempted_at desc);

alter table public.scrape_attempts enable row level security;
revoke all on public.scrape_attempts from anon, authenticated;
