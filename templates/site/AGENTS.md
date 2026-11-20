# templates/site

La plantilla de la que sale cada sitio de cliente (ADR-0030, ADR-0035, ADR-0037).
`specmate new` la copia a un repo propio del cliente; no es un workspace de este
monorepo.

## Invariantes de todo sitio

- **Astro 7, salida estática, sin JavaScript en el cliente** salvo una isla con motivo
  escrito en el brief.
- **Nada inline:** ni `<script>` ni `<style>` ni atributos `on*=` ni `style=` en `dist/`.
  La CSP no lleva `unsafe-inline` ni `unsafe-eval` (`script-src 'none'`).
- **Única excepción: el JSON-LD** (ADR-0035). Un solo `<script type="application/ld+json">`
  por página, generado por `src/lib/jsonld.ts`, que escapa `<`, `>` y `&`. `set:html` solo
  existe en `src/components/JsonLd.astro` y solo recibe esa salida (ADR-0037). Los tests
  `no-inline-code` y `no-set-html` lo imponen.
- **El sitio se construye desde `relevamiento.json`** (US-14), en la raíz del repo: `$schemaVersion`, el `brief`
  con lo que el sitio publica y, opcional, `steps` (el build lo ignora). Lo valida `parseRelevamiento`
  (`src/lib/site.ts`), la única definición del esquema, al construir: todo dato publicable lleva `source` y
  `confirmedBy` (quién, cómo y cuándo); un obligatorio sin ellos rompe el build nombrando su ruta
  (`brief.contact.email.confirmedBy`); un opcional sin `confirmedBy` no se publica; una clave desconocida rompe el
  build. Obligatorios: `site.url` (https, solo el origen; vale la de Workers), `name`, `tagline`, `about` y **un
  canal de contacto confirmado** (`contact.phone`, `contact.whatsapp` o `contact.email`, canales separados: un
  WhatsApp no genera "Llamar"). Opcionales: horarios, dirección, zona, `geo`, `mapsUrl`, perfiles, FAQ, `sections`
  (contenido libre: texto o lista) y `logo` (claro y oscuro, SVG, PNG, JPEG o WebP directamente en `src/assets/brand/`, nunca fuera del repo).
  El logo se lee de la ruta validada y se procesa con `sharp` directamente (`src/lib/logo.ts`), no con
  `astro:assets`, para que solo el archivo confirmado llegue a `dist/` (`src/pages/brand/[file].ts`): el SVG tal
  cual; un raster pasa a AVIF y WebP al doble del alto del header y el original no se publica. Otro formato rompe el
  build.
  `SITE_DATA` elige otro archivo (las variantes y los fixtures de los tests); los ejemplos son
  `src/data/examples/*.relevamiento.json`, inventados y marcados.
- **Todo el contenido sale del brief confirmado** y se renderiza escapado. Nada de
  texto de relleno, testimonios o preguntas frecuentes inventadas, ni datos copiados de
  Google Maps o Places.
- **Maps y la dirección son opcionales.** El schema.org sale del caso: `LocalBusiness`
  con `address`, `LocalBusiness` con `areaServed`, u `Organization` para negocios solo
  online. "Cómo llegar" y la sección de ubicación aparecen solo con dirección confirmada; el enlace usa el
  `mapsUrl` confirmado si existe y si no la dirección. `geo` va al JSON-LD solo con dirección.
- **GEO y AEO:** los datos del negocio coinciden entre el HTML, el JSON-LD y los
  metadatos; los crawlers de IA están permitidos por defecto en `robots.txt`
  (`src/lib/ai-crawlers.ts`), con un ajuste por sitio para bloquearlos. Sin `llms.txt`.
- **Estilos desde `src/data/tokens.json`** (custom properties en `/tokens.css`), sin
  valores sueltos en el CSS escrito a mano; fuentes autoalojadas.
- **Orígenes externos solo de la lista blanca del brief**, con motivo: `brief.allowedOrigins`
  (`{ origin, reason }`, https exacto) en `relevamiento.json`; vacía en las 3 variantes.
- `_headers` versionado con CSP, HSTS (sin `includeSubDomains` por defecto), `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y COOP. Hosting en Cloudflare Workers con
  `not_found_handling: "404-page"`.
- Dependencias fijadas, lockfile versionado y `ignore-scripts=true`. En `dependencies`
  solo lo que termina en `dist/`; el resto en `devDependencies`. El test de licencias
  controla los dos grupos (constitución 2.2.1).
- **LF en todos los archivos** (`.gitattributes`); Biome formatea con LF.
- **Controles de ADR-0030** (US-12, zona crítica): un script por control en `scripts/controls/`, cada uno con
  `run(dir) → { ok, violations }` y salida ≠ 0 si no cumple su umbral. Un control que no puede medir falla, no pasa
  (constitución VI). Cada uno tiene su sitio que falla a propósito (`test/lib/mutations-*.mjs`) y
  `controls-isolation` prueba que cada mutación rompe solo su control. `check:origins` mide en el navegador y además
  lee `dist/` estáticamente (preconnect, srcset, CSS). `check:links` trata como interno un enlace escrito con la URL
  canónica del sitio (la de `rel="canonical"`) y lo pide al servidor local (#47). Lighthouse sin LHCI, mediana
  de 3, sin la auditoría `robots-txt` (la bloquea nuestra CSP) y con el puerto de DevTools elegido por Chromium
  (#48); `@sentry/node` es un stub local que lanza si se importa (ADR-0038).
- **Licencias fuera de lista solo por excepción de paquete** (`LICENSE_EXCEPTIONS` en `test/lib/licenses.mjs`,
  ADR-0038); `sentry` y `oxc-parser` no pueden volver al lockfile.

## Comandos

`npm run build` · `npm test` (construye las variantes de ejemplo y corre todo, incluida la
CSP en Chromium y Firefox con Playwright y los sitios que fallan a propósito; ~6-7 min) · `npx astro check` ·
`npx biome check .`

Controles: `npm run check:<behavior|a11y|lighthouse|html|links|secrets|origins> [dir]` sobre un build (por
defecto `dist`; `check:origins` toma `--data <relevamiento.json>`) · `npm run check:deps` (`npm audit --audit-level=high`
sobre todo el árbol; necesita red) · `npm run controls` corre todos sobre las 3 variantes (antes:
`npm run build:variants`).
