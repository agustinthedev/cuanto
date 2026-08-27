-- Allow admins to create canonical products directly from the admin panel.
create or replace function public.create_product_with_links(
  p_name text,
  p_category_id uuid,
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
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception 'The product name must contain between 1 and 200 characters';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_links, '[]'::jsonb)) = 0 then
    raise exception 'At least one store link is required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    where links.store_id is null
      or char_length(btrim(coalesce(links.url, ''))) = 0
  ) then
    raise exception 'Every store link must include a store and a URL';
  end if;

  if exists (
    select links.store_id
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    group by links.store_id
    having count(*) > 1
  ) then
    raise exception 'Only one link per store is allowed';
  end if;

  if exists (
    select lower(btrim(links.url))
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    group by lower(btrim(links.url))
    having count(*) > 1
  ) then
    raise exception 'Each store link must be unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    left join public.stores on stores.id = links.store_id
    where stores.id is null
  ) then
    raise exception 'One of the selected stores does not exist';
  end if;

  -- Serialize requests for the same product identity before looking it up.
  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(p_name)) || '|' || p_category_id::text,
      0::bigint
    )
  );

  -- Serialize requests that contain the same URL, even when product names differ.
  for v_link_url in
    select distinct lower(btrim(links.url))
    from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_link_url, 0::bigint));
  end loop;

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(p_name))
    and category_id = p_category_id
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (btrim(p_name), 1, 'un', p_category_id)
    returning id into v_product_id;
  end if;

  select btrim(links.url) into v_conflicting_url
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  join public.store_products existing
    on lower(btrim(existing.url)) = lower(btrim(links.url))
   and (existing.product_id <> v_product_id or existing.store_id <> links.store_id)
  order by lower(btrim(links.url))
  limit 1;

  if v_conflicting_url is not null then
    raise exception 'The store link is already assigned to another product or store: %', v_conflicting_url;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select v_product_id, links.store_id, btrim(links.url), btrim(p_name), true
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
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

revoke all on function public.create_product_with_links(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_product_with_links(text, uuid, jsonb) to authenticated;
