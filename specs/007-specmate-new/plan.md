# Plan de implementación: US-13, `specmate new` sobre un CLI con Clean Architecture

**Rama**: `007-specmate-new` | **Fecha**: 2026-11-17 | **Spec**: [spec.md](./spec.md) (aprobada 2026-11-17) | **Plan**: aprobado (2026-11-17, Andy: "sí, aprobado")
**Artefactos**: este plan. Sin `research.md` ni `contracts/`: no hay incógnitas externas ni API pública.

## Resumen

Primer código del CLI. Un caso de uso `createClientRepo` en `application`, que depende de puertos
(sistema de archivos, git, ubicación de la plantilla), y su adaptador de consola. La creación es atómica: se arma
todo en una carpeta temporal hermana y se renombra al final; ante cualquier falla, se borra el temporal.

## Contexto técnico

Node 24 · TypeScript 7.0.2 `strict`, ESM, solo sintaxis borrable · Vitest 5.1 · esbuild 0.28 (bundle a `dist/index.js`) ·
Biome 2.6 · sin dependencias de producción: argumentos con `node:util` `parseArgs`, git por `node:child_process`
`spawn` sin shell · Windows primero · impacto en tokens de modelo: ninguno (todo determinista).

## Constitution Check (pasa)

I ✅ sin dependencias de producción · II ✅ Clean Architecture con test de arquitectura (ADR-0034) · IV ✅ rojo primero
· VI ✅ git ausente o copia fallida dan error, nunca un repo a medias · IX ✅ sin modelo · XII ✅ solo el ejemplo
inventado de la plantilla · Stack ✅ las herramientas de la tabla, licencias MIT/Apache-2.0. **Zona crítica: no.**
**RFC: no.**

## Estructura (`packages/cli/src/`)

| Capa | Archivos | Importa |
|---|---|---|
| `domain/` | `slug.ts` (valor `Slug`, FR-004) · `errors.ts` | nada |
| `application/` | `ports.ts` (`FileSystem`, `Git`, `TemplateSource`) · `create-client-repo.ts` | solo `domain` |
| `infrastructure/` | `node-file-system.ts` · `git-cli.ts` · `template-source.ts` | `domain`, `application`, `node:*` |
| `cli/` | `main.ts` (`parseArgs`, códigos de salida, mensajes) · `index.ts` (composición) | todo |

## Decisiones (para el gate)

1. **Atómico (FR-006)**: copia a `.<slug>.tmp-<random>` junto al destino, `git init` y commit ahí, reescritura del
   `name` en `package.json` y `package-lock.json` (FR-007), y `rename` a `<slug>` al final. Ante cualquier error se
   borra el temporal. `rename` en el mismo directorio es atómico en NTFS y en POSIX.
2. **Destino existente (FR-005)**: se comprueba antes de crear nada; el `rename` final también falla si apareció en
   el medio, y en ese caso se borra el temporal.
3. **Autor del primer commit**: el de la configuración de git del usuario; si no tiene `user.name`/`user.email`, el
   commit falla y el comando lo dice (no se inventa un autor). Los tests de integración fijan `GIT_AUTHOR_*` y
   `GIT_COMMITTER_*`.
4. **Copia (FR-001)**: recorrido propio con lista de exclusión `node_modules`, `dist`, `.astro`, `.wrangler` en la
   raíz de la plantilla; nada de `.gitignore` como fuente (la lista es explícita y testeable).
5. **Plantilla**: `TemplateSource` resuelve `templates/site` desde la ubicación del módulo (`import.meta.url` +
   `path`), con un override `SPECMATE_TEMPLATE` solo para tests. Falla si la carpeta no tiene `package.json`.
6. **Test de arquitectura (FR-009)**: propio, con Vitest y sin dependencias. Lee cada `.ts` de `src/` y sus
   `import`/`export … from`/`import()` y falla si `domain` importa algo fuera de `domain`, o si `application`
   importa `infrastructure`, `cli` o `node:*` de E/S (`fs`, `child_process`, `net`, `http`, `os`). La regla se prueba
   sobre fixtures en `test/fixtures/arch/` (2 violaciones a propósito, una por capa, y un caso válido) además del
   código real.
7. **AC-2 aparte**: `npm ci` + build + 513 tests del repo creado duran ~8 min y piden red y navegadores. Va como
   `npm run test:e2e` del CLI, no en `npm test`. Corre una vez al cierre y su salida queda pegada. Tradeoff: no
   corre en cada `npm test`; a cambio, `npm test` del CLI queda en segundos.
8. **Rutas (AC-9)**: todo con `path`; el test de arquitectura también falla si un archivo de `src/` concatena `'/'`
   o `'\\'` con una variable. Un test de integración corre desde una carpeta con espacio y acento.

## Orden test-first y unidades

Una sola cadena acoplada (los puertos atan aplicación e infraestructura): **inline (lead)**, sin escritores en
paralelo. Sin verificador independiente: no es zona crítica ni ítem de alto riesgo; AC-9 `manual` lo pega el lead.

| Unidad | Alcance | RED primero | Estimación |
|---|---|---|---|
| **U0** andamiaje | `package.json` del CLI (scripts, devDeps fijadas), Vitest, esbuild, Biome | — (sin comportamiento) | ~20 min |
| **U1** dominio y arquitectura | FR-004, FR-008, FR-009 · AC-4, AC-7, AC-8 | slugs inválidos y válido de 63; fixtures que violan | ~1 h |
| **U2** caso de uso | FR-001, FR-005, FR-006, FR-007, FR-010 · AC-5, AC-6 (con dobles de los puertos) | destino existente, falla a mitad, `name` | ~1 h |
| **U3** infraestructura y consola | FR-001 a FR-003, FR-010 · AC-1, AC-3, AC-5, AC-6, AC-9 (integración en temporales) | copia real, git, sin git en el `PATH`, ruta con espacio y acento | ~1,5 h |
| **V1** | AC-2 | `npm run test:e2e` | ~10 min de corrida |
| **V2** | AC-9 | salida pegada de `npm test` del CLI en Windows | — |

`packages/cli/AGENTS.md` se actualiza: firma de `new` en US-13 y opciones marcadas E2 (contradicción de §7).

## Riesgos abiertos

- **R1** el repo creado hereda tests de la plantilla que podrían asumir su ubicación en el monorepo: AC-2 lo detecta.
- **R2** `npm ci` en el repo creado necesita red; sin red, AC-2 falla (es lo esperado, VI).
- **R3** git en Windows con `core.autocrlf`: la plantilla fija LF por `.gitattributes`, y se copia.

## Complexity Tracking

| Excepción | Motivo | Alternativa descartada |
|---|---|---|
| Test de arquitectura propio | 3 capas y una regla; evita una dependencia más | dependency-cruiser |
| `test:e2e` fuera de `npm test` | ~8 min, red y navegadores | Correrlo en cada `npm test` |
