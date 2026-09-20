-- Let the direct admin product creation flow persist the product brand.
-- Keep the existing RPC for callers that do not provide a brand and expose a
-- separate signature so PostgREST does not have to resolve overloaded RPCs.
create or replace function public.create_product_with_links_and_brand(
  p_name text,
  p_brand text,
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
  v_brand text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_brand := nullif(btrim(coalesce(p_brand, '')), '');
  if v_brand is not null and char_length(v_brand) > 120 then
    raise exception 'The product brand must contain at most 120 characters';
  end if;

  v_product_id := public.create_product_with_links(
    p_name,
    p_category_id,
    p_quantity,
    p_unit,
    p_links,
    p_tag_ids
  );

  if v_brand is not null then
    update public.products
    set brand = v_brand
    where id = v_product_id;
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.create_product_with_links_and_brand(text, text, uuid, numeric, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.create_product_with_links_and_brand(text, text, uuid, numeric, text, jsonb, uuid[]) to authenticated;
