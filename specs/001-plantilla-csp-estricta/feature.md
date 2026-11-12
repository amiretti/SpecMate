---
estado: hecha             # borrador | aprobada | hecha
ticket: https://github.com/amiretti/SpecMate/issues/32
estimacion: ~180k tok · ~4 h (más la espera de la cuenta de Cloudflare)
tests: node:test sobre dist/ · `npm test` dentro de templates/site
entrega: single-pr
---

# US-09 · Plantilla mínima con CSP estricta (incógnita 4)

Ruta grande: espera externa (cuenta de Cloudflare, publicación con luz verde) y más de una
sesión. Toca una zona crítica (`project-guard` §5: plantilla, CSP, `_headers`), pero las
reglas ya las fija ADR-0030 y los criterios ya están en el issue; por eso no va por SDD
(ver L2). Revisión `security` obligatoria.

## Specs

- **S1** — "sitio Astro 7 mínimo con `_headers` publicado en Cloudflare."
  - AC: URL pública que sirve el sitio con los headers de `_headers` · verifica: manual,
    `curl -sI <url>` pegado en el informe.
- **S2** — "0 `<script>`, `<style>` u `on*=` inline en `dist/`."
  - AC: test automatizado que recorre todo `dist/` y falla con cualquier aparición; además,
    `set:html` prohibido en el código fuente (ADR-0030, "Sin inyección") · verifica: unit
    `npm test` (templates/site), salida pegada.
- **S3** — "Lighthouse móvil (mediana de 3) y axe con sus números en el informe."
  - AC: puntajes de rendimiento, accesibilidad, buenas prácticas y SEO (mediana de 3) y
    violaciones de axe por severidad en 360, 768 y 1280 px, contra los umbrales de ADR-0030 ·
    verifica: salida pegada.
- **S4** — "lista de cambios que pide a ADR-0030, o "ninguno"."
  - AC: sección de la incógnita 4 en `docs/spike/informe.md` · verifica: manual.
- **S5** — De `docs/mvp.md`, la incógnita cuenta como sí con "Todos los umbrales de ADR-0030
  en verde". Para la plantilla mínima entran los que no dependen del brief: tipos y lint,
  sin texto de relleno, sin inyección, headers, HTML y enlaces, dependencias, secretos e
  imágenes.
  - AC: cada control con su número en el informe · verifica: salida de cada comando pegada.

## Fuera de alcance

- Esquema del brief, `tokens.json` del cliente y biblioteca de secciones (E1, E2, E4).
- `specmate new`, `verify` y `publish` en el CLI (bloqueado hasta cerrar el spike).
- Datos de un cliente real: el contenido de ejemplo es ficticio y genérico.
- CI: los controles corren a mano en el spike.

## Tareas

- [x] T1 · S2, S5 · plantilla en `templates/site`: Astro 7 estático, `inlineStylesheets: 'never'`, `assetsInlineLimit: 0`, una página con contenido ficticio, CSS por custom properties, fuente autoalojada, una imagen con `astro:assets`, `_headers`, `.npmrc` con `ignore-scripts=true`, lockfile; tests primero (sin inline, sin `set:html`, headers, sin relleno) · ruta: `frontend` · nivel: máximo (zona crítica, model-routing §2) · commit: b1b7665 · evidencia: npm test 42/42, astro check 0, biome 0, audit 0
- [x] T2 · S2, S5 · revisión de seguridad de CSP, `_headers` y escape (zona crítica) · ruta: `security` · nivel: máximo · commit: — · veredicto: aprobado con observaciones (L6)
- [x] T3 · S3, S5 · medición independiente: Lighthouse móvil ×3, axe en tres anchos, html-validate, linkinator, `npm audit`, secretlint, peso y `alt` de imágenes · ruta: `qa` · nivel: estándar · commit: — · evidencia: L7 (html-validate en rojo, se corrige en T1)
- [x] T4 · S1 · publicar en Cloudflare con luz verde del developer y pegar los headers servidos · ruta: inline · nivel: — · commit: (este) · evidencia: L10
- [x] T5 · S4 · sección de la incógnita 4 en `docs/spike/informe.md` · ruta: inline · nivel: — · commit: (este)

## Registro

