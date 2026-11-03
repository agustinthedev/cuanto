# Cobertura de publicaciones entre cadenas — 2026-11-03

Consulta de cobertura realizada el 3/11/2026, 11:34 UYT. No se insertaron publicaciones nuevas.

## Criterio y lote

Las cadenas activas en la base son Disco, El Dorado y Ta-Ta. Tienda Inglesa está inactiva y se excluyó. Como products no contiene un indicador activo, el catálogo canónico activo se infirió como productos con al menos una publicación activa en una cadena activa.

El primer lote determinista contiene 50 productos, ordenados por menor número de cadenas activas seguidas y luego product_id ascendente. Las búsquedas todavía no completan la verificación de todas las cadenas faltantes de ningún producto, por lo que el cursor sigue al inicio del lote. Los productos parcialmente investigados conservan sus consultas y resultados para que la próxima ejecución continúe desde ahí en vez de repetirlas.

### Búsquedas realizadas

| product_id | Producto | Cadenas faltantes investigadas | Consultas/resultados | Estado |
|---|---|---|---|---|
| 00025f84-7956-403a-b79e-d74025f7f6ba | Té Verde LIPTON cítrus 20 sobres (publicado en Disco) | El Dorado y Ta-Ta | El Dorado: “Té Verde Lipton cítrus 20 sobres”; “Lipton citrus”. Ta-Ta: “Té verde Lipton cítrus 20 sobres”; “Lipton”. El Dorado mostró otros tés Lipton (Frutos Rojos y Yellow Label), no la variante cítrica; Ta-Ta mostró otras variantes y la consulta completa no dio coincidencia. | Pendiente: completar consultas alternativas/unidad y verificación de catálogo por cadena. |
| 001add91-2761-4a7a-b9b0-93faa1b7b394 | Chocolate LINDT Lindor Avellanas 100 g (publicado en Disco) | El Dorado y Ta-Ta | El Dorado API: “Chocolate LINDT Lindor Avellanas 100 g”; “LINDT Lindor Avellanas”; “Lindor Avellanas 100 g”; “Bombones Lindor avellana 100 gr”. El resultado más relevante fue Avellanas La Abundancia 100 g, marca/producto distinto. Ta-Ta: “Lindt Lindor Avellanas 100 g”; “Bombones Lindor Avellanas”; se mostraron Lindor 75 g o 200 g, sin la presentación de 100 g. | Pendiente: completar variantes y no afirmar ausencia definitiva. |
| 0020b9fa-cd32-4f99-8db4-68564283e457 | Crema Corporal Leocrema Nutritiva Karité 400 ml (publicado en Ta-Ta) | El Dorado investigado; Disco pendiente | El Dorado API: “Crema Corporal Leocrema Nutritiva Karite 400 Ml”; “Leocrema Nutritiva Karite 400 ml”; “Crema Karite Leocrema 400ml”; “Leocrema Karité 400 cc”. El candidato superior fue Nivea Body Milk Nutritiva 400 ml, marca equivocada y no disponible. | Parcial; Disco sigue sin revisar. No insertar. |

En todos los casos se evitó crear una nueva fila porque no hay candidato de identidad inequívoca y disponible verificado en todas las cadenas faltantes. No se alteró el producto canónico ni publicaciones existentes.

## Lote determinista guardado

El archivo product_store_coverage_progress.json registra la lista completa de 50 product_id, estado por producto, consultas exactas conocidas y cursor. Orden inicial:

1. 00002f47-a7b3-45e2-adb7-d51f0f5f4f0b
2. 000046e4-8328-4769-9ff5-deb93cc8202f
3. 00025f84-7956-403a-b79e-d74025f7f6ba
4. 000308f2-2a43-49f2-a9cc-3fba954acc1c

Al completar el lote, la siguiente ejecución iniciará la pasada siguiente según el cursor guardado; los casos parciales no se tratarán como brechas definitivas.
