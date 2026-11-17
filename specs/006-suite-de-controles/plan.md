# Plan de implementación: US-12, suite de controles y sitio que falla a propósito

**Rama**: `006-suite-de-controles` | **Fecha**: 2026-11-17 | **Spec**: [spec.md](./spec.md) (aprobada, ajustada por ADR-0038) | **Plan**: borrador
**Artefactos**: este plan. Sin `research.md` aparte: el spike del 2026-11-16/17 está resumido en «Mediciones». Sin `contracts/` ni modelo persistido.

## Resumen

Ocho controles de ADR-0030 como scripts `check:*` en `templates/site`, cada uno parametrizado por el directorio de un
build. Los sitios que fallan a propósito se obtienen copiando un build sano a un temporal y aplicando **una sola
mutación** por control. Lighthouse por su API, sin LHCI y sin Sentry (ADR-0038). `npm audit` sobre todo el árbol.

## Mediciones (spike fuera del repo, `npm install --ignore-scripts`)

| Qué | Resultado |
|---|---|
| Lighthouse 13.6, móvil, home de `dist/`, 3 corridas | Rendimiento 100 · 100 · 100 (LCP ~1,5 s, TBT 0, CLS 0) · Accesibilidad 100 · Buenas prácticas 100 · **SEO 92** |
| Causa del SEO 92 | Única auditoría fallida: `robots-txt`, "Fetch of robots.txt failed: … CSP violation". Lighthouse lo pide desde la página y `connect-src 'none'` lo bloquea |
| `lighthouse` + `overrides` de `@sentry/node` por un módulo vacío | `sentry`, `oxc-parser` y binarios nativos ausentes · `npm audit` 0 · `import('lighthouse')` funciona · `computeMedianRun` exportada |
| axe 4.14, html-validate 11, linkinator 8 | Sin licencias fuera de lista |
| secretlint 13 + preset recommend | 8 paquetes fuera de lista → tabla de excepciones de ADR-0038 |

## Contexto técnico

Node 24 · `node --test` · Playwright 1.65 (Chromium; Firefox solo en el e2e de CSP existente) · Windows primero ·
devDependencies nuevas: `lighthouse` 13.6, `@axe-core/playwright` 4.14, `html-validate` 11, `linkinator` 8,
`secretlint` 13 y `@secretlint/secretlint-rule-preset-recommend` 13 · impacto en tokens de modelo: ninguno (todo determinista).

## Constitution Check (pasa)

I ✅ solo las herramientas que fija ADR-0030/0038 · II ✅ `templates/site` excluida (ADR-0034) · IV ✅ rojo primero, y cada
control con su caso que falla · V ✅ revisión `security` antes del PR · VI ✅ un control que no puede medir (falta el
navegador o la red en `npm audit`) falla, no pasa · 2.3.1 ✅ licencias con tabla de excepciones por paquete · XII ✅
violaciones inventadas y marcadas. **Zona crítica: sí.** **RFC: no** (lo caro ya lo decidió ADR-0038).

## Decisiones fijadas por el lead

1. **Un script por control**, que recibe el directorio del build: `check:behavior`, `check:a11y`, `check:lighthouse`,
   `check:html`, `check:links`, `check:secrets`, `check:origins` y `check:deps`. `npm run controls` los corre sobre las 3 variantes (AC-1).
2. **Sitios que fallan por mutación**: copia de `dist/` a `os.tmpdir()` más una mutación declarada en una tabla
   (`control → mutación → violación esperada`). Un test verifica que cada mutación rompe **solo** su control (caso borde de AC-2).
3. **Lighthouse sin la auditoría `robots-txt`** (developer, 2026-11-17: "va!"): falla por nuestra CSP, no por el archivo.
   `robots.txt` lo sigue cubriendo `seo-files.test.mjs`. Un test falla si se saltea cualquier otra auditoría.
4. **Orígenes con `bypassCSP`**: la CSP bloquea los pedidos externos antes de que Playwright los vea; el control abre la página
   sin CSP para registrar todo lo que pediría. La lista blanca va como `allowedOrigins` en los datos de ejemplo (vacía en las 3 variantes).
