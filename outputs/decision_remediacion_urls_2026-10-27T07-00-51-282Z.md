# Remediación de URLs — run 2026-10-27

## Alcance y conclusión

- Run: 2026-10-27T07:00:51.282Z (cron: 04:00:51 UYT).
- Último intento: 10:03:28.041 UTC (07:03:28 UYT). Revisión iniciada aproximadamente 10:58 UYT, más de 60 minutos después.
- Publicaciones fallidas activas revisadas: Ta-Ta 404 (92), El Dorado sin oferta (29) y respuestas sin precio positivo (13): 134 en total.
- Tienda Inglesa fue excluida por estar inactiva. No se inició ningún scrape, worker ni Queue.
- Se cambiaron 8 URLs: 4 de El Dorado y 4 de Ta-Ta. Las otras 126 publicaciones quedaron activas y sin cambios.
- La sentencia modificó explícitamente solo store_products.url. La base ejecuta además el trigger store_products_set_updated_at, que actualiza automáticamente updated_at; no se tocaron precios, nombres, estado activo ni otros campos de negocio.

## URLs actualizadas

| store_product_id | Cadena | Producto | URL anterior | URL nueva | Evidencia |
|---|---|---|---|---|---|
| 93339f37-7199-4908-9d5c-b8c806106100 | El Dorado | Acondicionador DOVE Óleo Nutrición 400 ml | [anterior](https://www.eldorado.com.uy/acondicionador-dove-oleo-nutricion-400cc/p) | [nueva](https://www.eldorado.com.uy/acondicionador-dove-nutricion-tri-oleos-400ml/p) | Misma marca, línea nutritiva con óleos y 400 ml. Comparé las fotos: coincide el frasco/línea; el nombre actual especifica “Nutrición + Tri Óleos”. Ficha actual con precio $459 y ubicación configurada. El SKU anterior no tiene EAN guardado; no comparé el EAN del candidato. |
| 5ec53d07-17ec-4862-bb6f-520a76265d39 | El Dorado | Colgate Total Whitening con Flúor 180 g | [anterior](https://www.eldorado.com.uy/pasta-dental-colgate-total-whitening-con-fluor-180g/p) | [nueva](https://www.eldorado.com.uy/crema-dental-colgate-total-whitening-180gr/p) | Misma marca, variante Whitening y contenido. La caja de la foto anterior coincide con la ficha actual, incluido el pack de 180 g. Ubicación configurada; precio regular $294,90 y oferta visible $235,92. Sin precio positivo histórico del SKU anterior. |
| e59f00a4-dcfb-4b60-a394-55f712ec34a9 | El Dorado | Desodorante en spray SPEED STICK Xtreme Ultra 91 g | [anterior](https://www.eldorado.com.uy/desodorante-en-spray-speed-stick-xtreme-ultra-91-g/p) | [nueva](https://www.eldorado.com.uy/desodorante-speed-stick-xtreme-ultra-aerosol-91gr/p) | Coinciden marca, variante, aerosol y 91 g. Ficha actual resuelta en la ubicación configurada; regular $239,90, oferta $191,92. Sin precio positivo histórico. |
| 7010df3c-17c9-4c60-a6a1-48229b114836 | El Dorado | Mermelada arándanos cero LOS NIETITOS 340 g | [anterior](https://www.eldorado.com.uy/mermelada-los-nietitos-0-azucar-arandanos-340g/p) | [nueva](https://www.eldorado.com.uy/mermelada-los-nietitos-0-arandano-frasco-340gr/p) | Coinciden marca, 0% azúcar, arándano y 340 g. Las fotos muestran el mismo frasco dietético de arándano. Página resuelta en la ubicación configurada, $203. Sin precio positivo histórico. |
| 794398fa-38ef-478e-9e11-ef841cdd6917 | Ta-Ta | Cerveza STELLA ARTOIS 710 ml | [anterior](https://www.tata.com.uy/cerveza-stella-artois-lager-lata-710-cc-1000501124/p) | [nueva](https://www.tata.com.uy/cerveza-stella-artois-lager-lata-710-ml-1000501124-161543/p) | Ficha oficial: Stella Artois Lager lata 710 ml, misma marca/variante/contenido; producto InStock en la sesión de Montevideo. Regular (listPrice) $186 y oferta $130. Sin historial positivo; no se usó el GTIN candidato como comparación con el SKU anterior. |
| 903e343f-7de5-44b9-974a-f3c64df83954 | Ta-Ta | Detergente líquido NEVEX para diluir 500 ml | [anterior](https://www.tata.com.uy/jabon-liquido-nevex-para-diluir-500-ml/p) | [nueva](https://www.tata.com.uy/jabon-liquido-nevex-para-diluir-500-ml-1000156419-12663/p) | Ficha oficial con mismo producto, marca y contenido; imagen guardada del SKU anterior coincide con la ficha. InStock en Montevideo. Último precio histórico: $328 (01/10/2026); precio regular actual $328 y oferta $279. |
| de8bb167-9b68-4efa-abcf-9cd6a5c9e18d | Ta-Ta | Yerba CANARIAS 250 g | [anterior](https://www.tata.com.uy/yerba-canarias-250-00-g-1/p) | [nueva](https://www.tata.com.uy/yerba-mate-canarias-250-g-1000050446-152903/p) | Ficha oficial Canarias 250 g, InStock en Montevideo, precio $58. Las fotos comparadas muestran el mismo producto tradicional/Original de 250 g con actualización de diseño. |
| 73a10e00-7ee2-4ce7-b681-6e8cb15a16e7 | Ta-Ta | Yerba CANARIAS 500 g | [anterior](https://www.tata.com.uy/yerba-mate-canarias-500-g/p) | [nueva](https://www.tata.com.uy/yerba-mate-canarias-original-500-g-1000050442-272/p) | Ficha oficial Canarias Original 500 g, InStock en Montevideo, precio $106. Las fotos muestran el envase amarillo tradicional/Original de 500 g, no Canarias Suave ni saborizada. Sin historial positivo. |

## Validación de fuentes, localidad y precios

- Ta-Ta: ValidateSession confirmó URY, código postal 11800, canal 4 y región Montevideo/Ciudad de la Costa. Las fichas candidatas seleccionadas se consultaron con ese mismo canal/locale y devolvieron producto y disponibilidad InStock. La candidata de Canarias Suave 1 kg devolvió “No product found”, así que se retuvo esa publicación.
- El Dorado: las fichas candidatas se confirmaron con la ubicación del scraper: Ciudad Vieja, Centro, Barrio Sur, Palermo y Cordón. Se distinguió el precio regular de las ofertas.
- Los registros antiguos no guardan EAN. Ningún EAN/GTIN del candidato se trató como comparación con el producto anterior; se usaron identidad de marca/variante/contenido, imagen cuando correspondía, disponibilidad y precio histórico si existía.
- Solo Nevex tenía precio positivo histórico entre los ocho cambios; $328 histórico coincide con el precio regular actual. En los demás, el historial positivo era inexistente, por lo que no se inventó una comparación de precio.

## Ta-Ta — 88 errores 404 retenidos

Todos quedaron activos con su URL anterior. La búsqueda en el catálogo oficial no encontró un reemplazo de alta confianza; “sin candidato” no significa que el producto esté dado de baja. Las cercanías ambiguas se explican debajo de la tabla.

| store_product_id | Producto | Decisión |
|---|---|---|
| 0531b2cc-675a-433c-894b-cb771dc48c84 | Aceite de Coco Orgánico TERRA VERDE 1 L | Retener |
| cff9dd35-fbdb-4ce6-80a0-1f715368dbb5 | Aceite girasol ÓPTIMO maíz 1.5 L | Retener |
| 22b1d929-e342-4d7d-a99e-4fb130a3e22c | Aceite girasol RÍO DE LA PLATA 900 ml | Retener |
| de985fbb-e022-40f6-addf-0b472d7eef76 | Acondicionador FRUCTIS Goodbye Daños 200 ml | Retener |
| c0daa96f-8083-46e9-83f2-8d5fa3d5e689 | Acondicionador SEDAL Prebióticos Biotina 190 ml | Retener |
| 819966c2-8384-47bf-8cbb-82a0a41de629 | Acondicionador SEDAL Prebióticos Biotina 650 ml | Retener |
| 0ee42938-c121-454e-877d-ae5f8e4cfcd2 | Agua NATIVA con gas 600 ml | Retener |
| e12b9816-da4f-4e43-99af-e32267b43995 | Agua SALUS Frutté pera 1.5 L | Retener |
| e66d30d9-b949-434e-8a0d-971ef936f96d | Agua SALUS Frutté sin azúcar arándanos y limón 600 ml | Retener |
| 77e2ccf1-8c5d-4801-ad47-e742f31778ad | Ajíes catalanes DEL GAUCHO 580 g | Retener |
| cbdaf542-8f0f-4ec9-8442-4e9370ca281a | Ajo en escamas MONTE CUDINE 200 g | Retener |
| 15aadfb3-3815-4546-91ed-b26210483ab6 | Avena instantánea QUAKER 300 g | Retener |
| 5decff60-0735-4155-bce4-c0449a3ebb46 | BEEFEATER London Dry Gin 750 ml | Retener |
| 97f55a85-5adb-479e-a32c-1e9f8cc663d0 | Energizante ROCKSTAR 500 ml | Retener |
| 259fa792-574c-4f23-8eda-2c40df6b9006 | Bizcochuelo ROYAL Vainilla 500 g | Retener |
| 1fcfafa9-e710-4fc4-bc8f-c94bb9f88147 | Budín SMAMS marmolado sin gluten 250 g | Retener |
| 8c0b631c-5538-4603-b34d-c8f1a51753bc | Cepillo Dental FRESH UP 5680 Ultra Soft | Retener |
| a4db6fe3-9558-4b6d-866c-42e74f670239 | Cerveza Estrella Galicia Twist Off 355 ml | Retener |
| 2ccc0e7a-bba8-4630-81d8-df7466cacc2e | Cerveza Miller 710 ml | Retener |
| 9f6f9f02-2a5e-40c0-8356-51c1e205a3c0 | Chantilly Royal Caja 100 g | Retener |
| 9908eb55-79f6-43ca-af9e-4c7983cb7bca | Colgate Total Antisarro con Flúor 100 ml | Retener |
| 2e85699f-2c98-4d2c-9cf9-db1f0cfa9f7c | Color Verde Monte Cudine 60 ml | Retener |
| f4485b6c-5ffd-4fd9-8914-b3f38ca72d83 | Condimento Sazón para Guiso LA MANCHEGA 20 g | Retener |
| b2b4c857-38bb-4c80-b65d-da3066c112cf | Curry LA MANCHEGA 25 g | Retener |
| daed6b4f-61b6-4a68-99fd-74937aa4a980 | Desodorante Aerosol OBAO Ice 150 ml | Retener |
| d3760897-2779-4b1a-bb4b-976a9fbacb97 | Detergente AXION en crema 450 g | Retener |
| 837a3966-9c1b-4d5c-b0c5-758148ca0ccd | Lavavajilla en polvo SOMAT 960 g | Retener |
| 674e652d-466a-4702-9417-491165d8e78f | Edulcorante en polvo SUCRALIGHT 120 g | Retener |
| 42729f13-3abe-4ebb-afbc-4ebf3c2a7a64 | Enjuague bucal LISTERINE Cuidado Total 250 ml | Retener |
| 50159bf5-bd71-47ac-8054-092124ac120c | Fresh Up Sensitive Alivio Total 100 g | Retener |
| 535af149-70cf-490b-b097-4d9445072f44 | Frijoles negros LA COSTEÑA enteros 400 g | Retener |
| 8172e748-8a7f-45e0-a708-86f88b0373f4 | Garoto Choco Biscuit 78 g | Retener |
| e581af1a-e600-46fc-ae2d-a9d63ff37f62 | Gin TANQUERAY Flor de Sevilla 700 ml | Retener |
| d5eb84e0-3e83-4aac-9e0e-6eb2c0114402 | Gin TANQUERAY Royale 700 ml | Retener |
| f0c5193a-4e65-4898-bf0e-c0cfb7335241 | Harina Cañuelas Integral Fina 1 kg | Retener |
| 1444001b-7d3f-4fd0-96eb-068175c52408 | Helado vainilla LA CIGALE 800 ml | Retener |
| 3356d655-8475-4c4c-a8cb-41413de4da01 | Huevo de Pascua NESTLÉ Classic 185 g | Retener |
| 0e18081d-08b1-44df-9f46-789cd75b9dfc | Jabón en polvo Cavallaro Insuperable Clásico 1 kg | Retener |
| e31aa5e8-0f2f-4100-ad0b-f8ddf269218f | Jabón líquido NEVEX Bicarbonato para diluir 500 ml + botella regalo | Retener |
| 75e29f86-20c8-445d-bbae-379691ef9303 | Jugo CEPITA Fresh Multifruta 995 ml | Retener |
| 3267d257-6501-40db-9075-e0e374ca5cf9 | Jugo MAXIFRUTA Durazno 1 L | Retener |
| 65ed0b60-433b-469e-b890-f3fd7d974b7a | Leche de coco EQUADOR 400 ml | Retener |
| 9d251049-d35e-43e6-ad4c-1e11ae29c29c | Limpiador ODEX amoníaco 900 ml | Retener |
| fb3ec1ee-d1a3-4cf2-aad4-945ff5b14698 | Maní japonés MENDORATO 200 g | Retener |
| 90af881b-d4e6-4f81-a752-fdab2d89d72c | Mermelada dietética durazno LIMAY 350 g | Retener |
| 661b3699-c3ad-4673-bb44-c1dd4a320b8f | Mermelada LIMAY frutilla Zero 360 g | Retener |
| 92a84a71-0ba3-49a5-85e9-8e20d308f1ea | Pack ELVIVE Colorvive shampoo 370 ml + acondicionador 200 ml | Retener |
| 2af35cd8-b558-4ff9-8ab1-406800f1694d | Pack ELVIVE shampoo 370 ml + acondicionador 200 ml | Retener |
| c57075f9-1f6b-458e-8f46-494dbe5ce1ac | Pan rallado COLOLÓ saborizado 800 g | Retener |
| d0fb8350-f691-43af-81c6-a4a88d601de9 | Pañal PAMPERS Confort Sec XXG 112 un. | Retener |
| 6fff53b1-7911-43ec-a752-ca04518f1c3d | Pañal adulto READYSEC P/M 14 un. | Retener |
| 82f1edde-dd08-4883-b948-59596bcf6fb4 | Papas fritas RUFFLES 85 g | Retener |
| 7c4861d6-c227-42ac-a964-b2c97948e610 | Pasta de harina de arroz, lentejas y arvejas CAÑUELAS 300 g | Retener |
| f7b0ed02-ea85-45ae-9245-d99f7e15b825 | Paté de carne ODERICH 100 g | Retener |
| 4f5174b5-93ef-42aa-9b8f-6fc1eaeaa451 | Paté de lengua ODERICH 100 g | Retener |
| fc473279-4c5e-4067-a7a6-0f32b88859d2 | Porotos negros NIDEMAR 300 g | Retener |
| 572fc522-6b4a-4f10-9430-0990110d8828 | Postre CRUFI Pasión de Almendras 680 g | Retener |
| 56fd74e7-1fee-4dce-b56d-3d2d78ee9220 | Protector diario CAREFREE original sin perfume 60 un. | Retener |
| b7e5c975-5174-416f-9f8e-af0cccb67c61 | Repelente OFF! Family crema 60 g | Retener |
| 18b98f51-847f-4e0d-a1d1-9394f1eee9d6 | Repelente OFF! Defense Infantil spray 100 ml | Retener |
| cdf572a7-7bfa-4a63-8771-d7c16217534b | Repelente OFF! Protección Invisible aerosol 98.7 ml | Retener |
| b10eb06a-a72b-47da-90ed-f4250f20d7dd | Sal con hierbas MONTE CUDINE 85 g | Retener |
| 9d770357-9f89-414a-b8d7-3291ce123f69 | Sal parrillera yodada SEK 500 g | Retener |
| 5d6d4bd8-7d7f-4c97-9250-53b1d47538d8 | Salsa frutilla 0% LOS NIETITOS 250 g | Retener |
| b792f483-f778-4206-9885-6d6d902857ea | Shampoo ELVIVE Glycolic Crystal 680 ml | Retener |
| d86a6fe8-f009-4ea3-87a1-bf77ce03fa48 | Shampoo FRUCTIS Aloe Water 350 ml | Retener |
| 6e4720c4-06a2-4f6d-aa1c-5bf6f3c19e08 | Shampoo FRUCTIS Oil Repair 350 ml | Retener |
| bfffe0eb-30ef-4822-9c42-92fdc3529cdc | Shampoo SEDAL Prebióticos Biotina 190 ml | Retener |
| 731cfbf6-cb25-4ec0-ab34-bd163e41b802 | Shampoo SEDAL Prebióticos Biotina 650 ml | Retener |
| 375dc1ec-536e-47f1-a9d8-cba364ed5052 | Shampoo SEDAL Restauración Instantánea 190 ml | Retener |
| 91e27eb3-3669-455a-b6b3-349d38ddc944 | Snack DORITOS queso 380 g | Retener |
| 2cc4b181-9554-4b44-a89c-50fb0c6e7cd1 | Toalla Femenina LADYSOFT Piel Sensible 8 un. | Retener |
| be6d9a7e-6737-436e-82be-6cd8707ee1f2 | Toalla femenina LADYSOFT Power Flex 16 un. | Retener |
| 3fcacfad-346e-4888-bed6-d025b47e993d | Toalla Femenina MIMOSA Nocturna con Alas 8 un. | Retener |
| 528d8991-fd9e-43e0-a16e-c18ee3598cb1 | Toallitas húmedas DR. SELBY para bebés sin alcohol | Retener |
| d886c961-d06e-4687-a085-df723c08640b | Tostadas Clásicas EL TRIGAL 180 g | Retener |
| 53d0032f-300e-4c69-8b8f-b27f980e2c3b | Tostadas con semillas EL TRIGAL 180 g | Retener |
| ef62c74b-45d0-4d0f-ac98-2020b566f3f4 | Tostadas Mini MARETTI Cheddar 140 g | Retener |
| ac1ba30c-1c5a-4453-9a79-b37278bbadb4 | Turrón PICO crema catalana 200 g | Retener |
| f0455ff8-1991-470d-b55b-c7dee5110320 | Turrón PORTEZUELO blando 70 g | Retener |
| 9f4db668-bf30-41c1-afc6-df43d982801e | Vermouth CARPANO Bianco 950 ml | Retener |
| 7f043390-12ee-451d-86d2-9f1397e4374e | Vermouth PUNT E MES 750 ml | Retener |
| f3454382-e4db-4119-bfe0-01c240578d89 | Vinagre de manzana orgánico TERRA VERDE 1 L | Retener |
| 4b9f8de1-7eaf-40de-8cea-99207215449e | Vinagre TERRA VERDE de manzana, cúrcuma y jengibre 500 ml | Retener |
| 4a9bd01a-e922-4347-97ae-fda063b9fca3 | Vodka SERNOVA Fresh Citrus 700 ml | Retener |
| 267f75fb-3be4-4ccf-a246-0fc6e0773349 | Yerba CANARIAS Edición Especial 1 kg | Retener |
| ab3c4a85-c066-4fdd-a6c5-7bd84b4cc83c | Yerba CANARIAS Suave 1 kg | Retener |
| 0a899546-0a27-4251-b239-e03cb2194c72 | Yerba LA SELVA 1 kg | Retener |

## El Dorado — 25 respuestas “sin oferta” retenidas

Las cuatro equivalencias de alta confianza están en la tabla de cambios. Para las publicaciones siguientes mantuve activa la URL: las búsquedas no establecieron sustitución fiable o los candidatos diferían en variante, gramaje, tipo o presentación.

| store_product_id | Producto | Decisión |
|---|---|---|
| 10599a46-76aa-415a-a5b4-c888513d5232 | Acondicionador HEAD & SHOULDERS Manzana Fresh 300 ml | Retener: no se confirmó variante/tipo. |
| bf324229-0034-471e-bd17-dd7f2d484fb4 | Acondicionador SEDAL Prebióticos Biotina 650 ml | Retener: sin candidato exacto. |
| b6e117bc-723e-4e35-9a5e-82edd1b6784c | Agua SALUS Frutté sin azúcar manzana verde 1.5 L | Retener: candidatos de otros sabores o tamaños. |
| e8769b4a-0514-4bf7-a462-be451ccb3479 | Arroz patna GREEN CHEF 5 kg | Retener: candidato GREEN CHEF encontrado de 1 kg. |
| f87b4fcd-747b-4e05-8d1e-2851914725c8 | Arvejas ARDO 400 g | Retener: sin candidato exacto. |
| 9ad4fcd7-7dfd-4fd9-abf0-f0ff17e8f8f5 | Cápsulas DOLCE GUSTO Café Americano 10 un. | Retener: resultados de otros sabores. |
| 0729fb19-9778-4e43-b76f-3f2b5567fe21 | Colgate Total Original Mint 90 g | Retener: ficha original aún existe y muestra Agotado. |
| 72bcbc63-a839-46c3-8d99-15bec0ae93ea | Colgate Total Whitening con Flúor 90 g | Retener: “Total 12 Whitening” no se confirmó igual. |
| 6d8d30b2-2048-4c8f-b379-f6af741aad23 | Desodorante LADY SPEED STICK Naturals Coco aerosol 91 g | Retener: no se confirmó el mismo aroma/fórmula. |
| 6a9325ac-7c66-4ed8-a085-a810ef112f55 | Desodorante REXONA Crystal roll-on 50 ml | Retener: resultados cercanos con otras variantes. |
| b1c24fa9-a010-46cf-beb6-5f362d22afdd | Galleta EL TRIGAL Mediodía tripack 350 g | Retener: candidato de 300 g, tamaño distinto. |
| a69e4ce5-90a9-48c5-b7de-1cf1663be8a8 | Limonada SALUS Frutté sin azúcar 1.5 L | Retener: otros sabores. Último precio positivo $117 el 23/10/2026. |
| 7289bacb-ebd2-46f2-a2f6-f3db34271c6e | Limpiador Antigrasa CRISTAL Doy Pack 500 ml | Retener: doy pack de 400 ml o gatillo de 500 ml no equivalen en presentación. |
| c0a56e1f-c350-412c-a801-80528d84feb8 | Limpiador Baños CRISTAL Doy Pack 500 ml | Retener: candidatos de 400 ml u otra presentación. |
| 6f8fd3b2-448e-4fa9-a9ff-e4cdda49aea2 | Pañal BABYSEC Classic Plus M 48 un. | Retener: no se confirmó talle y cantidad. |
| 0f8ab8dd-8972-4119-806b-44a05852f8ba | Pañal BABYSEC Classic Plus XG 32 un. | Retener: no se confirmó talle y cantidad. |
| 166e2499-7fa0-4c60-b370-a2bf16d9e6eb | Pañal BABYSEC Classic Plus XXG 32 un. | Retener: no se confirmó talle y cantidad. |
| b7d52b05-415b-4471-9614-fb334e5f4e74 | Repelente OFF! Protección Invisible aerosol 98.7 ml | Retener: resultados de otros tamaños/presentaciones. |
| 387f9453-a05e-4af9-ac3a-05856fdc2071 | Ron BACARDI Spiced 750 ml | Retener: candidato de 700 ml. |
| 3453a1a6-ac05-4674-84c3-c840467f7b26 | Shampoo FRUCTIS Adiós Esponjado 350 ml | Retener: candidato de tratamiento 10 en 1 y 300 ml. |
| 786c2188-21d8-4592-ad15-1c9442e6c875 | Shampoo HEAD & SHOULDERS Manzana Fresh 180 ml | Retener: variante/tamaño no confirmado. Último precio positivo $299,90 el 26/10/2026. |
| a465c9c7-4331-440e-9fb3-29b36c7ba324 | Talco Pedico XANAPIÉ Azul bolsa 180 g | Retener: candidato era repuesto. |
| 8f868702-b6b2-46d3-9439-10dd892f54c2 | Toalla de Papel ELITE Deco x2 100 paños | Retener: empaque/cantidad de paños no confirmados. |
| 7f1336f9-6505-4b73-8781-593a0b89cf8c | Vino tinto abocado SAMT 700 ml | Retener: sin reemplazo exacto. |
| 55a6de0a-b09b-4002-b11e-635f8e556723 | Yerba EL MONCAYO Orgánica Tradicional 1 kg | Retener: opciones Clásica/saborizadas/compuestas no confirman Orgánica Tradicional. |

## Sin precio positivo — 13 publicaciones retenidas

HTTP 200 sin precio positivo se trató como posible falta de stock/localización, no como URL rota. Ninguna URL se modificó.

| store_product_id | Cadena | Producto | Último precio positivo guardado |
|---|---|---|---|
| 6fd74913-dbe6-4b15-a9ac-ebc4856dd601 | El Dorado | Acondicionador FRUCTIS Probiótico 200 ml | Sin registro |
| e64aa830-96b4-4e87-bff4-896342414c65 | El Dorado | Agua NATIVA sin gas sport 600 ml | $69,90 — 26/10/2026 |
| a275abdb-ae80-4dcb-ae54-ff0ebf11e2fb | El Dorado | Aperitivo PINERAL 750 ml | Sin registro |
| 624fd7f6-44ff-420d-8850-a1308d7b19bf | El Dorado | Cápsulas DOLCE GUSTO Café Au Lait 10 un. | Sin registro |
| c37ad706-88c0-4a9b-8efd-57e8bea7efdc | El Dorado | Cerveza PILSEN 710 ml | Sin registro |
| 31dd6d96-830c-4fb5-b55f-b21222574f46 | El Dorado | Colgate Luminous White Color Correct 70 g | Sin registro |
| 655d37a1-d7bf-4320-95bb-897d677bc802 | El Dorado | Energizante BALY Frutos Tropicales 250 ml | Sin registro |
| f98488c5-f0e4-450f-a2c6-4b35376a458b | El Dorado | Pack ELVIVE Dream Liso shampoo 680 ml + acondicionador 370 ml | Sin registro |
| 32297b36-0a4d-4529-bb6e-fc8046fbb844 | El Dorado | Shampoo FRUCTIS Probiótico 200 ml | Sin registro |
| 8a8d0e6e-8be6-45ff-b06c-842daf4649a8 | El Dorado | Toalla de Papel NOVA Megarrollo 500 paños | Sin registro |
| e6bc4499-2b1d-44d3-8960-ab883d20f21c | El Dorado | Toallitas Húmedas HUGGIES Limpieza Efectiva 192 un. | Sin registro |
| a167509c-738f-4584-8d1b-7fe77c90ed9b | Ta-Ta | Chocolate GAROTO con castañas 100 g | $115 — 26/10/2026 |
| dbd6648f-de16-49c9-ba32-97e88289fb4b | Ta-Ta | Muzzarella rallada FARMING 200 g | $190 — 26/10/2026 |

## Verificación posterior

La lectura posterior de producción confirmó las ocho URLs nuevas esperadas. También se confirmó que el último intento del run sigue siendo 10:03:28.041 UTC; no se disparó ninguna ejecución adicional.
