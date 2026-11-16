# Plan de implementación: US-11, plantilla completa (tokens, SEO local, GEO y AEO)

**Rama**: `005-plantilla-completa` | **Fecha**: 2026-11-12 | **Spec**: [spec.md](./spec.md) (aprobada) | **Plan**: aprobado (2026-11-12, Andy: "sí, aprobado"), con la enmienda 0BSD y la ADR-0037 condicionada al spike T0
**Artefactos**: [research.md](./research.md) · [data-model.md](./data-model.md) · [quickstart.md](./quickstart.md). Sin `contracts/` (sin API, eventos ni mensajes). Sin modelo persistido (los datos son archivos del propio sitio).

## Resumen

Sobre la plantilla de US-09 (Astro 7 estático, CSP `script-src 'none'`): `tokens.json` → CSS; un módulo de datos
único alimenta HTML, JSON-LD y metadatos; JSON-LD por un serializador que escapa; `sitemap.xml`, `robots.txt`
(grupo por crawler de IA) y `404.html` sin dependencias nuevas (endpoints de Astro). 3 variantes de ejemplo
(dirección, zona, online) se construyen con `SITE_DATA`/`SITE_OUT`. Dependencia nueva: `playwright` (Apache-2.0, dev; ADR-0030).

## Contexto técnico

Node 24 · TS 7 estricto · Astro 7.4 · tests `node --test` sobre `dist/` y librerías `src/lib/*.ts` · Playwright (Chromium + Firefox, solo AC-11) ·
Windows primero · impacto en tokens de modelo: ninguno (todo determinista, principio IX).

## Constitution Check (previo y posterior al diseño: pasa)

I ✅ sin sitemap/SEO libs, solo `playwright` (ya en ADR-0030) · II ✅ `templates/site` excluida (ADR-0034) · IV ✅ rojo primero por AC;
controles de seguridad sin excepción · V ✅ revisión `security` antes del PR · VI ✅ validadores lanzan, el e2e falla si falta el navegador ·
XI/XII ✅ datos inventados y marcados. **Zona crítica: sí** (plantilla: CSP, `_headers`, escape). Bloqueos §7: no toca E2-E4. **RFC: no**,
salvo el desvío R1 (abajo).

## Decisiones fijadas por el lead

1. HSTS sin `includeSubDomains`; el test de headers lo exige. 2. *Sin inyección* admite solo el bloque ADR-0035 y conserva sus 21 casos adversos;
`findInlineCode` no cambia: un `splitJsonLd` valida y retira el bloque antes de escanear. 3. Licencias: publicado = lo que queda en `dist/`:
`astro`, `sharp` y compañía a `devDependencies`. 4. Playwright mínimo (US-12 lo extiende). 5. **404: `"404-page"`** (con `"none"` Workers
devuelve su 404 genérico, no `404.html`; ver research R1). 6. Variantes desde datos de ejemplo inventados.

## Archivos (`templates/site/`)

- **Crear**: `src/data/tokens.json` · `src/data/examples/{address,area,online}.ts` · `src/lib/{tokens,site,schema,jsonld,head,robots,ai-crawlers,faq}.ts` ·
  `src/components/JsonLd.astro` · `src/pages/{tokens.css,sitemap.xml,robots.txt}.ts` · `src/pages/404.astro` ·
  `test/{tokens,jsonld,schema-types,consistency,head,seo-files,semantics,faq-sameas,licenses,csp-e2e,wrangler}.test.mjs` ·
  `test/lib/{jsonld,css-literals,licenses,build,serve}.mjs` · `scripts/build-variants.mjs`.
- **Cambiar**: `src/layouts/Base.astro`, `src/pages/index.astro` (mismo marco y fuente de datos) · `src/styles/global.css` (0 literales);
  borrar `tokens.css` · `astro.config.mjs` (alias `@data`, `outDir`) · `tsconfig.json` · `public/_headers` y `wrangler.jsonc` ·
  `test/{headers,no-inline-code,no-set-html}.test.mjs`, `test/lib/scan.mjs` (solo `checkHeaders`) · `package.json` + lockfile · `AGENTS.md` · `.gitignore`.

