# Tareas: US-12, suite de controles y sitio que falla a propósito

Fuente: [plan.md](./plan.md) (aprobado 2026-11-17) y [spec.md](./spec.md) (aprobada). Tests primero en cada tarea:
rojo observado y reportado antes del código. Gobiernan ADR-0030 (controles y umbrales), ADR-0038 (Lighthouse sin LHCI,
`overrides` de Sentry, `npm audit` sobre todo el árbol, excepciones de licencia por paquete), ADR-0033 (loops acotados)
y ADR-0034 (`templates/site` fuera de Clean Architecture).

## Contrato compartido (lo congela U1 antes de abrir U3 y U4)

- `package.json`: devDependencies, `overrides` y los 8 scripts `check:*` más `controls` los escribe U1. Cada script
  recibe el directorio del build como primer argumento y termina con código ≠ 0 si no cumple su umbral.
- `test/lib/mutate.mjs` (U1): `copyBuild(src) → tmpDir` en `os.tmpdir()` y `mutate(dir, fn)`. Cada unidad declara su
  tabla `control → mutación → violación esperada` en `test/lib/mutations-<unidad>.mjs` (no en el test: importarlo re-registra sus tests); la prueba de aislamiento (T-seam) las junta.
- `scripts/controls/<control>.mjs` exporta `run(dir, opts) → { ok, violations[] }` y tiene un `main` de CLI.

## Tareas

| ID | Unidad | Cierra | Entregable | verifica | Ruta · nivel · estimación | Estado |
|---|---|---|---|---|---|---|
| U1 | U1 | FR-012 · AC-1/AC-2 (deps) · ADR-0038 | devDeps nuevas, `vendor/sentry-stub` + `overrides`, tabla de excepciones de licencias (lee el `package.json` del enlace local), test sin `sentry`/`oxc-parser`, `check:deps` con su lockfile de fixture que falla, contrato compartido | `npm test` + `npm run check:deps` + `npm ls @sentry/node sentry oxc-parser` | inline (lead) · ~1,5 h | ✅ npm test 440/440 · check:deps exit 0 · audit 0 altas (3 moderadas de linkinator→glob) |
| U2 | U2 | FR-008, FR-009 · AC-4, AC-5 | `checkHeaders` rechaza `https://*` y `http://` en `img-src`/`font-src` (4 casos); `meta refresh` reusa el control existente y suma su sitio que falla | `node --test test/headers.test.mjs test/no-inline-code.test.mjs` | inline (lead) · ~30 min | ✅ RED 5 → GREEN 106/106 |
| U3 | U3 | FR-004, FR-005, FR-006 · AC-1, AC-2 | `check:html`, `check:links`, `check:secrets` + `.htmlvalidate.json`, `.secretlintrc.json` + `test/controls-static.test.mjs` y `test/lib/mutations-static.mjs` con una mutación por control | `node --test test/controls-static.test.mjs` + los 3 scripts sobre las 3 variantes | `frontend` · máximo (zona crítica) · escritor en paralelo con U4 · ~1,5 h | ✅ 17/17 · 3 scripts exit 0 en las 3 variantes · 1 ajuste (tabla a `test/lib/`) |
| U4 | U4 | FR-001, FR-002, FR-003, FR-007 · AC-1, AC-2, AC-3 | `check:behavior` (360/768/1280), `check:a11y`, `check:lighthouse` (mediana de 3, sin `robots-txt`, `enableErrorReporting: false`), `check:origins` (`bypassCSP`, `allowedOrigins` en los datos de ejemplo) + `test/controls-browser.test.mjs`, `test/lib/mutations-browser.mjs` + `test/lighthouse-audits.test.mjs` | `node --test test/controls-browser.test.mjs test/lighthouse-audits.test.mjs` + los 4 scripts sobre las 3 variantes | `frontend` · máximo (zona crítica) · escritor en paralelo con U3 · ~3 h | ✅ 25/25 (98 s) · 4 scripts OK en las 3 variantes · Lighthouse 100/100/100/100 · 1 ajuste (tabla a `test/lib/`) |
| T-seam | — | AC-2 (caso borde), AC-6, SC-002 | `run-all.mjs` (`npm run controls`), `test/controls-isolation.test.mjs` (cada mutación rompe solo su control), `AGENTS.md` de la plantilla con los comandos | `npm test` completo (≥ 419 previos en verde) | inline (lead) · ~45 min | ✅ 498/498 (5 min 44 s, serializado) · aislamiento 9/9 |
| V1 | — | todas | Revisión `security` (zona crítica, bloqueante) | `Veredicto:` | `security` · máximo · tope 2 vueltas | ✅ aprobado (1 vuelta) · 0 C/A · 2 M, 4 B: 3 arreglados, MEDIO-2 al developer |
| V2 | — | AC-1 | Salida pegada de `npm run controls` sobre las 3 variantes | manual | inline (lead) | ✅ 22/22 exit 0 · LH 100/100/100/100 en las 3 · 2 min 43 s |

