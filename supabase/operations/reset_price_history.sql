-- One-time manual operation. Do not add this file to the migration sequence.
-- Before running it, take a backup/export of public.prices and confirm that
-- the intended Supabase project is the target.
delete from public.prices;
