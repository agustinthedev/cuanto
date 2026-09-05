-- Start the public price history from a clean baseline after the scraper and
-- active store catalog have been stabilized. Keep the catalog, images,
-- suggestions, and anonymous analytics intact.
delete from public.prices;
