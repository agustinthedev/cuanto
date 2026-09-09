-- Capture anonymous product-interest prompts without exposing visitor emails to
-- the public client. The analytics events remain anonymous and admin-readable.

alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check check (
    event_type in (
      'page_view',
      'search',
      'email_capture_shown',
      'email_capture_submitted',
      'email_capture_dismissed'
    )
  );

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
  if p_event_type is null
     or p_event_type not in (
       'page_view',
       'search',
       'email_capture_shown',
       'email_capture_submitted',
       'email_capture_dismissed'
     )
     or p_path is null
     or octet_length(btrim(p_path)) not between 1 and 2048
     or p_referrer_type is null
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

  if p_event_type = 'search' then
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
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_metadata) as keys(key_name)
    where key_name not in ('prompt', 'product_id', 'unique_product_count')
  ) then
    return false;
  end if;

  if coalesce(jsonb_typeof(p_metadata->'prompt'), '') <> 'string'
     or p_metadata->>'prompt' <> 'third_product_page'
     or coalesce(jsonb_typeof(p_metadata->'product_id'), '') <> 'string'
     or coalesce(p_metadata->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if p_event_type = 'email_capture_shown' then
    if coalesce(jsonb_typeof(p_metadata->'unique_product_count'), '') <> 'number'
       or coalesce(p_metadata->>'unique_product_count', '') !~ '^[0-9]+$'
       or (p_metadata->>'unique_product_count')::integer < 3
       or (p_metadata->>'unique_product_count')::integer > 100000 then
      return false;
    end if;
  elsif p_metadata ? 'unique_product_count' then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

alter table public.analytics_events
  validate constraint analytics_events_shape_check;

grant execute on function public.is_valid_analytics_event(text, text, text, jsonb)
  to anon, authenticated;

create table if not exists public.email_capture_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  anon_id uuid not null,
  session_id uuid not null,
  trigger_product_id uuid,
  created_at timestamptz not null default now(),
  constraint email_capture_leads_email_check check (
    octet_length(email) between 3 and 320
    and email = btrim(lower(email))
  )
);

create unique index if not exists email_capture_leads_email_idx
  on public.email_capture_leads (lower(email));
create index if not exists email_capture_leads_created_at_idx
  on public.email_capture_leads (created_at desc);

alter table public.email_capture_leads enable row level security;
revoke all on public.email_capture_leads from anon, authenticated;

drop policy if exists "Admins can read email capture leads" on public.email_capture_leads;
create policy "Admins can read email capture leads"
  on public.email_capture_leads
  for select
  to authenticated
  using (public.is_admin());
grant select on public.email_capture_leads to authenticated;

create or replace function public.capture_email_lead(
  p_email text,
  p_anon_id uuid,
  p_session_id uuid,
  p_trigger_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := btrim(lower(p_email));
  v_id uuid;
begin
  if octet_length(v_email) not between 3 and 320
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into public.email_capture_leads (email, anon_id, session_id, trigger_product_id)
  values (v_email, p_anon_id, p_session_id, p_trigger_product_id)
  on conflict (lower(email)) do nothing;

  select id
  into v_id
  from public.email_capture_leads
  where lower(email) = v_email;

  return v_id;
end;
$$;

revoke all on function public.capture_email_lead(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.capture_email_lead(text, uuid, uuid, uuid) to anon, authenticated;

create or replace function public.get_admin_email_capture_metrics(p_period text default '30d')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_start_date date;
  v_today date := (now() at time zone 'America/Montevideo')::date;
  v_shown integer;
  v_submitted integer;
  v_dismissed integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_period is null or p_period not in ('today', '7d', '30d', 'all') then
    raise exception 'Unsupported analytics period';
  end if;

  if p_period <> 'all' then
    v_start_date := case p_period
      when 'today' then v_today
      when '7d' then v_today - 6
      else v_today - 29
    end;
    v_start := (v_start_date::timestamp at time zone 'America/Montevideo');
    v_end := ((v_today + 1)::timestamp at time zone 'America/Montevideo');
  end if;

  select
    count(*) filter (where event_type = 'email_capture_shown'),
    count(*) filter (where event_type = 'email_capture_submitted'),
    count(*) filter (where event_type = 'email_capture_dismissed')
  into v_shown, v_submitted, v_dismissed
  from public.analytics_events
  where event_type in ('email_capture_shown', 'email_capture_submitted', 'email_capture_dismissed')
    and (v_start is null or created_at >= v_start)
    and (v_end is null or created_at < v_end);

  return jsonb_build_object(
    'shown', coalesce(v_shown, 0),
    'submitted', coalesce(v_submitted, 0),
    'dismissed', coalesce(v_dismissed, 0),
    'conversion_percentage', coalesce(round(100.0 * v_submitted / nullif(v_shown, 0), 1), 0)
  );
end;
$$;

revoke all on function public.get_admin_email_capture_metrics(text) from public, anon, authenticated;
grant execute on function public.get_admin_email_capture_metrics(text) to authenticated;
