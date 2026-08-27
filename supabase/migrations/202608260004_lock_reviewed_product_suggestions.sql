-- Reviewed suggestions are historical records; editing them would diverge from
-- the canonical product created at approval time.
create or replace function public.prevent_reviewed_product_suggestion_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' then
    raise exception 'Reviewed product suggestions cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists product_suggestions_prevent_reviewed_edit on public.product_suggestions;
create trigger product_suggestions_prevent_reviewed_edit
before update on public.product_suggestions
for each row execute function public.prevent_reviewed_product_suggestion_edit();
