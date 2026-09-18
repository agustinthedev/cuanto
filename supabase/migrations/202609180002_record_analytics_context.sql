-- Accept a bounded client context through one RPC so public clients never get
-- direct write access to visitor or session profile tables.

create or replace function public.is_valid_analytics_context(p_context jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_context is null
     or jsonb_typeof(p_context) <> 'object'
     or pg_column_size(p_context) > 8192 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_context) as keys(key_name)
    where key_name not in (
      'locale',
      'timezone',
      'browser_family',
      'browser_version',
      'os_family',
      'os_version',
      'device_type',
      'viewport_width',
      'viewport_height',
      'country_code'
    )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_context) as keys(key_name)
    where key_name in (
      'locale',
      'timezone',
      'browser_family',
      'browser_version',
      'os_family',
      'os_version',
      'device_type',
      'country_code'
    )
      and jsonb_typeof(p_context -> key_name) <> 'string'
  ) then
    return false;
  end if;

  if p_context ? 'locale'
     and octet_length(btrim(p_context->>'locale')) not between 1 and 64 then
    return false;
  end if;

  if p_context ? 'timezone'
     and octet_length(btrim(p_context->>'timezone')) not between 1 and 128 then
    return false;
  end if;

  if p_context ? 'browser_family'
     and octet_length(btrim(p_context->>'browser_family')) not between 1 and 64 then
    return false;
  end if;

  if p_context ? 'browser_version'
     and octet_length(btrim(p_context->>'browser_version')) not between 1 and 64 then
    return false;
  end if;

  if p_context ? 'os_family'
     and octet_length(btrim(p_context->>'os_family')) not between 1 and 64 then
    return false;
  end if;

  if p_context ? 'os_version'
     and octet_length(btrim(p_context->>'os_version')) not between 1 and 64 then
    return false;
  end if;

  if p_context ? 'device_type'
     and p_context->>'device_type' not in ('desktop', 'mobile', 'tablet', 'bot', 'unknown') then
    return false;
  end if;

  if p_context ? 'viewport_width'
     and (
       jsonb_typeof(p_context->'viewport_width') <> 'number'
       or p_context->>'viewport_width' !~ '^[0-9]+$'
       or (p_context->>'viewport_width')::integer not between 0 and 10000
     ) then
    return false;
  end if;

  if p_context ? 'viewport_height'
     and (
       jsonb_typeof(p_context->'viewport_height') <> 'number'
       or p_context->>'viewport_height' !~ '^[0-9]+$'
       or (p_context->>'viewport_height')::integer not between 0 and 10000
     ) then
    return false;
  end if;

  if p_context ? 'country_code'
     and p_context->>'country_code' !~ '^[A-Z]{2}$' then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.record_analytics_context(
  p_anon_id uuid,
  p_session_id uuid,
  p_event_type text,
  p_path text,
  p_referrer text,
  p_context jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_anon_id is null
     or p_session_id is null
     or p_event_type is null
     or p_event_type not in (
       'page_view',
       'search',
       'email_capture_shown',
       'email_capture_submitted',
       'email_capture_dismissed'
     )
     or p_path is null
     or octet_length(btrim(p_path)) not between 1 and 2048
     or (p_referrer is not null and octet_length(p_referrer) > 2048)
     or not public.is_valid_analytics_context(p_context) then
    raise exception 'Invalid analytics context' using errcode = '22023';
  end if;

  insert into public.analytics_visitors (
    anon_id,
    first_landing_path,
    first_referrer,
    locale,
    timezone,
    browser_family,
    browser_version,
    os_family,
    os_version,
    device_type,
    viewport_width,
    viewport_height,
    country_code
  )
  values (
    p_anon_id,
    btrim(p_path),
    p_referrer,
    nullif(btrim(p_context->>'locale'), ''),
    nullif(btrim(p_context->>'timezone'), ''),
    nullif(btrim(p_context->>'browser_family'), ''),
    nullif(btrim(p_context->>'browser_version'), ''),
    nullif(btrim(p_context->>'os_family'), ''),
    nullif(btrim(p_context->>'os_version'), ''),
    nullif(btrim(p_context->>'device_type'), ''),
    nullif(p_context->>'viewport_width', '')::integer,
    nullif(p_context->>'viewport_height', '')::integer,
    nullif(btrim(p_context->>'country_code'), '')
  )
  on conflict (anon_id) do update set
    last_seen_at = now(),
    locale = coalesce(excluded.locale, analytics_visitors.locale),
    timezone = coalesce(excluded.timezone, analytics_visitors.timezone),
    browser_family = coalesce(excluded.browser_family, analytics_visitors.browser_family),
    browser_version = coalesce(excluded.browser_version, analytics_visitors.browser_version),
    os_family = coalesce(excluded.os_family, analytics_visitors.os_family),
    os_version = coalesce(excluded.os_version, analytics_visitors.os_version),
    device_type = coalesce(excluded.device_type, analytics_visitors.device_type),
    viewport_width = coalesce(excluded.viewport_width, analytics_visitors.viewport_width),
    viewport_height = coalesce(excluded.viewport_height, analytics_visitors.viewport_height),
    country_code = coalesce(excluded.country_code, analytics_visitors.country_code);

  if exists (
    select 1
    from public.analytics_sessions
    where session_id = p_session_id
      and anon_id <> p_anon_id
  ) then
    raise exception 'Analytics session does not belong to visitor' using errcode = '22023';
  end if;

  insert into public.analytics_sessions (
    session_id,
    anon_id,
    landing_path,
    entry_referrer,
    exit_path,
    event_count,
    page_view_count,
    search_count
  )
  values (
    p_session_id,
    p_anon_id,
    btrim(p_path),
    p_referrer,
    btrim(p_path),
    1,
    case when p_event_type = 'page_view' then 1 else 0 end,
    case when p_event_type = 'search' then 1 else 0 end
  )
  on conflict (session_id) do update set
    last_activity_at = now(),
    exit_path = excluded.exit_path,
    event_count = analytics_sessions.event_count + 1,
    page_view_count = analytics_sessions.page_view_count + excluded.page_view_count,
    search_count = analytics_sessions.search_count + excluded.search_count;
end;
$$;

revoke all on function public.is_valid_analytics_context(jsonb) from public, anon, authenticated;
revoke all on function public.record_analytics_context(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_analytics_context(uuid, uuid, text, text, text, jsonb) to anon, authenticated;
