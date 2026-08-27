-- Keep edits to a suggestion and its chain links atomic as well.
create or replace function public.update_product_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_category_id uuid,
  p_links jsonb
)
returns void
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

  if not exists (select 1 from public.product_suggestions where id = p_suggestion_id) then
    raise exception 'The product suggestion does not exist';
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
    raise exception 'At least one store link is required';
  end if;
end;
$$;

revoke insert, update on public.product_suggestions from authenticated;
revoke insert, update on public.product_suggestion_store_links from authenticated;
revoke all on function public.update_product_suggestion(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_product_suggestion(uuid, text, uuid, jsonb) to authenticated;
