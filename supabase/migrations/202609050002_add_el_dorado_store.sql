insert into public.stores (name, slug)
values ('El Dorado', 'el-dorado')
on conflict (slug) do update
set name = excluded.name;
