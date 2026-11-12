# templates/site

La plantilla de la que sale cada sitio de cliente (ADR-0030, ADR-0035, ADR-0036).
`specmate new` la copia a un repo propio del cliente; no es un workspace de este
monorepo.

## Invariantes de todo sitio

- **Astro 7, salida estática, sin JavaScript en el cliente** salvo una isla con motivo
  escrito en el brief.
- **Nada inline:** ni `<script>` ni `<style>` ni atributos `on*=` ni `style=` en `dist/`.
  La CSP no lleva `unsafe-inline` ni `unsafe-eval` (`script-src 'none'`).
- **Única excepción: el JSON-LD** (ADR-0035). Un solo `<script type="application/ld+json">`
  por página, generado por `src/lib/jsonld.ts`, que escapa `<`, `>` y `&`. `set:html` solo
  existe en `src/components/JsonLd.astro` y solo recibe esa salida (ADR-0036). Los tests
  `no-inline-code` y `no-set-html` lo imponen.
- **Todo el contenido sale del brief confirmado** y se renderiza escapado. Nada de
  texto de relleno, testimonios o preguntas frecuentes inventadas, ni datos copiados de
  Google Maps o Places.
- **Maps y la dirección son opcionales.** El schema.org sale del caso: `LocalBusiness`
  con `address`, `LocalBusiness` con `areaServed`, u `Organization` para negocios solo
  online. "Cómo llegar" y la sección de ubicación aparecen solo con dirección confirmada.
- **GEO y AEO:** los datos del negocio coinciden entre el HTML, el JSON-LD y los
  metadatos; los crawlers de IA están permitidos por defecto en `robots.txt`
  (`src/lib/ai-crawlers.ts`), con un ajuste por sitio para bloquearlos. Sin `llms.txt`.
- **Estilos desde `src/data/tokens.json`** (custom properties en `/tokens.css`), sin
  valores sueltos en el CSS escrito a mano; fuentes autoalojadas.
- **Orígenes externos solo de la lista blanca del brief**, con motivo.
- `_headers` versionado con CSP, HSTS (sin `includeSubDomains` por defecto), `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y COOP. Hosting en Cloudflare Workers con
  `not_found_handling: "404-page"`.
- Dependencias fijadas, lockfile versionado y `ignore-scripts=true`. En `dependencies`
  solo lo que termina en `dist/`; el resto en `devDependencies`. El test de licencias
  controla los dos grupos (constitución 2.2.1).
- **LF en todos los archivos** (`.gitattributes`); Biome formatea con LF.

## Comandos

`npm run build` · `npm test` (construye las variantes de ejemplo y corre todo, incluida la
CSP en Chromium y Firefox con Playwright) · `npx astro check` · `npx biome check .`
