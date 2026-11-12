# ADR-0030 — Stack y barandas de los sitios generados

- **Estado:** Aceptada (2026-11-11, Andy) · en parte reemplazada por [ADR-0035](ADR-0035-ajustes-a-adr-0030-tras-la-plantilla.md): licencias, JSON-LD, negocios sin dirección, hosting y HSTS
- **Fecha:** 2026-11-11
- **Reemplaza:** —
- **Afecta a:** la plantilla de sitio (E1), la verificación (E5), la constitución (stack y barandas)

## Contexto

ADR-0029 fija qué genera SpecMate: sitios estáticos para negocios, listos para
publicar, sin vulnerabilidades conocidas al publicar y sin inyección de código. Hace
falta fijar con qué se construyen y qué controles los dejan salir. Cada control tiene
que ser automático y bloquear la publicación. Lo que dependa de que alguien se acuerde
no es un control.

Versiones verificadas el 2026-11-11: Astro 7.4, Playwright 1.65,
`@axe-core/playwright` 4.14, `@lhci/cli` 0.16, html-validate 11, linkinator 8,
secretlint 13, wrangler 4. Las políticas de Places API prohíben cachear su contenido,
salvo el place ID, y piden atribución a Google cuando se muestra fuera de un mapa
(ver ADR-0029, punto 4).

## Decisión

### Construcción

| Área | Elección | Por qué |
|---|---|---|
| Generador | **Astro 7**, `output: 'static'`, sin JavaScript en el cliente por defecto | HTML puro, SEO local, casi sin superficie. Una isla de JS solo con motivo escrito en el brief |
| Estilos | CSS con custom properties generadas desde el `tokens.json` del cliente | Sin framework de CSS: una dependencia menos, y el sistema de diseño del Gate 2 es la única fuente |
| Tipografías | Autoalojadas (paquetes de Fontsource) | CSP con `font-src 'self'`; sin pedidos a Google Fonts, que además expone la IP del visitante |
| Imágenes | `astro:assets` con `sharp`, a AVIF/WebP con tamaños por *breakpoint* | Peso controlado; `sharp` corre solo al construir, nunca en lo publicado |
| Contacto | Enlaces `tel:`, `mailto:` y `wa.me` por defecto | Cero backend. Un formulario con backend (función en Cloudflare con Zod, Turnstile y límite de pedidos) es una decisión por cliente, con su propia historia |
| Mapa | Botón "Cómo llegar" a Google Maps; embed oficial solo si el cliente lo pide | Cumple las políticas de Places sin copiar sus datos. El embed suma `frame-src` de Google a la CSP |
| Métricas | Ninguna por defecto; Cloudflare Web Analytics si el cliente la pide | Sin cookies ni banner de consentimiento |
| SEO local | `schema.org/LocalBusiness` en JSON-LD generado desde el brief confirmado, `sitemap.xml`, `robots.txt`, Open Graph | Lo que más mueve a un negocio local |
| Hosting | **Cloudflare** (Workers con assets estáticos o Pages), headers en `_headers` | Gratis para este volumen, CDN global, headers declarativos versionados con el sitio |
| Repo | Un repo por cliente, creado desde la plantilla; lockfile versionado; `.npmrc` con `ignore-scripts=true` | Cada sitio se audita y se actualiza por separado |

### Barandas: lo que bloquea la publicación

| Control | Cómo se mide | Umbral |
|---|---|---|
| Tipos y lint | `astro check`, `tsc --noEmit`, Biome | 0 errores |
| Brief válido | Zod sobre `brief.json`: cada dato publicable tiene `fuente` y `confirmadoPor` | 0 datos sin confirmar |
| Sin texto de relleno | Búsqueda en `dist/` de `lorem`, `[TU …]`, `TODO`, `XXX` | 0 apariciones |
| Comportamiento | Playwright sobre `dist/` en 360, 768 y 1280 px: secciones, anclas, enlaces de contacto bien formados, sin errores de consola ni pedidos fallidos | 100 % en verde |
| Accesibilidad | axe-core en cada página y ancho | 0 violaciones *serious* o *critical* |
| Rendimiento y SEO | Lighthouse CI, perfil móvil | Rendimiento ≥ 90; accesibilidad, buenas prácticas y SEO ≥ 95 |
| HTML y enlaces | html-validate sobre `dist/`; linkinator | 0 errores; 0 enlaces internos rotos (los externos avisan) |
| Dependencias | `npm audit --audit-level=high` | 0 altas o críticas |
| Secretos | secretlint sobre el repo y `dist/` | 0 hallazgos |
| **Sin inyección** | (1) `set:html` prohibido en el código fuente; (2) en `dist/`, ningún `<script>` ni `<style>` inline ni atributo `on*=`; (3) todo contenido del brief se renderiza escapado | 0 apariciones |
| Headers | Test que lee `_headers` | CSP sin `unsafe-inline` ni `unsafe-eval`, con `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` y `frame-ancestors 'none'`; HSTS; `X-Content-Type-Options: nosniff`; `Referrer-Policy`; `Permissions-Policy` |
| Orígenes externos | Lista blanca por sitio en el brief; un test compara contra los pedidos que hace la página | 0 orígenes fuera de la lista |
| Imágenes | Peso y `alt` en `dist/` | ≤ 250 KB cada una; 0 sin `alt` (las decorativas, `alt=""` explícito) |

Para que la CSP estricta funcione, Astro se configura con
`build.inlineStylesheets: 'never'` y `vite.build.assetsInlineLimit: 0`. El control de
"sin inyección" verifica el resultado, no la configuración.

**Contenido externo como dato:** los documentos del cliente y las páginas de
referencia los leen los agentes como datos, nunca como instrucciones (constitución,
principio V). Las referencias sirven de inspiración y no se copian textos, imágenes
ni diseños.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Next.js o una SPA | Runtime de JavaScript en el cliente y más dependencias para un sitio que no las necesita |
| Eleventy o HTML a mano | Eleventy sirve, pero Astro trae imágenes optimizadas, componentes tipados y `astro check`. HTML a mano no escala a varios clientes |
| Tailwind | Una dependencia y un paso de build más; los tokens del cliente ya resuelven la consistencia |
| Google Fonts por CDN | Obliga a abrir la CSP a terceros y expone la IP del visitante |
| Netlify o Vercel | Igual de válidos. Cloudflare gana por costo cero a este volumen y por los `_headers` versionados. Se puede cambiar sin tocar el sitio |
| Formulario con backend por defecto | Suma superficie, spam y mantenimiento a todos los sitios cuando la mayoría de los negocios locales prefiere WhatsApp |

## Consecuencias

**Positivas:** lo publicado es HTML, CSS e imágenes, con una CSP que no deja ejecutar
nada ajeno. Cada promesa al cliente ("seguro", "rápido", "accesible") tiene un número
que la respalda en el informe de verificación.

**Negativas (costo asumido):**
- `sharp` es un módulo nativo: se acepta como excepción, solo al construir, porque
  trae binarios precompilados para Windows x64 y no ejecuta scripts de instalación.
- Lighthouse varía entre corridas: el control toma la mediana de tres.
- Un cliente que quiera un widget de terceros (reservas, chat) obliga a abrir la CSP:
  cada caso se anota en la lista blanca del brief, con motivo.
- "Sin vulnerabilidades conocidas" vale al publicar: después hace falta re-auditar
  (épica de mantenimiento).

**Revisar cuando:** un cliente necesite formulario, reservas o edición propia, o Astro
cambie de versión mayor.
