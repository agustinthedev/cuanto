# Revisión de fallos — run 2026-10-28T07:00:51.282Z

Revisión retrospectiva del 3/11/2026, 11:34 UYT. No se inició un scrape, un worker ni se consumió Queue.

## Finalización y alcance

El último intento observado fue el 28/10/2026 09:55:24.681 UTC (Tienda Inglesa); los últimos intentos de las cadenas activas terminaron entre 09:55:05 y 09:55:20 UTC. No hubo intentos posteriores para este run y el margen de 60 minutos se cumplió ampliamente.

Tienda Inglesa tenía 92 publicaciones en el run, pero estaba inactiva y se excluyó. Se revisaron solamente Disco, El Dorado y Ta-Ta:

| Cadena activa | Publicaciones | Éxito | 404 | Sin producto/oferta | Sin precio positivo |
|---|---:|---:|---:|---:|---:|
| Disco | 1.472 | 1.472 | 0 | 0 | 0 |
| El Dorado | 474 | 438 | 0 | 25 | 11 |
| Ta-Ta | 1.389 | 1.298 | 91 | 0 | 0 |

Los 127 errores activos se desglosan en 91 respuestas 404 de Ta-Ta, 25 respuestas HTTP 200 sin oferta de El Dorado y 11 respuestas HTTP 200 sin precio positivo de El Dorado.

## Decisión

No se hicieron búsquedas de reemplazo independientes para los fallos históricos de este run: se priorizó revisar las publicaciones que siguieron fallando en los runs posteriores del 29 y 30 de octubre, evitando buscar de nuevo los casos que se recuperaron. Por tanto, este informe no concluye que los 127 casos carezcan de reemplazo; cualquier producto que ya no aparezca entre los fallos del 30/10 se considera recuperado en una ejecución posterior, y las publicaciones persistentemente fallidas se documentan en el informe del 30/10.

No se cambió ninguna fila a partir únicamente de este run.
