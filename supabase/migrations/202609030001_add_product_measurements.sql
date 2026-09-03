-- Store the measurement entered in the admin workflow for suggestions and
-- pass it through when a suggestion or a product is published.

alter table public.product_suggestions
  add column if not exists quantity numeric(12, 3) not null default 1,
  add column if not exists unit text not null default 'un';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_unit_allowed'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_unit_allowed
      check (unit in ('kg', 'g', 'L', 'ml', 'un')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_suggestions_quantity_positive'
      and conrelid = 'public.product_suggestions'::regclass
  ) then
    alter table public.product_suggestions
      add constraint product_suggestions_quantity_positive
      check (quantity > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_suggestions_unit_allowed'
      and conrelid = 'public.product_suggestions'::regclass
  ) then
    alter table public.product_suggestions
      add constraint product_suggestions_unit_allowed
      check (unit in ('kg', 'g', 'L', 'ml', 'un')) not valid;
  end if;
end;
$$;

create or replace function public.normalize_product_unit(p_unit text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case lower(btrim(coalesce(p_unit, '')))
    when 'kg' then 'kg'
    when 'g' then 'g'
    when 'l' then 'L'
    when 'ml' then 'ml'
    when 'un' then 'un'
    else null
  end;
$$;

revoke all on function public.normalize_product_unit(text) from public, anon, authenticated;

drop function if exists public.create_product_suggestion(text, uuid, jsonb);
create or replace function public.create_product_suggestion(
  p_title text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion_id uuid;
  v_unit text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0.001 then
    raise exception 'The product quantity must be at least 0.001';
  end if;

  v_unit := public.normalize_product_unit(p_unit);
  if v_unit is null then
    raise exception 'The product unit must be one of kg, g, L, ml, or un';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_links, '[]'::jsonb)) = 0 then
    raise exception 'At least one store link is required';
  end if;

  insert into public.product_suggestions (title, category_id, quantity, unit, created_by)
  values (btrim(p_title), p_category_id, p_quantity, v_unit, auth.uid())
  returning id into v_suggestion_id;

  insert into public.product_suggestion_store_links (suggestion_id, store_id, url)
  select v_suggestion_id, links.store_id, btrim(links.url)
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0;

  if not exists (
    select 1 from public.product_suggestion_store_links
    where suggestion_id = v_suggestion_id
  ) then
    raise exception 'At least one store link is required';
  end if;

  return v_suggestion_id;
end;
$$;

revoke all on function public.create_product_suggestion(text, uuid, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_product_suggestion(text, uuid, numeric, text, jsonb) to authenticated;

drop function if exists public.update_product_suggestion(uuid, text, uuid, jsonb);
create or replace function public.update_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_count integer;
  v_unit text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if not exists (select 1 from public.product_suggestions where id = p_suggestion_id) then
    raise exception 'The product suggestion does not exist';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0.001 then
    raise exception 'The product quantity must be at least 0.001';
  end if;

  v_unit := public.normalize_product_unit(p_unit);
  if v_unit is null then
    raise exception 'The product unit must be one of kg, g, L, ml, or un';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Store links must be an array';
  end if;

  update public.product_suggestions
  set title = btrim(p_title), category_id = p_category_id, quantity = p_quantity, unit = v_unit
  where id = p_suggestion_id;

  delete from public.product_suggestion_store_links
  where suggestion_id = p_suggestion_id;

  insert into public.product_suggestion_store_links (suggestion_id, store_id, url)
  select p_suggestion_id, links.store_id, btrim(links.url)
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0;

  get diagnostics v_link_count = row_count;
  if v_link_count = 0 then
    raise exception 'At least one store link is required';
  end if;
end;
$$;

revoke all on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb) to authenticated;

