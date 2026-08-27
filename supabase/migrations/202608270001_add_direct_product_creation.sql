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

  insert into public.products (name, quantity, unit, category_id)
  values (btrim(p_name), 1, 'un', p_category_id)
  returning id into v_product_id;

  insert into public.store_products (product_id, store_id, url, external_name, active)
  select v_product_id, links.store_id, btrim(links.url), btrim(p_name), true
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0;

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
