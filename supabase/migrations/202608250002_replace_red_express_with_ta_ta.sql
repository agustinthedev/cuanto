-- The first seed used Red Express before its location-dependent pricing was
-- deferred. Rename that seeded chain in place so existing foreign keys remain
-- valid and no product rows are lost.
update public.stores
set name = 'Ta-Ta', slug = 'ta-ta'
where slug = 'red-express';

insert into public.stores (name, slug)
values ('Ta-Ta', 'ta-ta')
on conflict (slug) do update set name = excluded.name;
