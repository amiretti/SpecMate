# Investigación: US-11

Fuentes alcanzadas el 2026-11-12 por context7 (documentación oficial indexada). Lo que no se pudo citar queda marcado como **supuesto verificado por test**.

## R1 — 404 en Workers: `"none"` o `"404-page"`

- **Decisión**: `not_found_handling: "404-page"` en `wrangler.jsonc`.
- **Fuente**: https://developers.cloudflare.com/workers/static-assets (Routing behavior): sin Worker script y sin asset que coincida, Workers devuelve “a `404 Not Found` response” (el valor por defecto es `"none"`); con `"404-page"` devuelve “a `404 Not Found` response with the nearest `404.html`”. También https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation (Custom 404 pages).
- **Razón**: FR-007 exige 404 con el contenido de `404.html`. `"none"` da el estado correcto pero no el contenido (la fuente no dice que sirva el archivo). El spike (L10) vio 404 con `"none"`, sin cuerpo propio.
- **Descartada**: `"none"` (cumple el estado, no el marco del sitio); `"single-page-application"` (200 con `index.html`: soft-404).
- **Cómo se prueba**: test de `wrangler.jsonc` (valor) y `dist/404.html`; el estado servido real, con `curl` tras publicar (quickstart §4).

## R2 — Resultados enriquecidos de FAQ en Google

- **Hallazgo**: la afirmación de spec §7 se confirma y se queda corta. Changelog oficial https://developers.google.com/search/updates: sept. 2023, el FAQ se muestra “only for well-known, authoritative government and health websites”; 8 may. 2026, el resultado enriquecido de FAQ “will no longer appear in Google Search starting May 7, 2026”; 15 jun. 2026, se retiró su documentación.
- **Consecuencia**: `FAQPage` ya no da resultado enriquecido en Google para ningún sitio. FR-009 se mantiene (valor para motores de respuesta y como dato schema.org), pero **que algún motor lo use es un supuesto que ningún control mide** (spec §4). AC-11 no debe esperar mejora visible por `FAQPage`; el Rich Results Test puede no reconocerlo y eso no es un fallo.

## R3 — Google-Extended y AI Overviews

- **Fuente**: https://developers.google.com/search/docs/appearance/ai-features. “robots.txt directives for Googlebot is the control for site owners to manage access to how their sites are crawled for Search”; Google-Extended sirve para “limit AI training and grounding in some of Google's other systems”. Para aparecer en AI Overviews o AI Mode, la página debe estar indexada y ser elegible con snippet; “no additional requirements”.
- **Consecuencia**: la afirmación de spec §7 se confirma. Bloquear `Google-Extended` no saca al sitio de AI Overviews (se controla con `nosnippet`/`noindex`). La plantilla no necesita marcado especial de GEO para Google. El ajuste de política de FR-006 debe documentarlo en `AGENTS.md`.
- **Tokens de los demás crawlers** (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Applebot-Extended, CCBot, Meta-ExternalAgent): **no verificados contra la documentación de cada proveedor en esta sesión**. La tarea T6 confirma cada token antes de fijar la lista; el test solo mide estructura (≥ 5, sin repetidos ni vacíos).

## R4 — `LocalBusiness` sin `address` (hallazgo nuevo)

- **Fuente**: https://developers.google.com/search/docs/appearance/structured-data/local-business: `address` y `name` son propiedades **requeridas** para ser elegible a resultado enriquecido.
- **Consecuencia**: la variante con `areaServed` sin dirección (ADR-0035, constitución XI) no será elegible a resultado enriquecido de negocio local: el Rich Results Test debería avisar que falta `address`. Es una consecuencia aceptada de no inventar la dirección, no un defecto. **AC-11 (Rich Results) se mide solo sobre la variante con dirección.** La spec debería decirlo; se reporta al lead.

## R5 — CSP con `script-src 'none'` frente al bloque JSON-LD

- **Fuente parcial**: MDN, `<script>` `type`: un valor que no es de JavaScript se trata como bloque de datos que “won't be processed by the browser”.
- **Lo que la fuente no dice**: que la CSP no lo reporte. **Sigue siendo supuesto verificado por test** (Playwright, Chromium y Firefox, AC-11), como pide ADR-0035. Un control positivo (un `<script>` inline sí debe producir violación) evita un verde que no mide nada (principio VI).

