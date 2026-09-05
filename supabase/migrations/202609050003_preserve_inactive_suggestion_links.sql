-- Preserve links for inactive stores while replacing the links currently
-- editable in the product suggestion forms.
create or replace function public.replace_active_product_suggestion_links(
  p_suggestion_id uuid,
  p_links jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  delete from public.product_suggestion_store_links existing_link
  using public.stores store
  where existing_link.suggestion_id = p_suggestion_id
    and existing_link.store_id = store.id
    and store.active = true;

  insert into public.product_suggestion_store_links (suggestion_id, store_id, url)
  select p_suggestion_id, links.store_id, btrim(links.url)
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  join public.stores store on store.id = links.store_id and store.active = true
  where char_length(btrim(coalesce(links.url, ''))) > 0;

  get diagnostics v_link_count = row_count;
  return v_link_count;
end;
$$;

revoke all on function public.replace_active_product_suggestion_links(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_active_product_suggestion_links(uuid, jsonb)
  to authenticated;

create or replace function public.update_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
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
  v_link_count integer;
  v_quantity numeric;
  v_unit text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if not exists (
    select 1
    from public.product_suggestions
    where id = p_suggestion_id
      and status = 'pending'
  ) then
    raise exception 'Only pending product suggestions can be edited';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
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

  update public.product_suggestions
  set title = btrim(p_title), category_id = p_category_id, quantity = v_quantity, unit = v_unit
  where id = p_suggestion_id;

  v_link_count := public.replace_active_product_suggestion_links(p_suggestion_id, p_links);

  if v_link_count = 0 then
    raise exception 'At least one store link is required';
  end if;

  delete from public.product_suggestion_tags
  where suggestion_id = p_suggestion_id;

  insert into public.product_suggestion_tags (suggestion_id, tag_id)
  select p_suggestion_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id);
end;
$$;

revoke all on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[])
  to authenticated;

create or replace function public.approve_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb,
  p_tag_ids uuid[] default '{}'::uuid[],
  p_expected_updated_at timestamptz default null
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
  v_quantity numeric;
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

  update public.product_suggestions
  set title = btrim(p_title), category_id = p_category_id, quantity = v_quantity, unit = v_unit
  where id = p_suggestion_id;

  v_link_count := public.replace_active_product_suggestion_links(p_suggestion_id, p_links);

  if v_link_count = 0 then
    raise exception 'At least one store link is required before approval';
  end if;

  delete from public.product_suggestion_tags
  where suggestion_id = p_suggestion_id;

  insert into public.product_suggestion_tags (suggestion_id, tag_id)
  select p_suggestion_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id);

  select * into v_suggestion
  from public.product_suggestions
  where id = p_suggestion_id;

  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(v_suggestion.title)) || '|' || v_suggestion.category_id::text || '|' || v_quantity::text || '|' || v_unit,
      0::bigint
    )
  );

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(v_suggestion.title))
    and category_id = v_suggestion.category_id
    and quantity = v_quantity
    and unit = v_unit
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (v_suggestion.title, v_quantity, v_unit, v_suggestion.category_id)
    returning id into v_product_id;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select v_product_id, link.store_id, link.url, v_suggestion.title, true
  from public.product_suggestion_store_links link
  join public.stores store on store.id = link.store_id and store.active = true
  where link.suggestion_id = p_suggestion_id
  on conflict (product_id, store_id) where location_id is null
  do update set
    url = excluded.url,
    external_name = excluded.external_name,
    active = true;

  insert into public.product_tags (product_id, tag_id)
  select v_product_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id)
  on conflict do nothing;

  update public.product_suggestions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_suggestion_id;

  return v_product_id;
end;
$$;

revoke all on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[], timestamptz)
  from public, anon, authenticated;
grant execute on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[], timestamptz)
  to authenticated;