drop function if exists public.approve_product_suggestion(uuid);
drop function if exists public.approve_product_suggestion(uuid, text, uuid, jsonb, timestamptz);
create or replace function public.approve_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.product_suggestions%rowtype;
  v_product_id uuid;
  v_link_count integer;
  v_unit text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_suggestion
  from public.product_suggestions
  where id = p_suggestion_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Only pending suggestions can be approved';
  end if;

  if p_expected_updated_at is null or v_suggestion.updated_at <> p_expected_updated_at then
    raise exception 'The suggestion changed after it was loaded. Reload it before approving';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0.001 then
    raise exception 'The product quantity must be at least 0.001';
  end if;

  v_unit := public.normalize_product_unit(p_unit);
  if v_unit is null then
    raise exception 'The product unit must be one of kg, g, L, ml, or un';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Store links must be an array';
  end if;

  -- Save the values from the review form before publishing the suggestion.
  update public.product_suggestions
  set title = btrim(p_title), category_id = p_category_id, quantity = p_quantity, unit = v_unit
  where id = p_suggestion_id;

  delete from public.product_suggestion_store_links
  where suggestion_id = p_suggestion_id;

  insert into public.product_suggestion_store_links (suggestion_id, store_id, url)
  select p_suggestion_id, links.store_id, btrim(links.url)
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0;

  get diagnostics v_link_count = row_count;
  if v_link_count = 0 then
    raise exception 'At least one store link is required before approval';
  end if;

  select * into v_suggestion
  from public.product_suggestions
  where id = p_suggestion_id;

  -- A product presentation is part of its identity: the same name/category
  -- can legitimately exist in different quantities or measurement units.
  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(v_suggestion.title)) || '|' || v_suggestion.category_id::text || '|' || v_suggestion.quantity::text || '|' || v_suggestion.unit,
      0::bigint
    )
  );

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(v_suggestion.title))
    and category_id = v_suggestion.category_id
    and quantity = v_suggestion.quantity
    and unit = v_suggestion.unit
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (v_suggestion.title, v_suggestion.quantity, v_suggestion.unit, v_suggestion.category_id)
    returning id into v_product_id;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select v_product_id, link.store_id, link.url, v_suggestion.title, true
  from public.product_suggestion_store_links link
  where link.suggestion_id = p_suggestion_id
  on conflict (product_id, store_id) where location_id is null
  do update set
    url = excluded.url,
    external_name = excluded.external_name,
    active = true;

  update public.product_suggestions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_suggestion_id;

  return v_product_id;
end;
$$;

revoke all on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, timestamptz) to authenticated;

drop function if exists public.create_product_with_links(text, uuid, jsonb);
create or replace function public.create_product_with_links(
  p_name text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_conflicting_url text;
  v_link_url text;
  v_unit text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception 'The product name must contain between 1 and 200 characters';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0.001 then
    raise exception 'The product quantity must be at least 0.001';
  end if;

  v_unit := public.normalize_product_unit(p_unit);
  if v_unit is null then
    raise exception 'The product unit must be one of kg, g, L, ml, or un';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_links, '[]'::jsonb)) = 0 then
    raise exception 'At least one store link is required';
  end if;

  if not exists (
    select 1
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
  ) then
    raise exception 'At least one store link is required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
      and links.store_id is null
  ) then
    raise exception 'Every non-empty store link must include a store';
  end if;

  if exists (
    select links.store_id
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
    group by links.store_id
    having count(*) > 1
  ) then
    raise exception 'Only one link per store is allowed';
  end if;

  if exists (
    select lower(btrim(links.url))
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
    group by lower(btrim(links.url))
    having count(*) > 1
  ) then
    raise exception 'Each store link must be unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    left join public.stores on stores.id = links.store_id
    where char_length(btrim(coalesce(links.url, ''))) > 0
      and stores.id is null
  ) then
    raise exception 'One of the selected stores does not exist';
  end if;

  -- Serialize requests for the same product presentation before looking it up.
  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(p_name)) || '|' || p_category_id::text || '|' || p_quantity::text || '|' || v_unit,
      0::bigint
    )
  );

  -- Serialize requests that contain the same URL, even when product names differ.
  for v_link_url in
    select distinct lower(btrim(links.url))
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_link_url, 0::bigint));
  end loop;

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(p_name))
    and category_id = p_category_id
    and quantity = p_quantity
    and unit = v_unit
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (btrim(p_name), p_quantity, v_unit, p_category_id)
    returning id into v_product_id;
  end if;

  select btrim(links.url) into v_conflicting_url
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  join public.store_products existing
    on lower(btrim(existing.url)) = lower(btrim(links.url))
   and (existing.product_id <> v_product_id or existing.store_id <> links.store_id)
  where char_length(btrim(coalesce(links.url, ''))) > 0
  order by lower(btrim(links.url))
  limit 1;

  if v_conflicting_url is not null then
    raise exception 'The store link is already assigned to another product or store: %', v_conflicting_url;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select v_product_id, links.store_id, btrim(links.url), btrim(p_name), true
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0
  on conflict (product_id, store_id) where location_id is null
  do update set
    url = excluded.url,
    external_name = excluded.external_name,
    active = true;

  if not exists (
    select 1 from public.store_products
    where product_id = v_product_id
  ) then
    raise exception 'At least one store link is required';
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.create_product_with_links(text, uuid, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_product_with_links(text, uuid, numeric, text, jsonb) to authenticated;