## R6 — Playwright sobre `dist/` con los headers reales

- **Decisión**: la librería `playwright` (no `@playwright/test`) dentro de `node --test`; un servidor Node mínimo (`test/lib/serve.mjs`) sirve `dist/` aplicando `_headers` con el `parseHeaders` existente. `astro preview` no aplica `_headers`.
- **Detección**: listener `securitypolicyviolation` vía `addInitScript` más mensajes de consola.
- **Riesgo**: `upgrade-insecure-requests` sobre `http://localhost`. Si un navegador lo reescribe a https, mitigación: servir con TLS autofirmado e `ignoreHTTPSErrors`, o quitar solo esa directiva en el servidor de prueba y comprobar que el resto de la CSP es idéntica a la de `_headers`.
- **Instalación**: `npx playwright install chromium firefox` es un paso explícito de desarrollo (no corre por scripts: `.npmrc` tiene `ignore-scripts=true`). Sin navegador, el test falla (no se saltea).

## R7 — Licencias: qué es “lo publicado”

- Lockfile v3: cada paquete trae `license` y la marca `dev`. Hoy 355 paquetes, 87 con `dev`; sin `dev` hay 12 MPL-2.0, 10 LGPL-3.0, 3 BlueOak y 1 `0BSD` (el árbol de `astro` y `sharp`).
- **Decisión**: `dependencies` solo con lo que llega a `dist/` (`@fontsource-variable/inter`, OFL-1.1); el resto a `devDependencies`. El test separa por la marca `dev` del lockfile (publicado = sin `dev`), exige que todo paquete de `dependencies` directas esté en la lista de lo publicado, evalúa expresiones SPDX (`OR`: alguna permitida; `AND`: todas), y falla ante licencia ausente o no clasificada. OFL-1.1 solo se acepta en paquetes `@fontsource*`.
- **Hueco**: `0BSD` (`tslib`) no está en ninguna lista de la constitución 2.2.0; quedaría en build-only tras el movimiento. No lo decide el plan: o enmienda (permisiva equivalente a BSD) o excepción con motivo.
- **Alternativa descartada**: `license-checker` u otra librería (principio I): el lockfile ya trae los datos.

## R8 — Emitir el JSON-LD sin `set:html`

- Una expresión `{json}` dentro de `<script>` en Astro pasa por el escape de HTML (comillas incluidas) y un elemento de texto crudo no las decodifica: el JSON queda roto. El patrón documentado de Astro usa `set:html`, que el control de US-09 prohíbe. El spike T0 lo confirma o lo refuta con un build real. Si se confirma, la salida mínima es una excepción para un solo archivo (`JsonLd.astro`), cuyo único argumento es `serializeJsonLd(...)`, que requiere ADR (ver R1 del plan). Alternativa a evaluar en T0: una integración de Astro que inserte el bloque tras el render, sin `set:html` en el código fuente.

## Verificación de los tokens de crawlers de IA (lead, 2026-11-12)

| Token en `ai-crawlers.ts` | Fuente | Resultado |
|---|---|---|
| `GPTBot`, `OAI-SearchBot`, `ChatGPT-User` | https://developers.openai.com/api/docs/bots | Confirmados. `ChatGPT-User` es a pedido del usuario y robots.txt "may not apply" |
| `ClaudeBot`, `Claude-SearchBot`, `Claude-User` | https://support.claude.com/en/articles/8896518 (citado por terceros; no se abrió la página primaria) | Confirmados por fuentes secundarias |
| `PerplexityBot`, `Perplexity-User` | https://docs.perplexity.ai/guides/bots | Confirmados. `Perplexity-User` "generally ignores robots.txt rules" |
| `Google-Extended` | documentación de Google citada en R3 | Confirmado; no gobierna AI Overviews |
| `CCBot`, `Meta-ExternalAgent`, `Applebot-Extended` | — | Sin verificar en esta sesión |

**Consecuencia para el ajuste "bloquear crawlers de IA":** no es total. `ChatGPT-User` y `Perplexity-User` pueden ignorar `robots.txt` porque actúan a pedido de un usuario. Si un cliente pide bloqueo real, hace falta una regla en el WAF de Cloudflare (fuera de esta historia).
