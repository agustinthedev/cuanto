-- Keep the generic product editor from creating chain-wide links for location-scoped products.
create or replace function public.update_product(
  p_product_id uuid,
  p_name text,
  p_brand text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb,
  p_tag_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_conflicting_url text;
  v_link_url text;
  v_quantity numeric;
  v_unit text;
  v_brand text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select id into v_product_id
  from public.products
  where id = p_product_id
  for update;

  if v_product_id is null then
    raise exception 'The product does not exist';
  end if;

  if exists (
    select 1
    from public.store_products
    where product_id = p_product_id
      and active = true
      and location_id is not null
  ) then
    raise exception 'Products with location-specific store links cannot be edited from this catalog';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception 'The product name must contain between 1 and 200 characters';
  end if;

  v_brand := nullif(btrim(coalesce(p_brand, '')), '');
  if v_brand is not null and char_length(v_brand) > 120 then
    raise exception 'The product brand must contain at most 120 characters';
  end if;

  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity < 0.001 then
    raise exception 'The product quantity must be at least 0.001';
  end if;

  v_quantity := public.normalize_product_quantity(p_quantity);
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

  if exists (
    select tag_id
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id)
    group by tag_id
    having count(*) > 1
  ) then
    raise exception 'Each tag can only be selected once';
  end if;

  if exists (
    select selected.tag_id
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id)
    left join public.tags on tags.id = selected.tag_id
    where tags.id is null
  ) then
    raise exception 'One of the selected tags does not exist';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('product:' || p_product_id::text, 0::bigint));
  for v_link_url in
    select distinct lower(btrim(links.url))
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where char_length(btrim(coalesce(links.url, ''))) > 0
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_link_url, 0::bigint));
  end loop;

  select btrim(links.url) into v_conflicting_url
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  join public.store_products existing
    on lower(btrim(existing.url)) = lower(btrim(links.url))
   and (existing.product_id <> p_product_id or existing.store_id <> links.store_id)
  where char_length(btrim(coalesce(links.url, ''))) > 0
  order by lower(btrim(links.url))
  limit 1;

  if v_conflicting_url is not null then
    raise exception 'The store link is already assigned to another product or store: %', v_conflicting_url;
  end if;

  update public.products
  set name = btrim(p_name),
      brand = v_brand,
      category_id = p_category_id,
      quantity = v_quantity,
      unit = v_unit
  where id = p_product_id;

  -- Keep historical prices intact when a link is removed from the catalog.
  update public.store_products sp
  set active = false
  where sp.product_id = p_product_id
    and sp.location_id is null
    and not exists (
      select 1
      from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
      where links.store_id = sp.store_id
        and char_length(btrim(coalesce(links.url, ''))) > 0
    );

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select p_product_id, links.store_id, btrim(links.url), btrim(p_name), true
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0
  on conflict (product_id, store_id) where location_id is null
  do update set
    url = excluded.url,
    external_name = excluded.external_name,
    active = true;

  delete from public.product_tags
  where product_id = p_product_id;

  insert into public.product_tags (product_id, tag_id)
  select p_product_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id);
end;
$$;

revoke all on function public.update_product(uuid, text, text, uuid, numeric, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.update_product(uuid, text, text, uuid, numeric, text, jsonb, uuid[]) to authenticated;
