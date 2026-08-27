-- Harden approval against stale chain publications. This migration replaces
-- the approval RPC from 202608260002.
create or replace function public.approve_product_suggestion(p_suggestion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.product_suggestions%rowtype;
  v_product_id uuid;
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

  if not exists (
    select 1 from public.product_suggestion_store_links
    where suggestion_id = p_suggestion_id
  ) then
    raise exception 'At least one store link is required before approval';
  end if;

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
