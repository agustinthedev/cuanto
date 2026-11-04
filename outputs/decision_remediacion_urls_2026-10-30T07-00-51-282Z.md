# Revisión de fallos — run 2026-10-30T07:00:51.282Z

Revisión del 3/11/2026, 11:34 UYT. No se inició un scrape, un worker ni se consumió Queue.

## Finalización y clasificación

Últimos intentos activos: Disco 09:52:24.915 UTC, El Dorado 09:52:34.046 UTC y Ta-Ta 09:52:19.249 UTC. El último intento del run fue 09:52:38.735 UTC en Tienda Inglesa, inactiva. No se observaron intentos nuevos para este run; todos superan ampliamente el umbral de 60 minutos.

| Cadena | Publicaciones | Éxito | HTTP 404 / página inexistente | HTTP 200 sin producto/oferta | HTTP 200 sin precio positivo |
|---|---:|---:|---:|---:|---:|
| Disco | 1.472 | 1.472 | 0 | 0 | 0 |
| El Dorado | 474 | 434 | 0 | 30 | 10 |
| Ta-Ta | 1.389 | 1.311 | 78 | 0 | 0 |

Tienda Inglesa estaba inactiva y se excluyó automáticamente (92 publicaciones). Los 10 casos sin precio positivo se conservaron sin cambiar URL: una respuesta HTTP 200 sin precio positivo no prueba que la ficha esté rota y puede reflejar stock, sucursal u otra condición de oferta.

## URLs corregidas con evidencia convergente

### El Dorado — Colgate Total Original Mint 90 g

