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
3. Aplicar las migraciones posteriores, incluida `supabase/migrations/202608260001_add_product_image_sources.sql` y las migraciones de propuestas `202608260002`, `202608260003`, `202608260004`, `202608260005` y `202608260006`.
4. Ejecutar `supabase/seed.sql` para crear Disco, Tienda Inglesa, Ta-Ta y categorías iniciales.
5. Copiar `apps/web/.env.example` como `.env.local` y completar:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

La anon key es pública y solo permite lecturas públicas. RLS y los grants bloquean cambios anónimos; las mutaciones del panel pasan por Supabase Auth, RLS y funciones SQL con `security definer`. La `SUPABASE_SERVICE_ROLE_KEY` nunca debe entrar en `apps/web`.

### Habilitar el acceso de administrador

La contraseña no se configura en el código ni en una variable `VITE_*`. Supabase Auth la almacena y valida de forma segura. Para habilitar el primer administrador:

1. En Supabase Dashboard, ir a **Authentication → Users** y crear el usuario con un email y una contraseña fuerte. Se puede exigir confirmación de email desde la configuración de Auth.
2. Copiar el UUID del usuario y ejecutar en el SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('UUID-DEL-USUARIO')
on conflict (user_id) do nothing;
```

La tabla de administradores guarda únicamente UUIDs, no contraseñas. Luego se ingresa en `/admin/login`. No se debe copiar la service-role key al navegador ni commitear archivos `.env.local`.

### Panel de administración

Desde `/admin`, un administrador puede ver el resumen del catálogo, la actividad reciente de precios y el estado de las propuestas. La revisión y carga manual de productos se encuentra en `/admin/productos-sugeridos`.

### Cargar y revisar productos sugeridos

Desde `/admin/productos-sugeridos`, un administrador puede:

1. Cargar el título, la categoría y un link `http(s)` por cada cadena configurada.
2. Editar cualquiera de esos valores mientras la propuesta está pendiente.
3. Abrir cada publicación directamente desde el botón junto al link.
4. Aprobar la propuesta para crear el producto canónico y sus publicaciones activas, o rechazarla para dejarla fuera del catálogo.

La aprobación crea por defecto un producto de cantidad `1` y unidad `un`, porque la propuesta inicial solo solicita título, categoría y links. Si se necesita una presentación distinta, se debe incluir la cantidad en el título o ampliar el formulario antes de aprobar.
Las propuestas pendientes son editables; las ya aprobadas o rechazadas quedan bloqueadas para no desincronizar el registro de revisión del producto canónico.

No hace falta cargar `products.image_url` ni `store_products.image_url`: el scraper intenta obtener la imagen desde la publicación de cada cadena y la guarda automáticamente.

No se incluyen productos de ejemplo ni precios históricos ficticios en producción.

## Scraper Worker

El Worker carga todas las publicaciones activas, elige el adapter por `stores.slug`, obtiene el precio original/de lista —sin descuentos ni promociones— y hace upsert en `prices` con la clave `(store_product_id, date)`. Un fallo individual se registra como JSON en los logs y no detiene las demás publicaciones.

Cuando un adapter encuentra una imagen, la guarda en `store_products.image_url` junto con `image_fetched_at`. Si el producto canónico todavía no tiene imagen, la primera publicación disponible la dona a `products.image_url`; también queda registrada en `products.image_source_store_product_id`. La prioridad actual de donantes es Disco, Tienda Inglesa, Ta-Ta y Red Express. Una imagen existente —incluida una cargada manualmente— no se reemplaza automáticamente.

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
- **Ta-Ta:** el sitio usa VTEX/FastStore y sus precios dependen de la localidad. El adapter valida el contexto de **Montevideo y Ciudad de la Costa** (`postalCode: 11800`) mediante la API GraphQL pública y consulta el producto por slug. Toma `offers[].listPrice` antes de `offers[].price`, por lo que no registra el precio promocional. No requiere un secreto adicional en el MVP.

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

Incluido: catálogo manual, categorías, búsqueda, imágenes de producto aportadas automáticamente por las cadenas, comparación actual por cadena, promedio histórico, historia por cadena, estadísticas reales, panel admin con Supabase Auth, propuestas de productos con RLS y aprobación transaccional, adapters activos para Disco, Tienda Inglesa y Ta-Ta, y cron tolerante a fallos.

Fuera de alcance: registro público de cuentas, carrito, matching automático, promociones complejas, alertas, inflación, app móvil, SSR, scraping de descubrimiento y colas.

## Pruebas

```bash
npm test
```

Las fixtures cubren puntos como separador de miles (`$ 1.299` → `1299`), decimales con coma (`$ 129,90` → `129.90`), precio de lista de Ta-Ta por JSON-LD/HTML/API, el parser diferido de Red Express y el upsert diario.
