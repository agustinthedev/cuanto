-- Keep empty hours, days, and months in the traffic series so the admin
-- chart represents elapsed time instead of only event-bearing buckets.
create or replace function public.get_admin_analytics(p_period text default '30d')
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
  v_summary jsonb;
  v_traffic jsonb;
  v_most_viewed_products jsonb;
  v_top_searches jsonb;
  v_zero_result_searches jsonb;
  v_most_visited_pages jsonb;
  v_top_product_referrals jsonb;
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

  with filtered as (
    select *
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  )
  select jsonb_build_object(
    'unique_visitors', count(distinct anon_id),
    'sessions', count(distinct session_id),
    'page_views', count(*) filter (where event_type = 'page_view'),
    'product_views', count(*) filter (where event_type = 'page_view' and metadata->>'page_type' = 'product'),
    'searches', count(*) filter (where event_type = 'search'),
    'zero_result_searches', count(*) filter (where event_type = 'search' and (metadata->>'result_count')::integer = 0),
    'zero_result_percentage', coalesce(round(
      100.0 * (count(*) filter (where event_type = 'search' and (metadata->>'result_count')::integer = 0))
      / nullif(count(*) filter (where event_type = 'search'), 0),
      1
    ), 0),
    'pages_per_session', coalesce(round(
      (count(*) filter (where event_type = 'page_view'))::numeric
      / nullif(count(distinct session_id), 0),
      2
    ), 0),
    'searches_per_session', coalesce(round(
      (count(*) filter (where event_type = 'search'))::numeric
      / nullif(count(distinct session_id), 0),
      2
    ), 0)
  )
  into v_summary
  from filtered;

  with filtered as (
    select *
    from public.analytics_events
    where (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), bounds as (
    select
      case
        when p_period = 'today' then v_start
        when p_period = 'all' then min(date_trunc('month', created_at at time zone 'America/Montevideo') at time zone 'America/Montevideo')
        else v_start
      end as start_bucket,
      case
        when p_period = 'today' then date_trunc('hour', now() at time zone 'America/Montevideo') at time zone 'America/Montevideo'
        when p_period = 'all' then date_trunc('month', now() at time zone 'America/Montevideo') at time zone 'America/Montevideo'
        else date_trunc('day', now() at time zone 'America/Montevideo') at time zone 'America/Montevideo'
      end as end_bucket,
      case
        when p_period = 'today' then interval '1 hour'
        when p_period = 'all' then interval '1 month'
        else interval '1 day'
      end as bucket_step
    from filtered
  ), series as (
    select generate_series(start_bucket, end_bucket, bucket_step) as bucket
    from bounds
    where start_bucket is not null
  ), buckets as (
    select case
      when p_period = 'today' then date_trunc('hour', created_at at time zone 'America/Montevideo') at time zone 'America/Montevideo'
      when p_period = 'all' then date_trunc('month', created_at at time zone 'America/Montevideo') at time zone 'America/Montevideo'
      else date_trunc('day', created_at at time zone 'America/Montevideo') at time zone 'America/Montevideo'
    end as bucket,
    anon_id,
    session_id,
    event_type
    from filtered
  ), grouped as (
    select bucket,
      count(distinct anon_id) as unique_visitors,
      count(distinct session_id) as sessions,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'search') as searches
    from buckets
    group by bucket
  ), complete as (
    select
      series.bucket,
      coalesce(grouped.unique_visitors, 0) as unique_visitors,
      coalesce(grouped.sessions, 0) as sessions,
      coalesce(grouped.page_views, 0) as page_views,
      coalesce(grouped.searches, 0) as searches
    from series
    left join grouped on grouped.bucket = series.bucket
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', bucket,
    'unique_visitors', unique_visitors,
    'sessions', sessions,
    'page_views', page_views,
    'searches', searches
  ) order by bucket), '[]'::jsonb)
  into v_traffic
  from complete;

  with filtered as (
    select (metadata->>'product_id')::uuid as product_id, anon_id
    from public.analytics_events
    where event_type = 'page_view'
      and metadata->>'page_type' = 'product'
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select product_id, count(*) as views, count(distinct anon_id) as unique_visitors
    from filtered
    group by product_id
    order by views desc, product_id
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', grouped.product_id,
    'product_name', coalesce(products.name, 'Producto eliminado'),
    'views', grouped.views,
    'unique_visitors', grouped.unique_visitors
  ) order by grouped.views desc, coalesce(products.name, 'Producto eliminado')), '[]'::jsonb)
  into v_most_viewed_products
  from grouped
  left join public.products on products.id = grouped.product_id;

  with filtered as (
    select
      coalesce(nullif(metadata->>'normalized_query', ''), lower(regexp_replace(btrim(metadata->>'query'), '\\s+', ' ', 'g'))) as normalized_query,
      btrim(metadata->>'query') as query,
      (metadata->>'result_count')::numeric as result_count,
      anon_id
    from public.analytics_events
    where event_type = 'search'
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select normalized_query, min(query) as query, count(*) as searches,
      round(avg(result_count), 1) as average_result_count,
      count(distinct anon_id) as unique_visitors
    from filtered
    group by normalized_query
    order by searches desc, normalized_query
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'query', grouped.query,
    'searches', grouped.searches,
    'average_result_count', grouped.average_result_count,
    'unique_visitors', grouped.unique_visitors
  ) order by grouped.searches desc, grouped.query), '[]'::jsonb)
  into v_top_searches
  from grouped;

  with filtered as (
    select
      coalesce(nullif(metadata->>'normalized_query', ''), lower(regexp_replace(btrim(metadata->>'query'), '\\s+', ' ', 'g'))) as normalized_query,
      btrim(metadata->>'query') as query,
      created_at
    from public.analytics_events
    where event_type = 'search'
      and (metadata->>'result_count')::integer = 0
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select normalized_query, min(query) as query, count(*) as searches, max(created_at) as last_searched_at
    from filtered
    group by normalized_query
    order by searches desc, last_searched_at desc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'query', grouped.query,
    'searches', grouped.searches,
    'last_searched_at', grouped.last_searched_at
  ) order by grouped.searches desc, grouped.last_searched_at desc), '[]'::jsonb)
  into v_zero_result_searches
  from grouped;

  with filtered as (
    select case
      when path = '/' then 'Homepage'
      when path = '/productos' or metadata->>'page_type' = 'search' then 'Search'
      when metadata->>'page_type' = 'product' then 'Product pages'
      else path
    end as page,
    path
    from public.analytics_events
    where event_type = 'page_view'
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select page, count(*) as views
    from filtered
    group by page
    order by views desc, page
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('page', page, 'views', views) order by grouped.views desc, grouped.page), '[]'::jsonb)
  into v_most_visited_pages
  from grouped;

  with filtered as (
    select
      (metadata->>'referrer_product_id')::uuid as referring_product_id,
      (metadata->>'product_id')::uuid as destination_product_id
    from public.analytics_events
    where event_type = 'page_view'
      and metadata->>'page_type' = 'product'
      and metadata ? 'referrer_product_id'
      and (metadata->>'referrer_product_id') <> (metadata->>'product_id')
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
  ), grouped as (
    select referring_product_id, destination_product_id, count(*) as visits
    from filtered
    group by referring_product_id, destination_product_id
    order by visits desc, referring_product_id, destination_product_id
    limit 20
  ), destination_totals as (
    select (metadata->>'product_id')::uuid as destination_product_id, count(*) as total_views
    from public.analytics_events
    where event_type = 'page_view'
      and metadata->>'page_type' = 'product'
      and (v_start is null or created_at >= v_start)
      and (v_end is null or created_at < v_end)
    group by destination_product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'referring_product_id', grouped.referring_product_id,
    'referring_product_name', coalesce(referring.name, 'Producto eliminado'),
    'destination_product_id', grouped.destination_product_id,
    'destination_product_name', coalesce(destination.name, 'Producto eliminado'),
    'visits', grouped.visits,
    'destination_view_percentage', coalesce(round(100.0 * grouped.visits / nullif(destination_totals.total_views, 0), 1), 0)
  ) order by grouped.visits desc, coalesce(referring.name, 'Producto eliminado'), coalesce(destination.name, 'Producto eliminado')), '[]'::jsonb)
  into v_top_product_referrals
  from grouped
  left join public.products referring on referring.id = grouped.referring_product_id
  left join public.products destination on destination.id = grouped.destination_product_id
  left join destination_totals on destination_totals.destination_product_id = grouped.destination_product_id;

  return jsonb_build_object(
    'period', p_period,
    'summary', coalesce(v_summary, '{}'::jsonb),
    'traffic', coalesce(v_traffic, '[]'::jsonb),
    'most_viewed_products', coalesce(v_most_viewed_products, '[]'::jsonb),
    'top_searches', coalesce(v_top_searches, '[]'::jsonb),
    'zero_result_searches', coalesce(v_zero_result_searches, '[]'::jsonb),
    'most_visited_pages', coalesce(v_most_visited_pages, '[]'::jsonb),
    'top_product_referrals', coalesce(v_top_product_referrals, '[]'::jsonb)
  );
end;
$$;