5. **secretlint sobre `templates/site`** (fuentes, sin `node_modules`) **y su `dist/`**: el "repo" de un sitio es la plantilla.
6. **linkinator sin red**: los enlaces externos se listan como aviso y no se piden; solo los internos fallan.
7. **`npm audit` del sitio que falla**: un lockfile de fixture con una versión con aviso alto conocido, auditado con
   `--package-lock-only` en un temporal. Necesita red: sin red el control falla con un mensaje claro (VI).

## Archivos (`templates/site/`)

- **Crear**: `scripts/controls/{behavior,a11y,lighthouse,html,links,secrets,origins,deps,run-all}.mjs` · `test/lib/mutate.mjs` ·
  `test/{controls-fail,controls-isolation,lighthouse-audits,deps}.test.mjs` · `vendor/sentry-stub/{package.json,index.js}` ·
  `.htmlvalidate.json` · `.secretlintrc.json` · `test/fixtures/audit/package-lock.json`.
- **Cambiar**: `package.json` (devDeps, `overrides`, scripts) y lockfile · `test/lib/licenses.mjs` + `test/licenses.test.mjs`
  (tabla de excepciones; leer la licencia del enlace local) · `test/lib/scan.mjs` (`checkHeaders`, FR-009) + `test/headers.test.mjs` ·
  `src/data/examples/*.ts` y `src/lib/site.ts` (`allowedOrigins`) · `AGENTS.md` (comandos de control).

## Orden test-first y unidades

Cada fila: rojo observado y reportado antes del código. Inline por defecto; U3 y U4 son candidatas a escritores en
paralelo después de U1 (superficies disjuntas; `package.json` es de U1).

| Unidad | Alcance | RED primero | Riesgo |
|---|---|---|---|
| **U1** dependencias y licencias | FR-012 · ADR-0038 · AC-1/AC-2 (deps) | licencias: paquete fuera de lista sin excepción, excepción que ya no existe, `sentry`/`oxc-parser` presentes; `check:deps` con el lockfile de fixture | ítem 5 (dependencias) |
| **U2** headers y `meta refresh` | FR-008, FR-009 · AC-4, AC-5 | 4 casos de `https://*`/`http://host` en `img-src`/`font-src`; la CSP actual sigue pasando | ítem 2 (guard de seguridad) |
| **U3** controles estáticos | FR-004 a FR-006, FR-007 (lista) · AC-1, AC-2, AC-3 | por control: su mutación en rojo (HTML inválido, enlace interno roto, secreto inventado) | zona crítica |
| **U4** controles en navegador | FR-001 a FR-003, FR-007 · AC-1, AC-2, AC-3 | error de consola solo en 360 px, pedido fallido, violación axe *serious*, `noindex` baja SEO, origen fuera de lista; un `<a href>` externo no cuenta | zona crítica; duración |
| **V1** | todas | revisión `security` (zona crítica) | — |
| **V2** | AC-1 | salida pegada de `npm run controls` | manual |

## Riesgos abiertos

- **R1** duración: Lighthouse son ~10 s por corrida; 3 variantes × 3 corridas más el caso que falla suman 2 a 3 minutos a `npm test`.
- **R2** `bypassCSP` cambia la página que se mide: solo lo usa `check:origins`; el resto mide con la CSP real.
- **R3** `npm audit` depende de la red y del registro: un aviso nuevo puede poner en rojo el control sin cambios nuestros (es lo esperado).
- **R4** inestabilidad de Lighthouse: hoy las 3 corridas dieron igual; la mediana absorbe una corrida mala.

## Complexity Tracking

| Excepción | Motivo | Alternativa descartada |
|---|---|---|
| Módulo vacío en `vendor/sentry-stub` vía `overrides` | Sacar FSL, el nativo y la telemetría (ADR-0038) | LHCI o Lighthouse tal cual |
| Auditoría `robots-txt` salteada | Falso negativo por la CSP | Abrir `connect-src` |