**Superficies disjuntas de U3 y U4:** U3 escribe solo `scripts/controls/{html,links,secrets}.mjs`, `.htmlvalidate.json`,
`.secretlintrc.json` y `test/controls-static.test.mjs`. U4 escribe solo `scripts/controls/{behavior,a11y,lighthouse,origins}.mjs`,
`src/data/examples/*.ts`, `src/lib/site.ts`, `test/controls-browser.test.mjs` y `test/lighthouse-audits.test.mjs`.
Ninguno toca `package.json`, el lockfile ni `test/lib/`.

## Registro

- 2026-11-17: tareas armadas desde el plan aprobado. Estimación total ~8 h de agente, en línea con la spec.
- 2026-11-17, U1: `overrides` con `file:` relativo se resolvía contra `lighthouse/` en el lockfile; quedó como
  devDependency directa `@sentry/node: file:vendor/sentry-stub` más `overrides: { "@sentry/node": "$@sentry/node" }`.
  El stub lanza si se importa (en vez de exportar vacío): un `enableErrorReporting` mal puesto falla, no reporta.
- 2026-11-17, U1, desvío menor: secretlint trae dos `argparse` (Python-2.0 y, anidado bajo `rc-config-loader`,
  PSF-2.0). ADR-0038 punto 5 nombra solo `argparse (Python-2.0)`; su contexto menciona "Python-2.0/PSF-2.0". Se
  sumó la entrada PSF-2.0 con su motivo. Para el developer al cierre.
- 2026-11-17, contrato: las tablas de mutaciones van en `test/lib/mutations-<unidad>.mjs`, no en los tests.
- 2026-11-17, U3: desvíos aceptados: `check:links` falla también con un `#ancla` inexistente (`checkFragments`) y
  suma `warnings` al contrato; `check:secrets` no escanea `.secretlintrc.json`. secretlint respetaba `.gitignore` y
  se salteaba `dist/` en silencio: corre con `respectGitignore: false` y falla si un archivo pedido no está en su reporte.
- 2026-11-17, U4: desvíos aceptados: los scripts reusan `serve`/`listFiles` de `test/lib`; `check:origins` toma
  `--data` (run-all lo pasa por variante) y mide en claro y oscuro (su mutación pide un fondo externo solo en
  oscuro); las mutaciones de behavior y a11y se acotan por ancho (≤ 400 / ≥ 1000 px), fuera de los 412 px de LH.
- 2026-11-17, T-seam: `controls-isolation` 9/9 en 239 s (8 mutantes × 7 controles, LH en 1 corrida). Costo R1:
  `npm test` pasa de ~13 s a varios minutos.
- 2026-11-17, V1 (`security`, máximo): **aprobado**, 0 Crítico/Alto, 2 Medios, 4 Bajos. Arreglados por el lead,
  con RED observado: MEDIO-1 (`weakOrigin` dejaba pasar `https://*:*`, `https://*.com`, `https://*/img/`: ahora todo
  host que empieza con `*`), BAJO-2 (solo se saltea el `.secretlintrc.json` raíz) y el `throw stderr` sin `Error`.
  Pendientes: MEDIO-2 (orígenes en navegador no ve lazy, srcset 2x, `media`, `:hover`/print ni
  `preconnect`/`dns-prefetch`; latente: la plantilla no usa ninguno) → decisión del developer. BAJO-1 (enlace interno
  absoluto al dominio canónico no se pide), BAJO-4 (puerto de depuración de Chromium en 127.0.0.1 durante LH) →
  seguimiento. BAJO-3 (excepción por nombre y licencia, sin versión) es lo que fija ADR-0038.
- 2026-11-17, suite: en paralelo dio 3 rojos de 497 por contención de Chromium (timeouts de `page.goto` y `NO_FCP`;
  los controles dieron rojo "could not measure", como pide VI). `npm test` pasa a `--test-concurrency=1`: 498/498.
- 2026-11-17, developer: "hacelo ahora" (MEDIO-2). `check:origins` suma una pasada estática sobre `dist/`
  (`staticOrigins`): atributos que piden algo (`src`, `srcset`, `poster`, `<link>` salvo `canonical`/`alternate`/…,
  `<image|use href>`) y `url()`/`@import` del CSS, contra el origen canónico más `allowedOrigins`; `<a href>` no
  cuenta. `test/controls-origins-static.test.mjs`: RED (export ausente) → 15/15 con preconnect, dns-prefetch,
  preload, lazy, srcset 2x, `<source media>`, entidades, `:hover`, print e `@import`. Las 3 variantes siguen en OK.