- **L1** — "comenzamos con el desarrollo de este proyecto? Que necesitas para arrancar? Podes leer el project que tenemos en https://github.com/users/amiretti/projects/4/views/1" → recomendación de arrancar por US-09 → "dale, por favor utilizá los agentes que necesites en Agent teams"
- L2 — 2026-11-12 Ruta grande y no SDD: la tabla de `feature-doc` §3 manda SDD para zonas críticas, pero acá no hay reglas de negocio nuevas ni un *qué* que aprobar (ADR-0030 y el issue #32 ya lo fijan). El developer puede pedir SDD.
- L3 — 2026-11-12 Supuesto: la plantilla del spike vive en `templates/site` porque US-09 existe "para fijar la plantilla antes de E1". El bloqueo de `project-guard` §7 no aplica: es trabajo del spike.
- L4 — 2026-11-12 Espejo en Engram pendiente: `mem_save` no está disponible en esta sesión.
- L5 — 2026-11-12 T1 hecha (frontend, opus). Rerun del lead: build ok, `npm test` 42/42. Hallazgos para ADR-0030/constitución: Fontsource es OFL-1.1 (fuera de las licencias permitidas); sharp anda con ignore-scripts; la "Email Obfuscation" de Cloudflare inyecta script y hay que apagarla (T4); `_headers` no admite nonces, así que JSON-LD nunca va inline. CSP más estricta que el mínimo (`script-src 'none'`, `connect-src 'none'`, `form-action 'none'`, COOP).
- L6 — 2026-11-12 T2 (security, opus): aprobado con observaciones, 0 critical/high. Corrección pendiente para T1 (una tanda, después de T3): (1) `checkHeaders` acepta comodines y `unsafe-hashes`, Referrer-Policy débil, y no fija las directivas `'none'`; (2) no detecta `! Header` ni valida otras reglas; (5) el scanner no ve `srcdoc`, iframe, object, embed, `data:` ni `javascript:` codificado; (6) solo recorre `.html`, falta `.svg`; (7) el chequeo de `set:html` no ve spread ni `unescapeHTML`; (9) `npm prune` para los extraneous. Para E5 y ADR, fuera de alcance: (3) test de orígenes contra la lista blanca y `meta refresh`; (4) licencias MPL, LGPL, BlueOak, CC0 y OFL; (8) soft-404 en Cloudflare, que se revisa en T4; HSTS `includeSubDomains`; CORP.
- L7 — 2026-11-12 T3 (qa, sonnet), sobre `serve` local sin `_headers`: Lighthouse móvil, mediana de 3 = rendimiento 100, accesibilidad 100, buenas prácticas 100, SEO 100. axe: 0 violaciones en 360, 768 y 1280 px. Consola y pedidos fallidos: 0. linkinator: 0 rotos. audit: 0. secretlint: 0. Imágenes: máximo 27,5 KB, `alt` 1/1. Relleno: 0. **html-validate: 5 errores `tel-non-breaking`** (texto del teléfono), que entran en la corrección de T1 junto con los puntos de L6. El `cache-insight` de Lighthouse solo se puede medir publicado (T4).
- L8 — 2026-11-12 Corrección de T1 (una tanda, ítems 1, 2, 5, 6, 7 y 10 de L6/L7). Rerun del lead: build ok, `npm test` 101/101, html-validate 0 errores. Ítem 9 sin cambios: los paquetes wasm32 los pide el lockfile para otras plataformas. Entorno: el `biome.exe` de node_modules se cuelga al lanzarse en esta máquina (proceso que no se puede matar sin permisos de administrador). Commit b1b7665.
- L9 — 2026-11-12 T5 en borrador: `docs/spike/informe.md` con la incógnita 4; falta S1 (headers servidos), que depende de T4.
- L10 — 2026-11-12 T4: con luz verde del developer ("dale"), `wrangler deploy` (4.161.0) publicó en https://specmate-spike-plantilla.andresmiretti.workers.dev. `curl -sI`: `/` 200 con CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy y COOP; `/noexiste` 404 con CSP; el asset `/_astro/*.css` con CSP; 0 scripts inyectados en el HTML servido. S1 cumplida. Informe actualizado.
- L11 — 2026-11-12 El developer cambió el subdominio de la cuenta: la URL ahora es https://specmate-spike-plantilla.cuervo-dev.workers.dev (misma versión 428aff59). La URL vieja da NXDOMAIN. El DNS nuevo resuelve; el certificado TLS todavía se está emitiendo. Re-verificación de headers pendiente.
- L12 — 2026-11-12 Re-verificación en https://specmate-spike-plantilla.cuervo-dev.workers.dev: `/` 200 con CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy y COOP; `/noexiste` 404; asset `/_astro/*.css` 200 con CSP; 0 inline en el HTML servido.
