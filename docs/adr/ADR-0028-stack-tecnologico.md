# ADR-0028 — Stack tecnológico del MVP

- **Estado:** Aceptada (2026-10-28, Andy)
- **Fecha:** 2026-10-28
- **Reemplaza:** — (concreta la sección *Stack y dependencias* de la constitución)
- **Afecta a:** `packages/daemon`, `packages/extension`, CI, constitución (stack, licencias y excepciones)

## Contexto

La constitución fijó el stack a grandes rasgos (Node LTS, TypeScript, SQLite, Agent SDK,
npm workspaces) y dejó abiertos el driver de SQLite y el runner de tests. Antes de
escribir código (US-04) hace falta fijar versiones y herramientas, porque cambiarlas
después cuesta.

Datos verificados el 2026-10-28:

- VS Code fija **Node 24.22.1** para su extension host (`.nvmrc` de `microsoft/vscode`,
  versión 1.145). Node 24 está en mantenimiento LTS hasta el 30/04/2028; Node 26 pasa a
  LTS alrededor de esta fecha.
- `node:sqlite` viene incluido en Node: llegó a *release candidate* en Node 25.7, y en
  **Node 24.22.1 funciona sin flag y sin advertencia** (probado el 2026-10-28). Node 24
  está en mantenimiento: su API ya no cambia.
- `@anthropic-ai/claude-agent-sdk` 0.3.x pide Node ≥ 18.14, trae binarios por
  plataforma (incluido `win32-x64`) y tiene **licencia propietaria de Anthropic**, fuera
  de la lista de licencias permitidas.
- El kit oficial de UI para webviews de VS Code (`vscode-webview-ui-toolkit`) fue
  discontinuado; el reemplazo de la comunidad es `@vscode-elements/elements` (MIT).
- TypeScript 7 (compilador nativo) es la versión estable.

## Decisión

| Área | Elección | Por qué |
|---|---|---|
| Runtime | **Node.js 24 LTS**, la misma línea que el extension host de VS Code | Un solo runtime para daemon y extensión; se sube cuando VS Code suba |
| Lenguaje | **TypeScript 7**, `strict`, ESM, solo sintaxis borrable (sin `enum`, `namespace` ni decoradores) | Compilación rápida; los scripts y tests corren con el *type stripping* de Node |
| Monorepo | **npm workspaces** | Sin herramientas extra en Windows |
| Build | **esbuild** (bundle del daemon y de la extensión); `tsc --noEmit` solo para tipos | Lo que recomienda VS Code para extensiones; un archivo por paquete |
| Lint y formato | **Biome** | Una herramienta en lugar de ESLint + Prettier |
| Tests | **Vitest**; **@vscode/test-cli** para las pruebas de integración de la extensión | Rápido, TypeScript nativo; la extensión se prueba dentro de VS Code real |
| IPC daemon ↔ extensión | **JSON-RPC 2.0 sobre named pipe** con `vscode-jsonrpc` | Mismo protocolo que LSP, probado en VS Code, sin puertos de red |
| MCP de control y conectores | `@modelcontextprotocol/sdk` | SDK oficial de MCP |
| Validación de mensajes | **Zod 4** | Lo usa el SDK de MCP; un solo validador |
| Event store | **SQLite incluido en Node (`node:sqlite`)**, detrás de un puerto `EventStore` | Cero dependencias y cero binarios nativos; transacciones atómicas para gates y estados de tareas; el puerto aísla un cambio de API |
| Agentes | `@anthropic-ai/claude-agent-sdk`; Codex app-server desde F2 | ADR-002 |
| Webviews | **Preact** + `@vscode-elements/elements` | API de React en pocos KB, con el aspecto nativo de VS Code |
| Empaquetado | `@vscode/vsce` para el VSIX; el daemon como script Node en el MVP | Ejecutable único (Node SEA) recién para terceros (E12) |
| Secretos locales | Token del daemon en `~/.workspace/` con permisos del usuario; la extensión usa `SecretStorage` de VS Code | `keytar` está discontinuado |
| CI | GitHub Actions en **windows-latest** y ubuntu-latest, Node 24 | Windows es la plataforma principal |
| Memoria | Engram (binario, se verifica con `doctor`) | ADR-017 |

Versiones: se fija la mayor en `package.json` y se versiona el `package-lock.json`. Las
dependencias nuevas siguen la regla de licencias de la constitución.

**Excepción de licencia:** `@anthropic-ai/claude-agent-sdk` (propietaria de Anthropic)
se acepta como dependencia del runtime de agentes. Su redistribución en un producto
para terceros se revisa en E12, junto con la consulta de US-02.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| `better-sqlite3` | Módulo nativo: baja un binario precompilado al instalar (falla detrás de proxies o sin la combinación justa de Node y plataforma, y entonces hay que compilar con herramientas de C++), y choca de ABI si el daemon corre con el Node de Electron. Fricción de instalación para cada PC del equipo a cambio de nada que necesitemos |
| Archivos JSONL de solo agregado | Sin transacciones: la decisión de un gate y el cambio de estado de la tarea tienen que ser atómicos (zona crítica); las consultas de la bandeja, los no leídos y las métricas habría que programarlas a mano. Se usa como formato de exportación y auditoría, no como almacén |
| SQLite en WebAssembly (`sql.js`, `wa-sqlite`) | Pensados para el navegador: `sql.js` mantiene la base en memoria y reescribe el archivo entero para persistir, inaceptable para un log que crece |
| libSQL, LMDB, PGlite | Los dos primeros también son nativos; PGlite (Postgres en WebAssembly) pesa varios MB y es mucho más de lo que hace falta |
| pnpm o Bun | Otra herramienta para instalar en cada PC del equipo; Bun además no es el runtime de VS Code |
| ESLint + Prettier | Dos herramientas y más configuración para el mismo resultado |
| Jest | Más lento y con soporte de ESM y TypeScript menos directo que Vitest |
| React completo o Svelte en webviews | Más peso, o un compilador más, para vistas chicas |
| HTTP o WebSocket en localhost entre daemon y extensión | Abre un puerto que cualquier proceso de la PC puede alcanzar; la named pipe con token es más cerrada (ADR-025) |

## Consecuencias

**Positivas:** un solo runtime y un solo lenguaje; herramientas rápidas; nada que
escuche en la red; el event store se puede cambiar de driver sin tocar el dominio.

**Negativas (costo asumido):** `node:sqlite` no está marcado como estable en Node 24:
si el daemon pasa a Node 26 puede haber algún cambio de API (el puerto `EventStore` lo
contiene a un archivo). La API es síncrona y bloquea el hilo durante cada escritura;
con un solo escritor y el volumen del daemon es despreciable, y si no lo fuera se mueve
a un worker thread. TypeScript 7
es reciente y algunas herramientas del ecosistema pueden quedar atrás. La excepción de
licencia del Agent SDK ata el producto a los términos de Anthropic.

**Cómo se impone:** `engines` y `.nvmrc` con Node 24; CI en Windows; Biome y `tsc
--noEmit` en el pipeline; `npm audit` y verificación de licencias antes de agregar una
dependencia (`project-guard` §6).

**Revisar cuando:** VS Code pase a Node 26 (validar `node:sqlite` en esa versión); US-02
dé su veredicto sobre distribución.
