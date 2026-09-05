-- Aggregate active chains in the database so the frontend is not subject to
-- the default Supabase/PostgREST response row limit.
create or replace function public.count_active_stores()
returns integer
language sql
stable
set search_path = public
as $$
  select count(distinct store_id)::integer
  from public.store_products
  where active = true;
$$;

revoke all on function public.count_active_stores() from public, anon, authenticated;
grant execute on function public.count_active_stores() to anon, authenticated;
