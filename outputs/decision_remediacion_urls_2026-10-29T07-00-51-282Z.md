# Revisión de fallos — run 2026-10-29T07:00:51.282Z

Revisión retrospectiva del 3/11/2026, 11:34 UYT. No se inició un scrape, un worker ni se consumió Queue.

## Finalización y alcance

El último intento observado fue el 29/10/2026 09:59:48.912 UTC (El Dorado); los últimos intentos de las cadenas activas terminaron entre 09:56:09 y 09:59:49 UTC. No hubo intentos posteriores para este run y el margen de 60 minutos se cumplió ampliamente.

Tienda Inglesa tenía 92 publicaciones en el run, pero estaba inactiva y se excluyó. Se revisaron solamente Disco, El Dorado y Ta-Ta:

| Cadena activa | Publicaciones | Éxito | 404 | Sin producto/oferta | Sin precio positivo |
|---|---:|---:|---:|---:|---:|
| Disco | 1.472 | 1.472 | 0 | 0 | 0 |
| El Dorado | 474 | 434 | 0 | 29 | 11 |
| Ta-Ta | 1.389 | 1.296 | 93 | 0 | 0 |

Los 133 errores activos se desglosan en 93 respuestas 404 de Ta-Ta, 29 respuestas HTTP 200 sin oferta y 11 respuestas HTTP 200 sin precio positivo de El Dorado.

## Transición a la siguiente ejecución

Al comparar el último intento por publicación en runs consecutivos, 15 fallos 404 de Ta-Ta del 28/10 ya no fallaron el 29/10. En El Dorado, un caso “sin oferta” y uno “sin precio positivo” del 28/10 se recuperaron; las demás publicaciones persistentemente fallidas se volvieron a observar el 30/10 y se detallan allí. Estos cambios de estado no se interpretan como cambios de URL.

No se hicieron búsquedas de reemplazo independientes para fallos transitorios de este run ni se modificó ninguna fila a partir únicamente de él. Los errores de precio no se tratan como URL rota.
