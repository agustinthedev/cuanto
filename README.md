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
3. Aplicar las migraciones posteriores, incluida `supabase/migrations/202608260001_add_product_image_sources.sql`, las migraciones de propuestas `202608260002`, `202608260003`, `202608260004`, `202608260005` y `202608260006`, `supabase/migrations/202608270001_add_direct_product_creation.sql`, las migraciones `202608280001` y `202608280002`, `supabase/migrations/202609030001_add_product_measurements.sql` y `supabase/migrations/202609030002_add_product_tags.sql`.
4. Ejecutar `supabase/seed.sql` para crear Disco, Tienda Inglesa, Ta-Ta y categorías iniciales.
5. Copiar `apps/web/.env.example` como `.env.local` y completar:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SCRAPER_URL=https://cuanto-scraper.your-account.workers.dev
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

1. Abrir el modal de creación manual para cargar el título, la categoría, la cantidad, la unidad de medida y links `http(s)` opcionales por cadena; alcanza con cargar al menos uno.
2. Crear el producto canónico directamente con sus publicaciones activas, sin crear una propuesta pendiente.
3. Editar cualquiera de esos valores mientras una propuesta sugerida está pendiente.
4. Abrir cada publicación directamente desde el botón junto al link.
5. Aprobar una propuesta sugerida para crear el producto canónico y sus publicaciones activas, o rechazarla para dejarla fuera del catálogo.

La creación manual y la aprobación de sugerencias guardan la cantidad y la unidad de medida elegidas. Se admiten kilogramos (`kg`), gramos (`g`), litros (`L`), mililitros (`ml`) y unidades (`un`); la cantidad debe ser como mínimo `0.001` y puede tener hasta tres decimales.
La creación manual reutiliza el producto existente cuando coinciden el nombre normalizado, la categoría, la cantidad y la unidad, actualiza sus publicaciones y muestra una alerta si alguno de los links ya está asignado a otra publicación.
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

Configurar también la variable `CORS_ORIGIN` del Worker con el origen exacto de la web, por ejemplo `https://cuanto.uy` (en desarrollo, `http://localhost:5173`). El cron inicial es `0 7 * * *` en UTC dentro de `apps/scraper/wrangler.jsonc`; se puede cambiar allí. El endpoint `/health` es una comprobación pública. Los administradores autenticados pueden solicitar un scrape puntual con `POST /scrape/product` y un cuerpo `{ "product_id": "..." }`; el Worker valida el token de Supabase y procesa solo las publicaciones activas de ese producto.

### Fuentes verificadas y decisiones de adapters

- **Disco:** las páginas de producto entregan el precio en HTML server-rendered. Cuando hay precio web, el adapter toma el bloque original `.before` y no el valor `.price` rebajado. Los precios del sitio están condicionados al área de entrega (`?sc=...`), por lo que la URL guardada debe representar el contexto elegido.
- **Tienda Inglesa:** las páginas de producto exponen un bloque JSON con `Prices`; si aparece una etiqueta `Antes`, el adapter toma ese valor y no el precio promocional. Si no hay precio anterior, usa el precio normal. El sitio muestra explícitamente el contexto de stock/precio, como Montevideo, y puede mostrar precios ClubCard. El sitio puede responder con Cloudflare challenge a algunos requests; un error se registra como fallo, nunca como precio.
- **Ta-Ta:** el sitio usa VTEX/FastStore y sus precios dependen de la localidad. El adapter valida el contexto de **Montevideo y Ciudad de la Costa** (`postalCode: 11800`) mediante la API GraphQL pública y consulta el producto por slug. Toma `offers[].listPrice` antes de `offers[].price`, por lo que no registra el precio promocional. No requiere un secreto adicional en el MVP.
- **El Dorado:** el sitio usa VTEX y el adapter extrae el slug desde el link guardado para consultar la API pública `/api/catalog_system/pub/products/search/<slug>/p`. Antes de consultar productos configura y verifica la sesión regional de **Montevideo → Centro, Barrio Sur y Ciudad Vieja** (`SW#eldoradouy2099`), conserva sus cookies por corrida y toma `commertialOffer.ListPrice` antes de `commertialOffer.Price`. También obtiene la imagen desde la respuesta JSON y no requiere un secreto adicional en el MVP.

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

Las variables de entorno del proyecto son `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_SCRAPER_URL`. Configurarlas en **Settings → Environment variables** para los entornos Production y Preview según corresponda; `VITE_SCRAPER_URL` debe apuntar a la URL pública del Worker, por ejemplo `https://cuanto-scraper.your-account.workers.dev`. Para conectar `cuanto.uy`, agregar el dominio personalizado en Pages y apuntar el DNS según el instructivo que muestra Cloudflare; no se debe configurar ninguna service-role key en Pages.

## Alcance actual

Incluido: catálogo manual, categorías, búsqueda, imágenes de producto aportadas automáticamente por las cadenas, comparación actual por cadena, promedio histórico, historia por cadena, estadísticas reales, panel admin con Supabase Auth, propuestas de productos con RLS y aprobación transaccional, adapters activos para Disco, Tienda Inglesa, Ta-Ta y El Dorado, y cron tolerante a fallos.

Fuera de alcance: registro público de cuentas, carrito, matching automático, promociones complejas, alertas, inflación, app móvil, SSR, scraping de descubrimiento y colas.

## Pruebas

```bash
npm test
```

Las fixtures cubren puntos como separador de miles (`$ 1.299` → `1299`), decimales con coma (`$ 129,90` → `129.90`), precio de lista de Ta-Ta por JSON-LD/HTML/API, el parser diferido de Red Express y el upsert diario.
