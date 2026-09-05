-- Bound the fields that anonymous clients can write directly. The original
-- validator only covered the structured event fields, while referrers and
-- unknown metadata keys were still unbounded.
create or replace function public.is_valid_analytics_event(
  p_event_type text,
  p_path text,
  p_referrer_type text,
  p_metadata jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result_count integer;
  v_product_id text;
begin
  if p_event_type not in ('page_view', 'search')
     or p_path is null
     or octet_length(btrim(p_path)) not between 1 and 2048
     or p_referrer_type not in ('direct', 'external', 'internal')
     or p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object'
     or pg_column_size(p_metadata) > 65536 then
    return false;
  end if;

  if p_event_type = 'page_view' then
    if exists (
      select 1
      from jsonb_object_keys(p_metadata) as keys(key_name)
      where key_name not in ('page_type', 'product_id', 'referrer_product_id')
    ) then
      return false;
    end if;

    if coalesce(jsonb_typeof(p_metadata->'page_type'), '') <> 'string'
       or p_metadata->>'page_type' not in ('home', 'search', 'product', 'other') then
      return false;
    end if;

    if p_metadata ? 'product_id'
       and (coalesce(jsonb_typeof(p_metadata->'product_id'), '') <> 'string'
         or coalesce(p_metadata->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      return false;
    end if;

    if p_metadata ? 'referrer_product_id'
       and (coalesce(jsonb_typeof(p_metadata->'referrer_product_id'), '') <> 'string'
         or coalesce(p_metadata->>'referrer_product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      return false;
    end if;

    return true;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_metadata) as keys(key_name)
    where key_name not in ('query', 'normalized_query', 'result_count', 'result_product_ids')
  ) then
    return false;
  end if;

  if coalesce(jsonb_typeof(p_metadata->'query'), '') <> 'string'
     or coalesce(jsonb_typeof(p_metadata->'normalized_query'), '') <> 'string'
     or octet_length(btrim(coalesce(p_metadata->>'query', ''))) not between 1 and 500
     or octet_length(btrim(coalesce(p_metadata->>'normalized_query', ''))) not between 1 and 500
     or coalesce(jsonb_typeof(p_metadata->'result_count'), '') <> 'number'
     or coalesce(p_metadata->>'result_count', '') !~ '^[0-9]+$'
     or coalesce(jsonb_typeof(p_metadata->'result_product_ids'), '') <> 'array' then
    return false;
  end if;

  v_result_count := (p_metadata->>'result_count')::integer;
  if v_result_count < 0 or v_result_count > 100000 then
    return false;
  end if;

  if jsonb_array_length(p_metadata->'result_product_ids') > 1000
     or exists (
       select 1
       from jsonb_array_elements(p_metadata->'result_product_ids') as items(item)
       where jsonb_typeof(item) <> 'string'
     ) then
    return false;
  end if;

  for v_product_id in
    select value
    from jsonb_array_elements_text(p_metadata->'result_product_ids')
  loop
    if v_product_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

alter table public.analytics_events
  add constraint analytics_events_path_bytes_check
    check (octet_length(path) between 1 and 2048) not valid,
  add constraint analytics_events_referrer_bytes_check
    check (referrer is null or octet_length(referrer) <= 2048) not valid,
  add constraint analytics_events_referrer_path_bytes_check
    check (referrer_path is null or octet_length(referrer_path) <= 2048) not valid,
  add constraint analytics_events_metadata_bytes_check
    check (pg_column_size(metadata) <= 65536) not valid;
