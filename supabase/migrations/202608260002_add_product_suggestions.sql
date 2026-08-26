-- Admin-only product review workflow.
-- Passwords stay in Supabase Auth; this migration stores only the allow-list
-- of Auth user ids that may access the review panel.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.product_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category_id uuid not null references public.categories(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_suggestion_store_links (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.product_suggestions(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggestion_id, store_id)
);

create index if not exists product_suggestions_status_idx
  on public.product_suggestions (status, created_at desc);
create index if not exists product_suggestion_links_suggestion_idx
  on public.product_suggestion_store_links (suggestion_id);

drop trigger if exists product_suggestions_set_updated_at on public.product_suggestions;
create trigger product_suggestions_set_updated_at
before update on public.product_suggestions
for each row execute function public.set_updated_at();

drop trigger if exists product_suggestion_links_set_updated_at on public.product_suggestion_store_links;
create trigger product_suggestion_links_set_updated_at
before update on public.product_suggestion_store_links
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.product_suggestions enable row level security;
alter table public.product_suggestion_store_links enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can read product suggestions" on public.product_suggestions;
create policy "Admins can read product suggestions"
  on public.product_suggestions for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can create product suggestions" on public.product_suggestions;
create policy "Admins can create product suggestions"
  on public.product_suggestions for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Admins can edit product suggestions" on public.product_suggestions;
create policy "Admins can edit product suggestions"
  on public.product_suggestions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read suggestion links" on public.product_suggestion_store_links;
create policy "Admins can read suggestion links"
  on public.product_suggestion_store_links for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can create suggestion links" on public.product_suggestion_store_links;
create policy "Admins can create suggestion links"
  on public.product_suggestion_store_links for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can edit suggestion links" on public.product_suggestion_store_links;
create policy "Admins can edit suggestion links"
  on public.product_suggestion_store_links for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.admin_users from anon, authenticated;
revoke all on public.product_suggestions from anon, authenticated;
revoke all on public.product_suggestion_store_links from anon, authenticated;
grant select on public.product_suggestions to authenticated;
grant insert (title, category_id) on public.product_suggestions to authenticated;
grant update (title, category_id) on public.product_suggestions to authenticated;
grant select on public.product_suggestion_store_links to authenticated;
grant insert (suggestion_id, store_id, url) on public.product_suggestion_store_links to authenticated;
grant update (url) on public.product_suggestion_store_links to authenticated;

create or replace function public.create_product_suggestion(
  p_title text,
  p_category_id uuid,
  p_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'The product title must contain between 1 and 200 characters';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'The selected category does not exist';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_links, '[]'::jsonb)) = 0 then
    raise exception 'At least one store link is required';
  end if;

  insert into public.product_suggestions (title, category_id, created_by)
  values (btrim(p_title), p_category_id, auth.uid())
  returning id into v_suggestion_id;

  insert into public.product_suggestion_store_links (suggestion_id, store_id, url)
  select v_suggestion_id, links.store_id, btrim(links.url)
  from jsonb_to_recordset(p_links) as links(store_id uuid, url text)
  where char_length(btrim(coalesce(links.url, ''))) > 0;

  if not exists (
    select 1 from public.product_suggestion_store_links
    where suggestion_id = v_suggestion_id
  ) then
    raise exception 'At least one store link is required';
  end if;

  return v_suggestion_id;
end;
$$;

create or replace function public.approve_product_suggestion(p_suggestion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.product_suggestions%rowtype;
  v_product_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_suggestion
  from public.product_suggestions
  where id = p_suggestion_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Only pending suggestions can be approved';
  end if;

  if not exists (
    select 1 from public.product_suggestion_store_links
    where suggestion_id = p_suggestion_id
  ) then
    raise exception 'At least one store link is required before approval';
  end if;

  select id into v_product_id
  from public.products
  where lower(btrim(name)) = lower(btrim(v_suggestion.title))
    and category_id = v_suggestion.category_id
  order by created_at
  limit 1;

  if v_product_id is null then
    insert into public.products (name, quantity, unit, category_id)
    values (v_suggestion.title, 1, 'un', v_suggestion.category_id)
    returning id into v_product_id;
  end if;

  insert into public.store_products (product_id, store_id, url, external_name)
  select v_product_id, link.store_id, link.url, v_suggestion.title
  from public.product_suggestion_store_links link
  where link.suggestion_id = p_suggestion_id
  on conflict do nothing;

  update public.product_suggestions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_suggestion_id;

  return v_product_id;
end;
$$;

create or replace function public.reject_product_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.product_suggestions
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_suggestion_id and status = 'pending';

  if not found then
    raise exception 'Only pending suggestions can be rejected';
  end if;
end;
$$;

revoke all on function public.create_product_suggestion(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.approve_product_suggestion(uuid) from public, anon, authenticated;
revoke all on function public.reject_product_suggestion(uuid) from public, anon, authenticated;
grant execute on function public.create_product_suggestion(text, uuid, jsonb) to authenticated;
grant execute on function public.approve_product_suggestion(uuid) to authenticated;
grant execute on function public.reject_product_suggestion(uuid) to authenticated;
