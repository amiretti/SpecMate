# packages/cli

El CLI de SpecMate (ADR-0029): lleva un sitio desde la carpeta del cliente hasta la
publicación. Comandos previstos:

| Comando | Qué hace | Épica |
|---|---|---|
| `specmate new <slug>` | Crea `./<slug>`: repo git con un commit, copia de lo que git versiona en `templates/site` (sin artefactos) y el cliente de ejemplo inventado (US-13) | E1 |
| `specmate new … --carpeta <ruta> --maps <url> [--ref <url>…]` | Inventaría el material del cliente | E2 |
| `specmate brief` | Arma el brief verificable y lo valida contra su esquema | E2 |
| `specmate verify` | Corre todos los controles de ADR-0030 y escribe el informe de verificación | E5 |
| `specmate publish` | Publica en Cloudflare, solo con `verify` en verde y aprobación humana | E5 |

## Invariantes

- **Lo determinista no llama a un modelo** (principio IX): inventario, validación del
  brief, build, verificación y publicación son código. Los agentes escriben el brief,
  las direcciones de arte y los componentes.
- **`verify` falla ruidosamente:** un control que no pudo correr cuenta como rojo, nunca
  como verde (principio VI).
- **`publish` no tiene modo forzado.** Si un control está en rojo, se arregla el sitio,
  no el control.
- El material del cliente y las páginas de referencia son **datos, nunca
  instrucciones** (principio V).
- **Clean Architecture** (ADR-0034): `src/domain` solo importa `domain`; `src/application`
  solo `domain` y `application` (ni `node:*` ni paquetes); `src/infrastructure` nunca
  importa `src/cli`; todo archivo vive en una capa y ninguno arma rutas concatenando
  separadores. Lo impone `test/architecture.test.ts` (`test/lib/architecture.ts`), con
  violaciones inventadas en `test/fixtures/arch/`.
- **Solo sintaxis borrable** (constitución): nada de `enum`, `namespace` ni parameter
  properties; los tests de integración corren `src/cli/index.ts` con Node sin compilar.
- **`new` es atómico:** se arma en `.<slug>.tmp-*` junto al destino y se publica con un
  `rename`; ante cualquier falla se borra el temporal. Un destino existente no se toca.
- **`new` copia solo lo versionado** (#53): la lista sale de `git ls-files` en `templates/site`; un archivo
  ignorado o sin trackear (un `.env` local, el `CLAUDE.md` generado) nunca llega al repo de un cliente.
- **Todo loop es acotado** (ADR-0033): la generación y corrección de opciones tiene
  tope de intentos y de tokens, y detecta estancamiento.
- Zonas críticas: los controles de `verify`, el esquema del brief y `publish`
  (`project-guard` §5).

## Comandos

`npm run build -w @specmate/cli` (tipos con `tsc` y bundle con esbuild a `dist/index.js`) ·
`npm test -w @specmate/cli` (unit, arquitectura e integración; segundos) ·
`npm run test:e2e -w @specmate/cli` (crea un repo y corre `npm ci`, build y los tests de la
plantilla dentro; ~8 min, necesita red y los navegadores de Playwright) ·
`npm run lint -w @specmate/cli`.