## Orden test-first y unidades

Cada fila: rojo observado y reportado antes del código. Las unidades U1, U2 y U3 tienen superficies disjuntas y pueden ir en paralelo (el lead decide: por defecto inline).

| Unidad | Alcance (FR/AC) | RED primero | Superficie | Riesgo |
|---|---|---|---|---|
| **U1** deps y licencias | FR-012 · AC-12 | `licenses.test` con fixtures GPL, ausente, sin clasificar por grupo; real falla hoy (`astro`/`sharp` en `dependencies`) | `package.json`, lockfile, `test/licenses*`, `test/lib/licenses.mjs` | ítem 5 (dependencias); no toca zona crítica |
| **U2** tokens | FR-001 · AC-1 | `tokens.test`: literales en `global.css`, token faltante/inválido, cambio de valor | `src/data/tokens.json`, `src/lib/tokens.ts`, `src/pages/tokens.css.ts`, `global.css`, `test/tokens*`, `test/lib/css-literals.mjs` | bajo |
| **U3** núcleo (secuencial; ver abajo) | FR-002 a FR-010 · AC-2 a AC-10 | por tarea | resto de la lista | **zona crítica** (CSP, escape, controles) |
| **U4** e2e CSP | AC-11 | positivo de control (`<script>` inline detectado) y 0 violaciones con JSON-LD | `test/csp-e2e*`, `test/lib/serve.mjs` | zona crítica; depende de U3-T3 y de `playwright` (U1) |

Dueño único de archivos compartidos: `package.json`/lockfile (U1, incluye `playwright`), `Base.astro`/`index.astro`/`astro.config.mjs`/datos (U3; U3 agrega el `<link>` a `/tokens.css`).

**U3, en orden**:
T0 spike: ¿el `{json}` de Astro rompe el JSON? · T1 HSTS + `wrangler` `"404-page"` (rojo: `_headers` y `wrangler.jsonc` actuales) ·
T2 datos de ejemplo + `site.ts` (URL https obligatoria) + alias `@data` + `build-variants` ·
T3 `jsonld.ts` + `JsonLd.astro` + `splitJsonLd`/`checkJsonLd` (AC-3: 4 valores adversos, 2 bloques, otro `type`, único archivo con `application/ld+json`) ·
T4 `schema.ts` por caso (AC-2) · T5 `head.ts` + Base (AC-5, og:image ≤ 250 KB) + consistencia (AC-4) ·
T6 `sitemap`/`robots`/`ai-crawlers` + `404.astro` (AC-6, AC-7) · T7 semántica HTML y orden de lectura (AC-8) · T8 FAQ y `sameAs` (AC-9, AC-10).
Cada comportamiento existente que toca (headers, inline, `set:html`, imágenes) lleva su test de “sigue igual”.

## Riesgos abiertos

- **R1**: `<script>` de Astro escapa `"`, así que probablemente hace falta `set:html` en `JsonLd.astro`. Eso ajusta el control `no-set-html` fuera de la decisión 2: **requiere aval del lead y ADR** antes de T3 (si el spike T0 lo confirma).
- **R2**: licencia `0BSD` (`tslib`) no está en ninguna lista: decisión del developer (enmienda o excepción con motivo).
- **R3**: Google exige `address` en `LocalBusiness` para resultado enriquecido: AC-11 se mide sobre la variante con dirección (research R4).
- **R4**: `upgrade-insecure-requests` sobre `http://localhost` en Firefox; mitigación en research R6.
- **R5**: `node_modules` local incompleto: `npm ci` antes de empezar.

## Complexity Tracking

| Excepción | Motivo | Alternativa descartada |
|---|---|---|
| `SITE_DATA`/`SITE_OUT` leídos en `astro.config.mjs` | construir 3 variantes y fixtures que fallan sin copiar la plantilla | copiar a un temporal: lento y frágil en Windows |
| Posible `set:html` en 1 archivo (R1) | único modo de emitir el bloque sin escapar comillas | microdata (descartada en ADR-0035) |
