-- RLS and table checks evaluate this function for public inserts. Keep the
-- function callable by the roles that are allowed to submit analytics events.
grant execute on function public.is_valid_analytics_event(text, text, text, jsonb)
  to anon, authenticated;
