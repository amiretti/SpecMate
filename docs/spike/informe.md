# Informe del spike (E0)

Una sección por incógnita de `docs/mvp.md`, con las horas medidas y los cambios que
piden a las ADR. Ningún dato de un cliente real: los clientes se nombran de forma
genérica.

## Incógnita 4 · ¿Astro con CSP estricta pasa los controles de ADR-0030?

Historia: US-09 (#32) · documento: `specs/001-plantilla-csp-estricta/feature.md` ·
plantilla: `templates/site` (commit `b1b7665`).

**Veredicto: sí.** Publicado en https://specmate-spike-plantilla.cuervo-dev.workers.dev
(Workers con assets estáticos, `wrangler.jsonc`, wrangler 4.161.0), con los headers
servidos tal como están en `_headers` (verificados con `curl -sI` en esta URL).

### Mediciones (2026-11-12, `dist/` servido en local, sin `_headers`)

| Control de ADR-0030 | Resultado | Umbral | |
|---|---|---|---|
| Lighthouse móvil, mediana de 3 | rendimiento 100 · accesibilidad 100 · buenas prácticas 100 · SEO 100 | ≥ 90 · ≥ 95 | ✅ |
| axe-core, 360/768/1280 px | 0 violaciones | 0 serious/critical | ✅ |
| Consola y pedidos fallidos | 0 | 0 | ✅ |
| Sin inyección (inline en `dist/`, `set:html`) | 0 apariciones · test de 101 casos | 0 | ✅ |
| Headers (test sobre `_headers`) | CSP sin `unsafe-*`, `script-src 'none'`, HSTS, nosniff, Referrer, Permissions, COOP | ADR-0030 | ✅ |
| html-validate 11 | 0 errores (tras corregir `tel-non-breaking`) | 0 | ✅ |
| linkinator | 0 rotos | 0 internos | ✅ |
| `npm audit --audit-level=high` | 0 | 0 | ✅ |
| secretlint 13 | 0 | 0 | ✅ |
| Imágenes | máx. 27,5 KB · `alt` 1/1 | ≤ 250 KB · 0 sin `alt` | ✅ |
| Sin relleno | 0 | 0 | ✅ |
| `astro check` · Biome | 0 · 0 | 0 errores | ✅ |
| Headers servidos (`curl -sI`) | `/`, un asset de `/_astro/` y el 404 llevan CSP; `/` lleva HSTS, nosniff, Referrer, Permissions y COOP | ADR-0030 | ✅ |
| 404 real | `/noexiste` → 404 (`not_found_handling: none`) | sin soft-404 | ✅ |
| Script inyectado por Cloudflare en lo servido | 0 (`<script`, `cdn-cgi`, `email-protection`) | 0 | ✅ |

### Cambios que pide a ADR-0030 y a la constitución

1. **Licencias:** Fontsource (Inter) es OFL-1.1 y va en `dist/`. Las dependencias de
   compilación traen MPL-2.0 (lightningcss), LGPL-3.0 (libvips de sharp), BlueOak-1.0.0
   y CC0-1.0. Ninguna está en la lista de la constitución: hace falta una excepción
   explícita.
2. **Cloudflare:** en `workers.dev` no se inyecta nada. Con dominio propio, apagar la
   "Email Obfuscation" de la zona, porque inyecta un script en los `mailto:` y la CSP
   lo bloquea.
3. **JSON-LD:** `_headers` no admite nonces. El `LocalBusiness` en JSON-LD no puede ir
   inline: archivo externo o se descarta. Hoy ADR-0030 lo pide sin decir cómo.
4. **Hosting:** ADR-0030 deja "Workers o Pages". Conviene fijar Workers con
   `not_found_handling: "none"` (o `404-page` con un `404.html`), porque Pages sin
   `404.html` devuelve `index.html` con 200 en cualquier ruta.
5. **Controles para E5:** falta un test de orígenes externos contra la lista blanca y la
   prohibición de `<meta http-equiv="refresh">`.
6. **A decidir:** HSTS con `includeSubDomains` puede romper otros subdominios del
   cliente; falta CORP.
7. **Versiones:** `@astrojs/check` 0.9.12 obliga a TypeScript 6 (no 7).

### Horas

Máquina: ~30 min de agentes (T1 + corrección, revisión de seguridad y medición).
Tokens de agentes: ~424k.
