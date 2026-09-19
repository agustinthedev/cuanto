-- Aggregate the captured visitor context without exposing individual visitor
-- rows to the admin client.

create or replace function public.get_admin_analytics_context(p_period text default '30d')
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
  v_devices jsonb;
  v_browsers jsonb;
  v_operating_systems jsonb;
  v_locales jsonb;
  v_countries jsonb;
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

  with scoped_visitors as (
    select distinct anon_id
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select coalesce(v.device_type, 'unknown') as value, count(*) as visitors
    from scoped_visitors s
    left join public.analytics_visitors v on v.anon_id = s.anon_id
    group by 1
    order by visitors desc, value
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'visitors', visitors) order by visitors desc, value), '[]'::jsonb)
  into v_devices
  from grouped;

  with scoped_visitors as (
    select distinct anon_id
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select coalesce(v.browser_family, 'unknown') as value, count(*) as visitors
    from scoped_visitors s
    left join public.analytics_visitors v on v.anon_id = s.anon_id
    group by 1
    order by visitors desc, value
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'visitors', visitors) order by visitors desc, value), '[]'::jsonb)
  into v_browsers
  from grouped;

  with scoped_visitors as (
    select distinct anon_id
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select coalesce(v.os_family, 'unknown') as value, count(*) as visitors
    from scoped_visitors s
    left join public.analytics_visitors v on v.anon_id = s.anon_id
    group by 1
    order by visitors desc, value
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'visitors', visitors) order by visitors desc, value), '[]'::jsonb)
  into v_operating_systems
  from grouped;

  with scoped_visitors as (
    select distinct anon_id
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select coalesce(v.locale, 'unknown') as value, count(*) as visitors
    from scoped_visitors s
    left join public.analytics_visitors v on v.anon_id = s.anon_id
    group by 1
    order by visitors desc, value
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'visitors', visitors) order by visitors desc, value), '[]'::jsonb)
  into v_locales
  from grouped;

  with scoped_visitors as (
    select distinct anon_id
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select coalesce(v.country_code, 'unknown') as value, count(*) as visitors
    from scoped_visitors s
    left join public.analytics_visitors v on v.anon_id = s.anon_id
    group by 1
    order by visitors desc, value
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'visitors', visitors) order by visitors desc, value), '[]'::jsonb)
  into v_countries
  from grouped;

  return jsonb_build_object(
    'period', p_period,
    'devices', coalesce(v_devices, '[]'::jsonb),
    'browsers', coalesce(v_browsers, '[]'::jsonb),
    'operating_systems', coalesce(v_operating_systems, '[]'::jsonb),
    'locales', coalesce(v_locales, '[]'::jsonb),
    'countries', coalesce(v_countries, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_analytics_context(text) from public, anon, authenticated;
grant execute on function public.get_admin_analytics_context(text) to authenticated;