- Publicación: 0729fb19-9778-4e43-b76f-3f2b5567fe21.
- URL anterior: https://www.eldorado.com.uy/pasta-dental-colgate-total-original-mint-90-g/p
- URL nueva: https://www.eldorado.com.uy/crema-dental-colgate-total-original-mint-90gr/p
- Fallo del run: El Dorado no devolvió oferta, HTTP 200.
- Candidato: ficha oficial “Crema Dental Colgate Total Original Mint 90gr”, misma marca, fórmula y presentación de 90 g. La búsqueda oficial incluyó el nombre “Colgate Total Original Mint 90 g”; la ficha candidata resolvió y mostró oferta de $125,94, precio regular $209,90.
- Se compararon las fotos del SKU registrado y la ficha oficial; el packaging coincide. El registro anterior no tenía EAN comparable, por lo que no se usó el EAN del candidato como evidencia de identidad. El SKU no tenía precio positivo histórico disponible para comparar.
- Ubicación verificada: región El Dorado configurada para el scraper, Ciudad Vieja/Centro/Barrio Sur/Palermo/Cordón (SW#eldoradouy2099).
- Decisión: alta confianza; se cambió exclusivamente store_products.url. La escritura exigió ID, URL anterior y active=true; devolvió una fila. La lectura posterior confirmó URL nueva y publicación activa.

### Ta-Ta — Papas Fritas Pringles Original 104 g

- Publicación: 6c594f82-a449-40e6-b663-ade9429ffe95.
- URL anterior: https://www.tata.com.uy/papas-fritas-pringles-original-104-g/p
- URL nueva: https://www.tata.com.uy/papas-fritas-pringles-original-104-g-1000479912-157515/p
- Fallo del run: HTTP 404 en la URL anterior.
- Búsqueda oficial por nombre completo: “Papas Fritas Pringles Original 104 g”. El resultado de catálogo fue la ficha oficial con nombre, marca, sabor y contenido exactos.
- La ficha abrió con la ubicación configurada “Montevideo y Ciudad de la Costa”, mostró disponibilidad/oferta: regular $202 y promoción $169. El precio regular concuerda con el último precio histórico positivo de $204 (27/10); no se comparó el precio promocional con el histórico regular. La foto del catálogo coincide visualmente con la imagen guardada para la publicación.
- Decisión: alta confianza; se cambió exclusivamente store_products.url con guarda por ID, URL anterior y active=true. La escritura devolvió una fila y la lectura posterior confirmó la URL nueva y active=true.

## Fallos retenidos y búsquedas pendientes

### El Dorado: sin oferta

El run registró 30 respuestas sin oferta. Se hicieron consultas al buscador/API pública oficial de El Dorado para el conjunto. Además de Colgate, el trabajo de búsqueda disponible permitió identificar señales que no autorizan reemplazo automático:

| Producto / publicación | Búsqueda o candidato oficial | Decisión |
|---|---|---|
| Acondicionador HEAD & SHOULDERS Manzana Fresh 300 ml (10599a46-76aa-415a-a5b4-c888513d5232) | Los resultados revisados no confirmaron simultáneamente tipo de producto, fórmula y tamaño. | Retener; candidato inconcluso. |
| Acondicionador SEDAL Prebióticos + Biotina 650 ml (bf324229-0034-471e-bd17-dd7f2d484fb4) | Se encontraron productos de 190 ml, shampoo (tipo equivocado) y otras fórmulas. | Retener; no son equivalentes de alta confianza. |
| Agua SALUS Frutté sin azúcar manzana verde 1,5 L (b6e117bc-723e-4e35-9a5e-82edd1b6784c) | “Agua Saborizada Salus Frutte Manzana 1.5 L”, EAN del candidato 7730400003594. El SKU anterior no tenía EAN comparable. La descripción/ingredientes incluyen azúcar invertido y la foto muestra manzana roja, distinto de “sin azúcar/manzana verde”. | Retener; fórmula y packaging divergentes. |
| Agua VITALE sin gas 995 ml (ffbf9b51-0804-4b43-af93-8adf18f4df37) | La misma ficha oficial resolvió y ofrecía $65. | Retener la URL actual; el fallo parece transitorio, no hay URL sustituta que aplicar. |
| Arroz patna GREEN CHEF 5 kg (e8769b4a-0514-4bf7-a462-be451ccb3479) | Resultados revisados solo en 1 kg. | Retener por diferencia de contenido. |
| Papel higiénico HIGIENOL Max 90 m × 8 (24c1e9ec-e1f5-4b92-a373-e4bd0b08ffbd) | Se encontró una ficha con presentación coincidente, pero el catálogo indicaba no disponible. | Retener; no se verificó oferta en la ubicación. |
| Ron BACARDI Spiced 750 ml (387f9453-a05e-4af9-ac3a-05856fdc2071) | Candidato revisado de 700 ml. | Retener por contenido distinto. |
| Yogur CLALDY vainilla 780 ml (254992f9-8bda-4eb8-823e-d18701b8b9f1) | Las fichas visibles no permitieron confirmar con certeza la variante. | Retener; duda de identidad. |
| Limpiador Cristal Baños doy pack 500 ml (c0a56e1f-c350-412c-a801-80528d84feb8) | Candidato revisado de 400 ml. | Retener por tamaño distinto. |
| Limonada SALUS Frutté sin azúcar 1,5 L (a69e4ce5-90a9-48c5-b7de-1cf1663be8a8) | Los resultados de búsqueda fueron de otros sabores. | Retener; variante distinta. |

Las respuestas/consultas exactas y resultados completos de la búsqueda API de los otros casos no quedaron conservados en el registro de trabajo. Por eso los casos restantes se marcan como búsqueda inconclusa, no como “sin candidato”. No se inventan búsquedas ni resultados retrospectivamente. Los 30 IDs fallidos originales permanecen identificados en scrape_attempts; luego de corregir Colgate, 29 siguen pendientes de reevaluación por URL/resultado de catálogo.

### Ta-Ta: HTTP 404

Persistieron 78 HTTP 404 activos en este run. Se rehizo la búsqueda oficial del catálogo para dos casos repetidos; ambos se dejaron intactos:

| Publicación | Consultas exactas en el buscador de Ta-Ta | Resultado y decisión |
|---|---|---|
| 0531b2cc-675a-433c-894b-cb771dc48c84 — Aceite de Coco Orgánico TERRA VERDE 1 L | “Aceite de coco Terra Verde 1 lt”; “Terra Verde”; “Aceite de coco 1 L”; “Aceite de coco Terra Verde 1000 ml”; “Terra Verde aceite coco 1lt”. | La búsqueda amplia mostró aceite de coco Terra Verde de 200 ml y aceite neutro de 500 ml, no 1 L. Otras búsquedas no mostraron candidato. Búsqueda inconclusa (no se verificó API/categoría alternativa ni ficha candidata); mantener activa y sin cambios. |
| 731cfbf6-cb25-4ec0-ab34-bd163e41b802 — Shampoo SEDAL Prebióticos Biotina 650 ml | “Shampoo SEDAL Prebioticos Biotina 650 ml”; “Sedal Prebioticos Biotina”; “Sedal Biotina 650 ml”; “Shampoo Sedal Prebioticos Biotina 650 cc”. | La búsqueda amplia mostró shampoo Sedal 650 ml con Ceramidas o Ácido Hialurónico + vitamina A, fórmulas distintas. No se confirmó la fórmula requerida. Búsqueda inconclusa; mantener activa y sin cambios. |

La ubicación mostrada en las fichas de Ta-Ta fue “Montevideo y Ciudad de la Costa”. Los otros 76 fallos 404 de Ta-Ta no se volvieron a buscar individualmente esta ejecución; siguen pendientes, no se clasifican como “sin candidato”. La evidencia histórica de la revisión anterior está en [informe del 27/10](./decision_remediacion_urls_2026-10-27T07-00-51-282Z.md), pero no sustituye el nuevo intento requerido para fallos repetidos.

## Resultado del run

- Dos URLs actualizadas con evidencia convergente: Colgate Total Original Mint 90 g (El Dorado) y Pringles Original 104 g (Ta-Ta).
- 106 fallos URL relevantes restantes para revisar en próximas ejecuciones: 29 fallos “sin oferta” de El Dorado y 77 HTTP 404 de Ta-Ta.
- 10 respuestas sin precio positivo retenidas como asunto de precio/stock, no como URL rota.
- No se insertaron publicaciones de cobertura entre cadenas en esta sección.
- No se cambió nombre, precio, estado activo ni otro campo de negocio. El trigger de base puede avanzar updated_at al cambiar url.

## Consultas adicionales de Ta-Ta para cobertura

Los hallazgos y búsquedas de cobertura no forman parte del conteo de fallos de este run; están documentados en [informe de cobertura del 3/11](./coverage_productos_2026-11-03.md).
