-- Tags are managed by admins and intentionally have no public read access yet.
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index if not exists tags_normalized_name_idx
  on public.tags (lower(btrim(name)));

create table if not exists public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);

create table if not exists public.product_suggestion_tags (
  suggestion_id uuid not null references public.product_suggestions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, tag_id)
);

create index if not exists product_tags_tag_idx on public.product_tags (tag_id);
create index if not exists product_suggestion_tags_tag_idx on public.product_suggestion_tags (tag_id);

alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.product_suggestion_tags enable row level security;

drop policy if exists "Admins can read tags" on public.tags;
create policy "Admins can read tags"
  on public.tags for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read product tags" on public.product_tags;
create policy "Admins can read product tags"
  on public.product_tags for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read suggestion tags" on public.product_suggestion_tags;
create policy "Admins can read suggestion tags"
  on public.product_suggestion_tags for select to authenticated
  using (public.is_admin());

revoke all on public.tags from anon, authenticated;
revoke all on public.product_tags from anon, authenticated;
revoke all on public.product_suggestion_tags from anon, authenticated;
grant select on public.tags to authenticated;
grant select on public.product_tags, public.product_suggestion_tags to authenticated;

create or replace function public.create_tag(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag public.tags;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'The tag name must contain between 1 and 80 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_name)), 0::bigint));

  insert into public.tags (name)
  values (btrim(p_name))
  on conflict ((lower(btrim(name)))) do update set name = public.tags.name
  returning * into v_tag;

  return jsonb_build_object('id', v_tag.id, 'name', v_tag.name);
end;
$$;

revoke all on function public.create_tag(text) from public, anon, authenticated;
grant execute on function public.create_tag(text) to authenticated;

-- Replace the measurement-aware RPC signatures so tag assignment stays in the
-- same transaction as product and suggestion changes.
drop function if exists public.create_product_with_links(text, uuid, numeric, text, jsonb);
drop function if exists public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb);
drop function if exists public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, timestamptz);
drop function if exists public.create_product_with_links(text, uuid, jsonb, uuid[]);
drop function if exists public.update_product_suggestion(uuid, text, uuid, jsonb, uuid[]);
drop function if exists public.approve_product_suggestion(uuid, text, uuid, jsonb, uuid[], timestamptz);
drop function if exists public.approve_product_suggestion(uuid);

create or replace function public.create_product_with_links(
  p_name text,
  p_category_id uuid,
  p_quantity numeric,
  p_unit text,
  p_links jsonb,
  p_tag_ids uuid[] default '{}'::uuid[]
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
  v_quantity numeric;
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

  v_quantity := public.normalize_product_quantity(p_quantity);

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

  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(p_name)) || '|' || p_category_id::text || '|' || v_quantity::text || '|' || v_unit,
      0::bigint
    )
  );

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
    and quantity = v_quantity
    and unit = v_unit
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (btrim(p_name), v_quantity, v_unit, p_category_id)
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

  insert into public.product_tags (product_id, tag_id)
  select v_product_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.store_products
    where product_id = v_product_id
  ) then
    raise exception 'At least one store link is required';
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.create_product_with_links(text, uuid, numeric, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.create_product_with_links(text, uuid, numeric, text, jsonb, uuid[]) to authenticated;

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

  if not exists (select 1 from public.product_suggestions where id = p_suggestion_id and status = 'pending') then
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

  delete from public.product_suggestion_tags
  where suggestion_id = p_suggestion_id;

  insert into public.product_suggestion_tags (suggestion_id, tag_id)
  select p_suggestion_id, selected.tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as selected(tag_id);
end;
$$;

revoke all on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.update_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[]) to authenticated;

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

revoke all on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.approve_product_suggestion(uuid, text, uuid, numeric, text, jsonb, uuid[], timestamptz) to authenticated;
