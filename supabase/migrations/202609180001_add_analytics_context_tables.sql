-- Keep relatively stable anonymous visitor context separate from the event
-- stream. Values are pseudonymous and remain admin-readable only.

create table if not exists public.analytics_visitors (
  anon_id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_landing_path text,
  first_referrer text,
  locale text,
  timezone text,
  browser_family text,
  browser_version text,
  os_family text,
  os_version text,
  device_type text,
  viewport_width integer,
  viewport_height integer,
  country_code text,
  constraint analytics_visitors_landing_path_check check (
    first_landing_path is null or octet_length(first_landing_path) between 1 and 2048
  ),
  constraint analytics_visitors_referrer_check check (
    first_referrer is null or octet_length(first_referrer) <= 2048
  ),
  constraint analytics_visitors_locale_check check (
    locale is null or octet_length(locale) between 1 and 64
  ),
  constraint analytics_visitors_timezone_check check (
    timezone is null or octet_length(timezone) between 1 and 128
  ),
  constraint analytics_visitors_browser_family_check check (
    browser_family is null or octet_length(browser_family) between 1 and 64
  ),
  constraint analytics_visitors_browser_version_check check (
    browser_version is null or octet_length(browser_version) between 1 and 64
  ),
  constraint analytics_visitors_os_family_check check (
    os_family is null or octet_length(os_family) between 1 and 64
  ),
  constraint analytics_visitors_os_version_check check (
    os_version is null or octet_length(os_version) between 1 and 64
  ),
  constraint analytics_visitors_device_type_check check (
    device_type is null or device_type in ('desktop', 'mobile', 'tablet', 'bot', 'unknown')
  ),
  constraint analytics_visitors_viewport_width_check check (
    viewport_width is null or viewport_width between 0 and 10000
  ),
  constraint analytics_visitors_viewport_height_check check (
    viewport_height is null or viewport_height between 0 and 10000
  ),
  constraint analytics_visitors_country_code_check check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  )
);

create index if not exists analytics_visitors_last_seen_at_idx
  on public.analytics_visitors (last_seen_at desc);
create index if not exists analytics_visitors_country_code_idx
  on public.analytics_visitors (country_code)
  where country_code is not null;
create index if not exists analytics_visitors_device_type_idx
  on public.analytics_visitors (device_type)
  where device_type is not null;

create table if not exists public.analytics_sessions (
  session_id uuid primary key,
  anon_id uuid not null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  landing_path text,
  entry_referrer text,
  exit_path text,
  event_count integer not null default 0,
  page_view_count integer not null default 0,
  search_count integer not null default 0,
  constraint analytics_sessions_landing_path_check check (
    landing_path is null or octet_length(landing_path) between 1 and 2048
  ),
  constraint analytics_sessions_entry_referrer_check check (
    entry_referrer is null or octet_length(entry_referrer) <= 2048
  ),
  constraint analytics_sessions_exit_path_check check (
    exit_path is null or octet_length(exit_path) between 1 and 2048
  ),
  constraint analytics_sessions_event_count_check check (event_count >= 0),
  constraint analytics_sessions_page_view_count_check check (page_view_count >= 0),
  constraint analytics_sessions_search_count_check check (search_count >= 0)
);

create index if not exists analytics_sessions_anon_id_started_at_idx
  on public.analytics_sessions (anon_id, started_at desc);
create index if not exists analytics_sessions_last_activity_at_idx
  on public.analytics_sessions (last_activity_at desc);

alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;

revoke all on public.analytics_visitors from anon, authenticated;
revoke all on public.analytics_sessions from anon, authenticated;

drop policy if exists "Admins can read analytics visitors" on public.analytics_visitors;
create policy "Admins can read analytics visitors"
  on public.analytics_visitors
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read analytics sessions" on public.analytics_sessions;
create policy "Admins can read analytics sessions"
  on public.analytics_sessions
  for select
  to authenticated
  using (public.is_admin());

grant select on public.analytics_visitors to authenticated;
grant select on public.analytics_sessions to authenticated;
