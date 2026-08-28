-- Approving a suggestion must publish the values currently being edited in the
-- review form, including links that were added immediately before approval.
-- Keep the draft update and canonical product publication in one transaction.
drop function if exists public.approve_product_suggestion(uuid);

create or replace function public.approve_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_category_id uuid,
  p_links jsonb
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

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Store links must be an array';
  end if;

  -- Save the values from the review form before publishing the suggestion.
  update public.product_suggestions
  set title = btrim(p_title), category_id = p_category_id
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

  -- Serialize the lookup-and-create sequence for the same normalized product
  -- identity without requiring a potentially failing legacy index.
  perform pg_advisory_xact_lock(
    hashtextextended(
      lower(btrim(v_suggestion.title)) || '|' || v_suggestion.category_id::text,
      0::bigint
    )
  );

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(v_suggestion.title))
    and category_id = v_suggestion.category_id
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (v_suggestion.title, 1, 'un', v_suggestion.category_id)
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

revoke all on function public.approve_product_suggestion(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_product_suggestion(uuid, text, uuid, jsonb) to authenticated;
