# ADR-0035 — Ajustes a ADR-0030 tras probar la plantilla: licencias, JSON-LD, negocios sin dirección y hosting

- **Estado:** Aceptada (2026-11-12, Andy: "perfecto")
- **Fecha:** 2026-11-12
- **Reemplaza:** ADR-0030 en parte (filas *Mapa*, *SEO local* y *Hosting*, el control *Sin inyección* y el header HSTS)
- **Afecta a:** `templates/site` (E1), controles de `verify` (E5), esquema del brief (E2), constitución (licencias)

## Contexto

US-09 probó la plantilla de ADR-0030 publicada en Cloudflare (`docs/spike/informe.md`,
incógnita 4: sí). Dejó siete pedidos de cambio, y el developer agregó una decisión:
Maps no es requisito y hay negocios **sin dirección física** (online, a domicilio).
E1 arranca antes de cerrar el spike, así que estos puntos se deciden ahora en vez de
en US-10. Los dos que cambian el código de la plantilla son el JSON-LD (ADR-0030 lo
pide, pero su propio control "sin inyección" lo prohíbe) y las licencias (Fontsource
es OFL-1.1, fuera de la lista de la constitución).

## Decisión

### Licencias (enmienda 2.2.0 de la constitución)
- Lo que **se publica en `dist/`** admite, además de MIT, Apache-2.0, BSD e ISC:
  **OFL-1.1 solo para fuentes** y **CC0-1.0** para cualquier asset.
- Lo que **solo corre al construir** y no se publica admite también **MPL-2.0,
  LGPL-3.0 y BlueOak-1.0.0**. GPL y AGPL siguen vedadas en todo.
- Una licencia fuera de estas listas pide su propia excepción (como el Agent SDK).

### JSON-LD
- El `schema.org` va **en JSON-LD inline**, en un único `<script type="application/ld+json">`
  por página. Es un bloque de datos: el navegador no lo ejecuta y la CSP
  (`script-src 'none'`) no lo bloquea.
- Se genera **solo con un serializador** de la plantilla que parte del brief confirmado
  y escapa `<`, `>` y `&` como `<`, `>` y `&`. Escribirlo a mano
  queda prohibido.
- El control *Sin inyección* acepta exactamente eso y nada más: un bloque por página,
  `type="application/ld+json"` exacto, contenido que parsea como JSON y sin `<`. Todo
  otro `<script>` sigue siendo 0.

### Negocios sin dirección física y sin Maps
- La dirección y la URL de Maps son **opcionales** en el brief.
- Tipo de `schema.org`, por caso:
  - Con dirección pública: `LocalBusiness`, o el subtipo del rubro, con `address`.
  - Atiende en una zona sin local a la calle: `LocalBusiness` con `areaServed` y sin `address`.
  - Solo online: `Organization` con `url` y `contactPoint`.
- El botón **"Cómo llegar"** y la sección de ubicación van **solo con una dirección
  confirmada**. El enlace se arma desde esa dirección (búsqueda de Google Maps), nunca
  con datos de Places.

### Hosting y headers
- Hosting en **Cloudflare Workers con assets estáticos** (no Pages), con
  `not_found_handling: "none"` o `"404-page"` y un `404.html`, para que una ruta
  inexistente devuelva un 404 real.
- HSTS **sin `includeSubDomains`** por defecto: `max-age=31536000`. Se suma
  `includeSubDomains` solo si el cliente confirma que todos sus subdominios sirven HTTPS.
- Con dominio propio, la "Email Obfuscation" de la zona va **apagada**, porque inyecta un
  script que la CSP bloquea.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| JSON-LD en un archivo externo (`<link>` o `src`) | Google no lee JSON-LD desde un archivo externo: se pierde el SEO local, que es lo que más mueve a un negocio chico |
| Microdata (`itemscope`/`itemprop`) en lugar de JSON-LD | Sin script, pero acopla el SEO al marcado de cada sección de la biblioteca (E4). Cada sección nueva tendría que saber de schema.org |
| Sin datos estructurados | Pierde el SEO local que ADR-0030 promete al cliente |
| Hash de la CSP para el JSON-LD | Innecesario: un bloque de datos no se ejecuta. Sumar el hash abriría `script-src`, que hoy está en `'none'` |
| Mantener la lista de licencias y reemplazar Fontsource | No hay una alternativa de fuentes autoalojadas con licencias MIT o Apache y la misma calidad: casi todas las tipografías libres son OFL |
| `LocalBusiness` siempre, con una dirección ficticia o vacía | Viola el principio XI (nada sin fuente) y las guías de Google |
| Cloudflare Pages | Sin `404.html` devuelve `index.html` con 200 en cualquier ruta (soft-404) |

## Consecuencias

**Positivas:** E1 arranca sin decisiones abiertas. Los sitios mantienen el SEO local
con la CSP en `script-src 'none'`. La fábrica atiende negocios sin local y sin Maps.

**Negativas (costo asumido):**
- El control *Sin inyección* deja de ser "0 scripts" y pasa a tener una excepción. Si
  esa excepción queda mal definida, abre una vía de inyección. Por eso es tan estricta
  y se prueba con casos adversos (`</script>` en un dato del brief, dos bloques, otro
  `type`).
- La lista de licencias crece. Separar "se publica" de "solo al construir" exige saber,
  por cada dependencia, en cuál de los dos grupos cae.
- **LGPL-3.0 (libvips, dentro de sharp):** se acepta porque solo corre al construir y no
  se distribuye. Es una lectura técnica, no un dictamen legal. **Si el producto se
  ofrece a terceros (E10), hace falta confirmarla con alguien que sepa de licencias.**
- Sin `includeSubDomains`, el primer pedido a un subdominio no queda protegido por HSTS.

**Cómo se impone:**
- JSON-LD: test sobre `dist/` en la plantilla (E1), con los casos adversos y un caso por
  cada tipo de schema.
- **Supuestos a probar en E1, antes de dar el JSON-LD por cerrado** (al 2026-11-12 solo
  hay fuentes de la comunidad, no documentación oficial):
  - Que la CSP con `script-src 'none'` no bloquea el bloque: test de Playwright en
    Chromium y Firefox con 0 violaciones de CSP en consola.
  - Que Google lo lee: Rich Results Test sobre el sitio publicado.

  Si alguno falla, la ADR se revisa antes de seguir.
- Licencias: test en E1 que lee el lockfile, separa `dependencies` de
  `devDependencies` y compara cada licencia contra su lista. Hasta que exista: `(sin gate)`.
- Hosting y HSTS: el test de `_headers` y un `wrangler.jsonc` versionado en la plantilla.
- Tipo de schema según el brief: test tabular, un caso por variante (E1, y E2 cuando
  exista el esquema del brief).

**Revisar cuando:** el producto se ofrezca a terceros (E10, licencias); Google deje de
leer JSON-LD inline o recomiende otra forma; o un cliente necesite un widget que abra
`script-src`.
