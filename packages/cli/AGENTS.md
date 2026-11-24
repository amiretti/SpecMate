# packages/cli

El CLI de SpecMate (ADR-0029): lleva un sitio desde la carpeta del cliente hasta la
publicación. Comandos previstos:

| Comando | Qué hace | Épica |
|---|---|---|
| `specmate new <slug>` | Crea `./<slug>`: repo git con un commit, copia de lo que git versiona en `templates/site` (sin artefactos) y el `relevamiento.json` del cliente de ejemplo inventado, con dirección (US-13, US-14) | E1 |
| `specmate inventory <slug> [--clients <dir>]` | Inventaría `<raíz>/<slug>` (raíz: `--clients` o `SPECMATE_CLIENTS_DIR`, fuera del repo de SpecMate) en modo solo lectura y lo guarda en `steps.inventory` de `./<slug>/relevamiento.json`; repetible, conserva las correcciones a mano (US-15) | E2 |
| `specmate tokens <slug> [--clients <dir>] [--file <ruta>] [--confirm]` | Traduce el archivo de tokens que encontró el inventario al contrato del sitio (DTCG 2025.10 directo; otro formato, por el mapeo de `steps.tokens`), verifica el contraste WCAG 2.2 AA y escribe `./<slug>/src/data/tokens.json` solo con el mapeo confirmado para ese archivo, completo y con todas las parejas aprobadas (US-16) | E2 |
| `specmate brief` | Arma el brief verificable y lo valida contra su esquema | E2 |
| `specmate verify` | Corre todos los controles de ADR-0030 y escribe el informe de verificación | E5 |
| `specmate publish` | Publica en Cloudflare, solo con `verify` en verde y aprobación humana | E5 |

## Invariantes

- **El esquema del brief vive solo en la plantilla** (US-14, plan decisión 1): el validador de
  `relevamiento.json` es `templates/site/src/lib/site.ts` (`parseRelevamiento`), sin dependencias. El CLI no
  tiene un esquema propio ni usa Zod para el brief: cuando valide fuera del build (US-19), corre el validador del
  repo del sitio, así cada cliente queda con el esquema de su versión.
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
- **El inventario no lee contenido** (US-15): clasifica por nombre y extensión (`src/domain/inventory.ts`), lee
  solo la cabecera de las imágenes sin decodificarlas (`src/domain/image-header.ts`) y el hash de cada archivo;
  un posible secreto no se abre. No sigue links ni junctions, tiene topes (5000 archivos, 10 niveles, 50 MB) y no
  escribe nada en la carpeta del cliente. Los nombres de archivo se muestran con los caracteres de control escapados.
- **El contrato de tokens vive solo en la plantilla** (US-16, plan decisión 1): `specmate tokens` importa el
  `src/lib/tokens.ts` del repo del sitio (`TOKEN_PATHS` y `buildTokensCss`); el CLI no tiene copia de la lista. Un
  token sin valor, un valor que no convierte o un contraste bajo el umbral bloquean la escritura: nunca se completa con
  un valor por defecto. El archivo del cliente se lee entero solo si cabe en 1 MB y ninguna parte de su ruta es un link.
- **`new` es atómico:** se arma en `.<slug>.tmp-*` junto al destino y se publica con un
  `rename`; ante cualquier falla se borra el temporal. Un destino existente no se toca.
- **`new` copia solo lo versionado** (#53): la lista sale de lo commiteado en `templates/site`
  (`git ls-tree HEAD`); un archivo ignorado, sin trackear o solo en el índice (un `.env` local, el `CLAUDE.md`
  generado) nunca llega al repo de un cliente, y un symlink o un submódulo hacen fallar la copia.
- **Todo loop es acotado** (ADR-0033): la generación y corrección de opciones tiene
  tope de intentos y de tokens, y detecta estancamiento.
- **Caracteres de control, bidi o invisibles en el código** (pitfall repetido en US-14 y US-15): se escriben con la
  herramienta Edit o se arman con `String.fromCharCode`/rangos de `charCodeAt`, nunca por heredoc de shell con
  Python o Node, que deja escapes crudos o caracteres literales y rompe biome (`noControlCharactersInRegex`).
- Zonas críticas: los controles de `verify`, el esquema del brief y `publish`
  (`project-guard` §5).

## Comandos

`npm run build -w @specmate/cli` (tipos con `tsc` y bundle con esbuild a `dist/index.js`) ·
`npm test -w @specmate/cli` (unit, arquitectura e integración; segundos) ·
`npm run test:e2e -w @specmate/cli` (crea un repo y corre `npm ci`, build y los tests de la
plantilla dentro; ~8 min, necesita red y los navegadores de Playwright) ·
`npm run lint -w @specmate/cli`.
