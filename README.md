# Cuánto.uy

Cuánto.uy es un MVP público para comparar precios de supermercados en Uruguay y construir una historia diaria de cada producto. La interfaz está en español, usa pesos uruguayos y no inventa datos cuando la base todavía está vacía.

## Arquitectura

```text
apps/web        React + TypeScript + Vite + React Router
                └── lecturas públicas con Supabase anon key

apps/scraper    Cloudflare Worker + Cron Trigger diario
                └── adapters HTML/JSON → Supabase REST con service role

supabase/       migración PostgreSQL, RLS, vistas de agregación y seed
```

La aplicación web es una SPA estática. `apps/web/public/_redirects` hace que Cloudflare Pages devuelva `index.html` para rutas como `/productos/<id>`. No hay servidor Node permanente ni SSR.

La agregación histórica vive en PostgreSQL:

- `latest_store_product_prices`: última observación válida por publicación.
- `product_daily_average_prices`: promedio diario entre las observaciones disponibles, sin contar ausencias como cero.
- `product_daily_store_prices`: historia por cadena.
- `price_observation_days`: fechas con al menos una observación, usada para estadísticas.

## Desarrollo local

Requiere Node.js 20+.

```bash
npm install
npm run dev
```

En Windows PowerShell, si la política de ejecución bloquea `npm.ps1`, usar `npm.cmd install`, `npm.cmd run dev`, etc.

La web también puede validarse con:

```bash
npm run lint
npm run typecheck
npm run build
```

## Supabase

1. Crear un proyecto gratuito en Supabase.
2. Aplicar `supabase/migrations/202608250001_initial_schema.sql` desde el SQL Editor o con Supabase CLI.
3. Ejecutar `supabase/seed.sql` para crear Disco, Tienda Inglesa, Ta-Ta y categorías iniciales.
4. Copiar `apps/web/.env.example` como `.env.local` y completar:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

La anon key es pública y solo permite lecturas. RLS y los grants de la migración bloquean inserts, updates y deletes públicos. La `SUPABASE_SERVICE_ROLE_KEY` nunca debe entrar en `apps/web`.

### Cargar un producto manualmente

La administración queda intencionalmente fuera del MVP. Desde Table Editor:

1. Crear o elegir una categoría en `categories`.
2. Crear el producto canónico en `products` (`quantity` es numérico y `unit` puede ser `L`, `g`, `kg`, `un`, etc.).
3. Crear una fila en `store_products` por cadena donde exista el producto.
4. Pegar la URL o referencia exacta que usará el adapter.
5. Dejar `active = true` para incluirla en el próximo cron.

No se incluyen productos de ejemplo ni precios históricos ficticios en producción.

## Scraper Worker

El Worker carga todas las publicaciones activas, elige el adapter por `stores.slug`, obtiene el precio original/de lista —sin descuentos ni promociones— y hace upsert en `prices` con la clave `(store_product_id, date)`. Un fallo individual se registra como JSON en los logs y no detiene las demás publicaciones.

Variables locales de ejemplo: `apps/scraper/.dev.vars.example`.

Para desarrollo:

```bash
npm run scraper:dev
```

Para desplegar, configurar los secretos sin commitearlos:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run scraper:deploy
```

El cron inicial es `0 7 * * *` en UTC dentro de `apps/scraper/wrangler.jsonc`; se puede cambiar allí. El endpoint `/health` es solo una comprobación pública; no existe un endpoint público para disparar scrapes manuales.

### Fuentes verificadas y decisiones de adapters

- **Disco:** las páginas de producto entregan el precio en HTML server-rendered. Cuando hay precio web, el adapter toma el bloque original `.before` y no el valor `.price` rebajado. Los precios del sitio están condicionados al área de entrega (`?sc=...`), por lo que la URL guardada debe representar el contexto elegido.
- **Tienda Inglesa:** las páginas de producto exponen un bloque JSON con `Prices`; si aparece una etiqueta `Antes`, el adapter toma ese valor y no el precio promocional. Si no hay precio anterior, usa el precio normal. El sitio muestra explícitamente el contexto de stock/precio, como Montevideo, y puede mostrar precios ClubCard. El sitio puede responder con Cloudflare challenge a algunos requests; un error se registra como fallo, nunca como precio.
- **Ta-Ta:** el sitio usa VTEX. El adapter extrae el slug de la URL y consulta el catálogo JSON público `https://tatauy.myvtex.com/api/catalog_system/pub/products/search/<slug>/p`, tomando `items[].sellers[].commertialOffer.ListPrice` antes de `Price`. No requiere un secreto adicional en el MVP.

Red Express queda diferido porque su precio puede depender del local o contexto de compra. El adapter y el soporte opcional de `store_locations` se conservan para retomarlo más adelante, pero no forman parte del flujo activo ni requieren secretos en este MVP.

Cuando se retome Red Express, una referencia estable puede ser el endpoint de código de barras:

```text
https://redexpres.superencasa.com.uy/products-app-en-casa/v4/super-en-casa/articulos/codigos-barras/<barcode>?empresa=8062&local=<codigoLocal>
```

El token Basic requerido deberá guardarse solo como secret del Worker. No se debe copiar el token que la app pública pueda llevar en su JavaScript.

### Agregar otra cadena

1. Crear `apps/scraper/src/stores/<slug>.ts` implementando `StoreScraper`.
2. Exponer una función de parseo pura para poder probarla con una fixture.
3. Registrar el adapter en `apps/scraper/src/stores/index.ts`.
4. Agregar HTML/JSON mínimo a `apps/scraper/src/fixtures` y una prueba.
5. Crear la cadena en `stores` y sus publicaciones en Supabase.

## Cloudflare Pages

Configurar el proyecto Pages con:

```text
Build command: npm run build
Output directory: apps/web/dist
```

Las variables de entorno del proyecto son `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Para conectar `cuanto.uy`, agregar el dominio personalizado en Pages y apuntar el DNS según el instructivo que muestra Cloudflare; no hay secretos adicionales de Pages.

## Alcance actual

Incluido: catálogo manual, categorías, búsqueda, comparación actual por cadena, promedio histórico, historia por cadena, estadísticas reales, RLS de solo lectura, adapters activos para Disco, Tienda Inglesa y Ta-Ta, y cron tolerante a fallos.

Fuera de alcance: cuentas, login, carrito, matching automático, panel admin, promociones complejas, alertas, inflación, app móvil, SSR, scraping de descubrimiento y colas.

## Pruebas

```bash
npm test
```

Las fixtures cubren puntos como separador de miles (`$ 1.299` → `1299`), decimales con coma (`$ 129,90` → `129.90`), respuestas JSON de Ta-Ta, el parser diferido de Red Express y el upsert diario.
