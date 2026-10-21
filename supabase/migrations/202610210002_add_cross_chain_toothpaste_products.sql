-- Add verified cross-chain toothpaste products from the supermarket catalog workbook.
-- Prices are intentionally not seeded; the next scheduled scrape will collect them.
-- Multi-packs are modeled using total package contents and remain separate products.

do $$
declare
  v_listing record;
  v_category_id uuid;
  v_product_id uuid;
  v_store_id uuid;
  v_conflicting_url text;
begin
  select id
  into v_category_id
  from public.categories
  where slug = 'limpieza';

  if v_category_id is null then
    raise exception 'No existe la categoría limpieza';
  end if;

  for v_listing in
    select *
    from (
      values
        ('Colgate Total Original Mint 140 g', 'Colgate', 140, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-colgate-total-original-mint-140-g-1000580511/p', 'Crema Dental Colgate Total Original Mint 140 g'),
        ('Colgate Total Original Mint 140 g', 'Colgate', 140, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-original-mint-140-g/621920', 'Crema Dental COLGATE Total Original Mint 140 g'),
        ('Colgate Total Original Mint 140 g', 'Colgate', 140, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-total-original-mint-140gr/p', 'CREMA DENTAL COLGATE TOTAL ORIGINAL MINT 140Gr'),
        ('Colgate Total Original Mint 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-colgate-total-original-mint-90-g-1000580551/p', 'Crema Dental Colgate Total Original Mint 90 g'),
        ('Colgate Total Original Mint 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-original-mint-90-g/621915', 'Crema Dental COLGATE Total Original Mint 90 g'),
        ('Colgate Total Original Mint 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/pasta-dental-colgate-total-original-mint-90-g/p', 'Pasta Dental Colgate Total Original Mint 90 G'),
        ('Colgate Total Original Mint 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-colgate-total-original-mint-90-g.producto?1600930%2C%2C42=', 'Crema Dental COLGATE Total Original Mint 90 g'),
        ('Colgate Total Original Mint x 2 (90 g c/u)', 'Colgate', 180, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-total-original-mint-90-g-2-u-1000592613/p', 'Pack Crema Dental Colgate Total Original Mint 90 G 2 U'),
        ('Colgate Total Original Mint x 2 (90 g c/u)', 'Colgate', 180, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-olgate-total-original-mint-90-g-2-un/622136', 'Pasta Dental OLGATE Total Original Mint 90 g 2 un.'),
        ('Colgate Total Original Mint x 2 (90 g c/u)', 'Colgate', 180, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-colgate-total-original-mint-90-g-2-un..producto?1606602%2C%2C42=', 'Crema Dental COLGATE Total Original Mint 90 g (2 un.)'),
        ('Colgate Total Whitening con Flúor 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-total-whitening-con-fluor-90-g-1000037642/p', 'Pasta Dental Colgate Total Whitening Con Flúor 90 g'),
        ('Colgate Total Whitening con Flúor 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-total-whitening-con-fluor-90-g/964986', 'Pasta Dental COLGATE Total Whitening con Flúor 90 g'),
        ('Colgate Total Whitening con Flúor 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/pasta-dental-colgate-total-whitening-con-fluor-90g/p', 'Pasta Dental Colgate Total Whitening con Flúor 90G'),
        ('Colgate Total Whitening con Flúor 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-total-whitening-con-fluor-90-g.producto?9422%2C%2C42=', 'Pasta Dental COLGATE Total Whitening con Flúor 90 g'),
        ('Colgate Total Whitening con Flúor 180 g', 'Colgate', 180, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-total-whitening-con-fluor-180-g-1000568997/p', 'Pasta De Dientes Colgate Total Whitening Con Flúor 180 g'),
        ('Colgate Total Whitening con Flúor 180 g', 'Colgate', 180, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-whitening-180-g/621858', 'Crema dental COLGATE Total Whitening 180 g'),
        ('Colgate Total Whitening con Flúor 180 g', 'Colgate', 180, 'g', 'el-dorado', 'https://www.eldorado.com.uy/pasta-dental-colgate-total-whitening-con-fluor-180g/p', 'Pasta Dental Colgate Total Whitening con Flúor 180G'),
        ('Colgate Total Whitening con Flúor 180 g', 'Colgate', 180, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-total-whitening-con-fluor-180-g.producto?1599125%2C%2C42=', 'Pasta Dental COLGATE Total Whitening con Flúor 180 g'),
        ('Colgate Triple Acción 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-triple-accion-90-g/p', 'Pasta de Dientes Colgate Triple Acción 90 G'),
        ('Colgate Triple Acción 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-triple-accion-90-g/953475', 'Crema dental COLGATE triple acción 90 g'),
        ('Colgate Triple Acción 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-triple-accion-90gr/p', 'Crema Dental Colgate Triple Accion 90Gr'),
        ('Colgate Triple Acción 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-triple-accion-90-g.producto?5785%2C%2C42=', 'Pasta de Dientes COLGATE Triple Acción 90 g'),
        ('Colgate Triple Acción 180 g', 'Colgate', 180, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-triple-accion-180-g/p', 'Pasta de Dientes Colgate Triple Acción 180 G'),
        ('Colgate Triple Acción 180 g', 'Colgate', 180, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-triple-accion-180-g/953293', 'Crema dental COLGATE Triple Acción 180 g'),
        ('Colgate Triple Acción 180 g', 'Colgate', 180, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-triple-accion-180gr/p', 'Crema Dental Colgate Triple Accion 180Gr'),
        ('Colgate Triple Acción 180 g', 'Colgate', 180, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-triple-accion-180-g.producto?999%2C%2C42=', 'Pasta de Dientes COLGATE Triple Acción 180 g'),
        ('Colgate Triple Acción x 3 (90 g c/u)', 'Colgate', 270, 'g', 'ta-ta', 'https://www.tata.com.uy/pack-pasta-de-dientes-colgate-triple-accion-90-g-3-u/p', 'Pack Pasta De Dientes Colgate Triple Acción 90 G 3 U'),
        ('Colgate Triple Acción x 3 (90 g c/u)', 'Colgate', 270, 'g', 'disco', 'https://www.disco.com.uy/product/pack-x-3-crema-dental-colgate-triple-accion-90-g-con-20-dto/687319', 'Pack x 3 crema dental COLGATE Triple Acción 90 g con 20% dto.'),
        ('Colgate Triple Acción x 3 (90 g c/u)', 'Colgate', 270, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pack-pasta-de-dientes-colgate-triple-accion-3-unidades-x-90-g.producto?255834%2C%2C42=', 'Pack Pasta de Dientes COLGATE Triple Acción 3 Unidades x 90 g'),
        ('Colgate Total Carbón Activado con Flúor 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-de-dientes-colgate-total-carbon-activado-con-fluor-90-g/561389', 'Pasta de Dientes COLGATE Total Carbón Activado con Flúor 90 g'),
        ('Colgate Total Carbón Activado con Flúor 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/pasta-de-dientes-colgate-total-carbon-activado-con-fluor-90g/p', 'Pasta de Dientes Colgate Total Carbón Activado con Flúor 90g'),
        ('Colgate Total Carbón Activado con Flúor 140 g', 'Colgate', 140, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-total-carbon-activado-con-fluor-140-gr/p', 'Pasta de Dientes Colgate Total Carbón Activado con Flúor 140 Gr'),
        ('Colgate Total Carbón Activado con Flúor 140 g', 'Colgate', 140, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-12-carbon-140-g/561394', 'Crema dental COLGATE total 12 carbón 140 g'),
        ('Colgate Total Carbón Activado con Flúor 140 g', 'Colgate', 140, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-total-12-carbon-140-g.producto?1550999%2C%2C42=', 'Pasta de Dientes COLGATE Total 12 Carbón 140 g'),
        ('Colgate Total Encías Saludables con Flúor 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-total-encias-saludables--con-fluor--90g/p', 'Pasta Dental Colgate Total Encías Saludables, con Flúor, 90g'),
        ('Colgate Total Encías Saludables con Flúor 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/pasta-dental-colgate-total-encias-saludables-con-fluor-90g/p', 'Pasta Dental Colgate Total Encías Saludables con Flúor 90g'),
        ('Colgate Total Antisarro con Flúor 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-total-prevencion-antisarro-con-fluor-90-g--1000193163/p', 'Pasta De Dientes Colgate Total Prevención Antisarro Con Flúor 90 g'),
        ('Colgate Total Antisarro con Flúor 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-antisarro-con-fluor-90-g/635210', 'Crema Dental COLGATE Total Antisarro con Flúor 90 g'),
        ('Colgate Total Antisarro con Flúor 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-total-12-anti-sarro-90-g.producto?416525%2C%2C42=', 'Pasta de Dientes COLGATE Total 12 Anti-Sarro 90 g'),
        ('Colgate Total Antisarro con Flúor 100 ml', 'Colgate', 100, 'ml', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-total-antisarro-con-fluor-100-ml-1000278008/p', 'Pasta De Dientes Colgate Total Antisarro, con Flúor, 100mL'),
        ('Colgate Total Antisarro con Flúor 100 ml', 'Colgate', 100, 'ml', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-total-antisarro-con-fluor-100-ml/635278', 'Pasta Dental COLGATE Total Antisarro con Flúor 100 ml'),
        ('Colgate Total Interdental 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-total-interdental-90-g-1000602301/p', 'Pasta De Dientes Colgate Total Interdental 90 g'),
        ('Colgate Total Interdental 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-interdental-90-g/622108', 'Crema Dental COLGATE Total Interdental 90 g'),
        ('Colgate Total Interdental 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-total-limpieza-interdental-90-g.producto?1621330%2C%2C42=', 'Pasta Dental COLGATE Total Limpieza Interdental 90 g'),
        ('Colgate Total Interdental 140 g', 'Colgate', 140, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-total-interdental-140-g-1000602302/p', 'Pasta De Dientes Colgate Total Interdental 140 g'),
        ('Colgate Total Interdental 140 g', 'Colgate', 140, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-total-interdental-140-g/622110', 'Crema Dental COLGATE Total Interdental 140 g'),
        ('Colgate Total Interdental 140 g', 'Colgate', 140, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-total-limpieza-interdental-140-g.producto?1621331%2C%2C42=', 'Pasta Dental COLGATE Total Limpieza Interdental 140 g'),
        ('Colgate Luminous White Color Correct 70 g', 'Colgate', 70, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-luminous-white-color-correct-70-g-1000592682/p', 'Crema Dental Colgate Luminous White Color Correct 70 G'),
        ('Colgate Luminous White Color Correct 70 g', 'Colgate', 70, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-luminous-white-color-correct/622419', 'Crema Dental COLGATE Luminous White Color Correct'),
        ('Colgate Luminous White Color Correct 70 g', 'Colgate', 70, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-luminus-white-color-correct-70gr/p', 'Crema Dental Colgate Luminus White Color Correct 70gr'),
        ('Colgate Luminous White Color Correct 70 g', 'Colgate', 70, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-luminous-white-color-correct-70-g.producto?1606600%2C%2C42=', 'Pasta Dental COLGATE Luminous White Color Correct 70 g'),
        ('Colgate Luminous White Instant 70 g', 'Colgate', 70, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-colgate-luminous-white-instant-70-g/p', 'Crema Dental Colgate Luminous White Instant 70 G'),
        ('Colgate Luminous White Instant 70 g', 'Colgate', 70, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-luminous-white-instant-70-g/622485', 'Pasta Dental COLGATE Luminous White Instant 70 g'),
        ('Colgate Luminous White Brilliant 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-luminous-white-brilliant-90-g/p', 'Pasta De Dientes Colgate Luminous White Brilliant 90 G'),
        ('Colgate Luminous White Brilliant 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-luminous-white-brilliant-90-g/685657', 'Pasta Dental COLGATE Luminous White Brilliant 90 g'),
        ('Colgate Luminous White Brilliant 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/colgate-pasta-de-dientes-luminous-white-brilliant-90-g.producto?225977%2C%2C42=', 'Colgate Pasta de Dientes Luminous White Brilliant 90 g'),
        ('Colgate Luminous Charcoal 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-luminous-charcoal-90-g/p', 'Pasta de Dientes Colgate Luminous Charcoal 90 G'),
        ('Colgate Luminous Charcoal 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-luminous-charcoal-90-g/623964', 'Pasta Dental COLGATE Luminous Charcoal 90 g'),
        ('Colgate Luminous Charcoal 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-luminous-charcoal-90-g.producto?412809%2C%2C42=', 'Pasta de Dientes COLGATE Luminous Charcoal 90 g'),
        ('Colgate Naturals Bicarbonato de Sodio 90 g', 'Colgate', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-dental-colgate-naturals-bicarbonato-de-sodio-90-g-1000599647/p', 'Pasta De Dientes Colgate Naturals Baking Soda 90 g'),
        ('Colgate Naturals Bicarbonato de Sodio 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-naturals-baking-soda-90-g/622037', 'Crema Dental COLGATE Naturals Baking Soda 90 g'),
        ('Colgate Naturals Bicarbonato de Sodio 90 g', 'Colgate', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-naturals-bicarbonato-90gr/p', 'Crema Dental Colgate Naturals Bicarbonato 90gr'),
        ('Colgate Naturals Bicarbonato de Sodio 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-naturals-bicarbonato-de-sodio-90-g.producto?1612085%2C%2C42=', 'Pasta Dental COLGATE Naturals Bicarbonato de Sodio 90 g'),
        ('Colgate Natural Extracts Purificante 90 g', 'Colgate', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-natural-extracts-purificante-90-g/624979', 'Crema Dental COLGATE Natural Extracts Purificante 90 g'),
        ('Colgate Natural Extracts Purificante 90 g', 'Colgate', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-natural-extracts-purificante-90-g.producto?407317%2C%2C42=', 'Pasta de Dientes COLGATE Natural Extracts Purificante 90 g'),
        ('Colgate Kids Teen Titans Go 60 g', 'Colgate', 60, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-kids-teen-titans-go-60-g/p', 'Pasta de Dientes Colgate Kids Teen Titans Go 60 G'),
        ('Colgate Kids Teen Titans Go 60 g', 'Colgate', 60, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-kids-teen-titans-60-g/550971', 'Crema dental COLGATE Kids Teen Titans 60 g'),
        ('Colgate Kids Teen Titans Go 60 g', 'Colgate', 60, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-teen-titans-go-carton-60gr/p', 'Crema Dental Colgate Teen Titans Go Carton 60Gr'),
        ('Colgate Kids Teen Titans Go 60 g', 'Colgate', 60, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-kids-teen-titans-go-60-g.producto?1503459%2C%2C42=', 'Pasta de Dientes COLGATE Kids Teen Titans Go 60 g'),
        ('Oral-B Kids Mickey 50 g', 'Oral-B', 50, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-kids-oral-b-mickey-50-g/p', 'Pasta De Dientes Kids Oral B Mickey 50 G'),
        ('Oral-B Kids Mickey 50 g', 'Oral-B', 50, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-oral-b-kids-mickey-50-g/622482', 'Crema dental Oral-b kids mickey 50 g'),
        ('Oral-B Kids Mickey 50 g', 'Oral-B', 50, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-kids-mickey-oral-b-50-g.producto?375209%2C%2C42=', 'Crema Dental Kids Mickey ORAL-B 50 g'),
        ('Colgate Smiles Minions 100 g', 'Colgate', 100, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-smiles-minions-100-g/p', 'Pasta de Dientes Colgate Smiles Minions 100 G'),
        ('Colgate Smiles Minions 100 g', 'Colgate', 100, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-smiles-minions-6-pm-100-g/683478', 'Crema dental COLGATE Smiles Minions + 6 pm. 100 g'),
        ('Colgate Smiles Barbie 75 ml', 'Colgate', 75, 'ml', 'disco', 'https://www.disco.com.uy/product/pasta-de-dientes-olgate-smiles-barbie-75-ml/956435', 'Pasta de Dientes OLGATE Smiles Barbie 75 ml'),
        ('Colgate Smiles Barbie 75 ml', 'Colgate', 75, 'ml', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-smiles-barbie-75-ml.producto?6122%2C%2C42=', 'Pasta de Dientes COLGATE Smiles Barbie 75 ml'),
        ('Colgate Smiles Harry Potter 75 ml', 'Colgate', 75, 'ml', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-smiles-harry-potter-75-ml/622055', 'Pasta Dental COLGATE Smiles Harry Potter 75 ml'),
        ('Colgate Smiles Harry Potter 75 ml', 'Colgate', 75, 'ml', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-dental-colgate-smiles-harry-potter-75-ml.producto?1612086%2C%2C42=', 'Pasta Dental COLGATE Smiles Harry Potter 75 ml'),
        ('Colgate Sensitive Whitening 100 g', 'Colgate', 100, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-sensitive-whitening-100-g/p', 'Pasta De Dientes Sensitive Whitening 100 G'),
        ('Colgate Sensitive Whitening 100 g', 'Colgate', 100, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-de-dientes-colgate-sensitive-whitening-100-g/952622', 'Pasta de Dientes COLGATE Sensitive Whitening 100 G'),
        ('Colgate Sensitive Whitening 100 g', 'Colgate', 100, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-sensitive-whitening-100-g.producto?53357%2C%2C42=', 'Pasta de Dientes COLGATE Sensitive Whitening 100 g'),
        ('Colgate Sensitive Pro-Alivio Original 110 g', 'Colgate', 110, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-sensitive-pro-alivio-110-g/p', 'Pasta de Dientes Colgate Sensitive Pro-Alivio 110 G'),
        ('Colgate Sensitive Pro-Alivio Original 110 g', 'Colgate', 110, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-sensitive-pro-alivio-inmediato-original-110-g/685039', 'Pasta Dental COLGATE Sensitive Pro-Alivio Inmediato Original 110 g'),
        ('Colgate Sensitive Pro-Alivio Original 110 g', 'Colgate', 110, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/colgate-pasta-de-dientes-sensitive-pro-alivio-110-g.producto?66110%2C%2C42=', 'Colgate Pasta de Dientes Sensitive Pro-Alivio 110 g'),
        ('Colgate Sensitive Pro-Alivio Real White 110 g', 'Colgate', 110, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-de-dientes-colgate-sensitive-pro-alivio-real-white-110-g/685075', 'Pasta de Dientes COLGATE Sensitive Pro-Alivio Real White 110 g'),
        ('Colgate Sensitive Pro-Alivio Real White 110 g', 'Colgate', 110, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-sensitive-pro-alivio-real-white-110-g.producto?63498%2C%2C42=', 'Pasta de Dientes COLGATE Sensitive Pro-Alivio Real White 110 g'),
        ('Colgate Sensitive Pro-Alivio Xtreme 110 g', 'Colgate', 110, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-sensitive-pro-alivio-xtreme-colgate-110-g/p', 'Crema Dental Sensitive Pro Alivio Xtreme Colgate 110 G'),
        ('Colgate Sensitive Pro-Alivio Xtreme 110 g', 'Colgate', 110, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-sensitive-pro-alivio-xtreme-110gr/p', 'Crema Dental Colgate Sensitive Pro Alivio Xtreme 110gr'),
        ('Colgate Max White 220 g', 'Colgate', 220, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-max-white-220-g/687508', 'Crema dental COLGATE max white 220 g'),
        ('Colgate Max White 220 g', 'Colgate', 220, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-max-white-220grs/p', 'Crema Dental Colgate Max White 220Grs'),
        ('Colgate Calcio x 2 (180 g c/u)', 'Colgate', 360, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-colgate-calcio-180-g-2-u/p', 'Pasta de Dientes Colgate Calcio 180 G 2 U'),
        ('Colgate Calcio x 2 (180 g c/u)', 'Colgate', 360, 'g', 'disco', 'https://www.disco.com.uy/product/pack-x-2-crema-dental-colgate-calcio-180-g/631793', 'Pack x 2 crema dental COLGATE Calcio 180 g'),
        ('Colgate Calcio x 2 (180 g c/u)', 'Colgate', 360, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-colgate-calcio-180gr-2un/p', 'Crema Dental Colgate Calcio 180gr 2un'),
        ('Colgate Calcio x 2 (180 g c/u)', 'Colgate', 360, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-calcio-180-g-2-unidades.producto?413662%2C%2C42=', 'Pasta de Dientes COLGATE Calcio 180 g 2 Unidades'),
        ('Colgate Sensitive Pro-Alivio Original x 2 (110 g c/u)', 'Colgate', 220, 'g', 'disco', 'https://www.disco.com.uy/product/pasta-dental-colgate-sensitive-pro-alivio-inmediato-original-110-g-2-un/622411', 'Pasta Dental COLGATE Sensitive Pro-Alivio Inmediato Original 110 G 2 un.'),
        ('Colgate Sensitive Pro-Alivio Original x 2 (110 g c/u)', 'Colgate', 220, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-colgate-sensitive-pro-alivio-110-g-2-un..producto?1606603%2C%2C42=', 'Crema Dental COLGATE Sensitive Pro Alivio 110 g (2 un.)'),
        ('Oral-B 3D White Brilliant Fresh x 2 (100 g c/u)', 'Oral-B', 200, 'g', 'ta-ta', 'https://www.tata.com.uy/pack-2-u-crema-dental-oral-b-3dwhite-brillant-100-g/p', 'Pack 2 U Crema Dental Oral B 3Dwhite Brillant 100 G'),
        ('Oral-B 3D White Brilliant Fresh x 2 (100 g c/u)', 'Oral-B', 200, 'g', 'disco', 'https://www.disco.com.uy/product/pack-x-2-crema-dental-oral-b-3d-white-100-g/683311', 'Pack x 2 Crema Dental ORAL-B 3D White 100 g'),
        ('Colgate Kids Frutilla 50 g', 'Colgate', 50, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-colgate-kids-fresa-50-g/633557', 'Crema dental COLGATE kids fresa 50 g'),
        ('Colgate Kids Frutilla 50 g', 'Colgate', 50, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-colgate-kids-frutilla-50-g.producto?332669%2C%2C42=', 'Pasta de Dientes COLGATE Kids Frutilla 50 g'),
        ('Kolynos Frescura 123 90 g', 'Kolynos', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-kolynos-frescura-123-90-g/p', 'Pasta de Dientes Kolynos Frescura 123  90 G'),
        ('Kolynos Frescura 123 90 g', 'Kolynos', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-kolynos-frescura-123-90gr/p', 'Crema Dental Kolynos Frescura 123 90Gr'),
        ('Kolynos Frescura 123 90 g', 'Kolynos', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-kolynos-frescura-123-90-g.producto?9247%2C%2C42=', 'Pasta de Dientes KOLYNOS Frescura 123 90 g'),
        ('Parodontax Flúor 90 g', 'Parodontax', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-paradontax-fluor-90-g/p', 'Pasta De Dientes Paradontax Fluor 90 G'),
        ('Parodontax Flúor 90 g', 'Parodontax', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-parodontax-fluor-90-g/683695', 'Crema dental PARODONTAX Fluor 90 g'),
        ('Parodontax Flúor 90 g', 'Parodontax', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-paradontax-fluor-90-g.producto?346295%2C%2C42=', 'Crema Dental PARADONTAX Flúor 90 g'),
        ('Periodont Gingival 90 g', 'Periodont', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-periodont-gingival-90-g/p', 'Pasta de Dientes Periodont Gingival 90 G'),
        ('Periodont Gingival 90 g', 'Periodont', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-periodont-gingival-90-g/955211', 'Crema dental PERIODONT Gingival 90 g'),
        ('Periodont Gingival 90 g', 'Periodont', 90, 'g', 'el-dorado', 'https://www.eldorado.com.uy/crema-dental-periodont-gingival-90gr/p', 'Crema Dental Periodont Gingival 90Gr'),
        ('Periodont Gingival 90 g', 'Periodont', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/periodont-pasta-de-dientes-gingival-90-g.producto?319979%2C%2C42=', 'Periodont Pasta de Dientes Gingival 90 g'),
        ('Periodont Zeta 90 g', 'Periodont', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-periodont-zeta-90-g/988799', 'Crema Dental PERIODONT Zeta 90 g'),
        ('Periodont Zeta 90 g', 'Periodont', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/periodont-pasta-de-dientes-zeta-90-g.producto?319982%2C%2C42=', 'Periodont Pasta de Dientes Zeta 90 g'),
        ('Periodont Gingival x 2 (180 g c/u)', 'Periodont', 360, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-periodont-gingival-180-g-2-u/p', 'Pasta de Dientes Periodont Gingival 180 G 2 U'),
        ('Periodont Gingival x 2 (180 g c/u)', 'Periodont', 360, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/pasta-de-dientes-periodont-gingival-2-unidades-x-180-g.producto?409674%2C%2C42=', 'Pasta de Dientes PERIODONT Gingival 2 Unidades x 180 g'),
        ('Sensodyne Original 90 g', 'Sensodyne', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/pasta-de-dientes-sensodyne-original-90-g/p', 'Pasta De Dientes Sensodyne Original 90 G'),
        ('Sensodyne Original 90 g', 'Sensodyne', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-sensodyne-original-90-g/624878', 'Crema dental SENSODYNE original 90 g'),
        ('Sensodyne Protección Completa 90 g', 'Sensodyne', 90, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-sensodyne-proteccion-completa-90-g/620707', 'Crema Dental SENSODYNE protección completa 90 g'),
        ('Sensodyne Protección Completa 90 g', 'Sensodyne', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-proteccion-completa-sensodyne-90-g.producto?1566365%2C%2C42=', 'Crema Dental Protección Completa SENSODYNE 90 g'),
        ('Sensodyne Sensibilidad y Encías 100 g', 'Sensodyne', 100, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-sensodyne-sensibilidad-y-encias-100-g/559151', 'Crema dental SENSODYNE sensibilidad y encías 100 g'),
        ('Sensodyne Sensibilidad y Encías 100 g', 'Sensodyne', 100, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-sensibilidad-y-encias-sensodyne-100-g.producto?1512083%2C%2C42=', 'Crema Dental Sensibilidad y Encías SENSODYNE 100 g'),
        ('Sensodyne Repara y Protege 100 g', 'Sensodyne', 100, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-sensodyne-repara-y-protege-pomo-100-g/633894', 'Crema dental SENSODYNE Repara Y Protege Pomo 100 g'),
        ('Sensodyne Repara y Protege 100 g', 'Sensodyne', 100, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-sensodyne-repara-y-protege-100-g.producto?335667%2C%2C42=', 'Crema Dental SENSODYNE Repara y Protege 100 g'),
        ('Fresh Up Sensitive Alivio Total 100 g', 'Fresh Up', 100, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-fresh-up-dentifrico-sensitive-alivio-total-100-gr/p', 'Crema Dental Fresh Up Dentifrico Sensitive Alivio Total 100 Gr'),
        ('Fresh Up Sensitive Alivio Total 100 g', 'Fresh Up', 100, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-fresh-up-sensitive-alivio-total-100-g/621433', 'Crema dental FRESH UP Sensitive Alivio Total 100 g'),
        ('Oral-B Complete 4 en 1 80 g', 'Oral-B', 80, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-oral-b-complete-80-g-4-en-1/624894', 'Crema dental ORAL-B complete 80 g 4 en 1'),
        ('Oral-B Complete 4 en 1 80 g', 'Oral-B', 80, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-oral-b-4-en-1-complete-80-g.producto?384540%2C%2C42=', 'Crema Dental ORAL - B 4 en 1 Complete 80 g'),
        ('Oral-B Stages para niños 100 g', 'Oral-B', 100, 'g', 'disco', 'https://www.disco.com.uy/product/crema-dental-oral-b-stages-ninos-100-g/954990', 'Crema Dental ORAL-B Stages Niños 100 g'),
        ('Oral-B Stages para niños 100 g', 'Oral-B', 100, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/crema-dental-oral-b-stages-para-ninos-100-g.producto?273984%2C%2C42=', 'Crema Dental ORAL - B Stages para Niños 100 g'),
        ('Den 3 Gingival 90 g', 'Den 3', 90, 'g', 'ta-ta', 'https://www.tata.com.uy/crema-dental-den3-gingival-90-g-1000592681/p', 'Crema Dental Den3 Gingival 90 g'),
        ('Den 3 Gingival 90 g', 'Den 3', 90, 'g', 'tienda-inglesa', 'https://www.tiendainglesa.com.uy/supermercado/den-3-crema-dental-gingival-90-g.producto?1565317%2C%2C42=', 'Den 3 Crema Dental Gingival 90 g')
    ) as listing(name, brand, quantity, unit, store_slug, url, external_name)
  loop
    select p.id
    into v_product_id
    from public.products p
    where lower(btrim(p.name)) = lower(btrim(v_listing.name))
      and lower(btrim(coalesce(p.brand, ''))) = lower(btrim(coalesce(v_listing.brand, '')))
      and p.quantity = v_listing.quantity
      and p.unit = v_listing.unit
      and p.category_id = v_category_id
    order by p.created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (name, brand, quantity, unit, category_id)
      values (v_listing.name, v_listing.brand, v_listing.quantity, v_listing.unit, v_category_id)
      returning id into v_product_id;
    end if;

    select id
    into v_store_id
    from public.stores
    where slug = v_listing.store_slug;

    if v_store_id is null then
      raise exception 'No existe la cadena %', v_listing.store_slug;
    end if;

    select sp.url
    into v_conflicting_url
    from public.store_products sp
    where lower(btrim(sp.url)) = lower(btrim(v_listing.url))
      and (sp.product_id <> v_product_id or sp.store_id <> v_store_id)
    limit 1;

    if v_conflicting_url is not null then
      raise exception 'El link % ya está asignado a otro producto o cadena', v_conflicting_url;
    end if;

    insert into public.store_products (product_id, store_id, url, external_name, active)
    values (v_product_id, v_store_id, v_listing.url, v_listing.external_name, true)
    on conflict (product_id, store_id) where location_id is null
    do update set
      url = excluded.url,
      external_name = excluded.external_name,
      active = true;
  end loop;
end
$$;
