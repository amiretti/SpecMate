# SpecMate — kit de inicio (agentes y skills, neutral al proveedor)

Punto de partida genérico para el workspace de agentes. Sale de agentes usados en un
proyecto real, sin nada específico de ese proyecto y **sin atarse a ningún proveedor**
(ADR-013): la fuente vive en `.agents/` y cada runtime recibe una proyección generada.

## Estructura

```
AGENTS.md                  # instrucciones del proyecto (estándar abierto AGENTS.md)
.agents/
├── roles/                 # 10 roles, formato propio (no hay estándar entre vendors)
│   ├── chief.md           # EL agente con el que hablás; nombre a elección de cada usuario
│   ├── lead.md            # team leader de una historia (con un equipo, fusionado en chief)
│   ├── functional-analyst.md  # 1ra etapa: reglas, flujos, impacto, riesgos, bloqueos
│   ├── product-owner.md   # análisis + ticket + fuentes → spec; marca contradicciones y propone
│   ├── architect.md       # decisiones, ADR, deriva código↔ADR
│   ├── backend.md · frontend.md
│   ├── qa.md · security.md
│   └── scrum-master.md
├── skills/                # 13 skills, estándar abierto Agent Skills (SKILL.md)
│   ├── terse/             # MANDAMIENTOS DE COSTO (todos los roles la cargan)
│   ├── model-routing/     # qué nivel de modelo para qué tarea
│   ├── project-guard/     # lo operativo del proyecto (repo, gates, zonas críticas, bloqueos)
│   ├── spec/ (criterio) · tasking/ · adr/ · close-story/ · checkpoint/
│   ├── onboarding/        # primer arranque: se presenta y te pregunta su nombre
│   ├── chief-report/      # mensajes del agente principal, ≤ 6 líneas (celular)
│   ├── profile/           # perfil del developer: se actualiza solo al cierre
│   ├── connectors/        # qué conectores hay y cómo pedir uno (se pide, no se activa)
│   └── feature-doc/       # flujo proporcional: ruta chica, grande o SDD, y el feature.md
├── speckit-preset/        # preset "workspace-sdd" de Spec Kit: compone sobre el core
│   ├── templates/         # spec · tasks · constitution (formato propio, replace)
│   └── commands/          # specify · plan · tasks (wrap del core) · implement (→ lead, replace)
├── autonomy.json          # nivel de autonomía y piso de gates
├── runtimes.json          # runtimes, suscripciones (nivel → modelo) y ruteo entre ellas
└── mcp.json               # catálogo de conectores MCP: activos y listos para activar
tools/project.mjs          # proyector .agents/ → formato nativo (hoy: claude)
tools/user-config.mjs      # configuración de usuario: nombre del agente y perfil
tools/mcp.mjs              # activar y desactivar conectores del catálogo
```

## El agente principal y su nombre

Hablás con **un solo agente** (rol `chief`). El nombre no viene de fábrica: lo elegís
vos. En el primer arranque se presenta, te pregunta cómo querés llamarlo y lo guarda.

- **Dónde vive:** `~/.workspace/user.json`, campo `agentName`. Es de nivel usuario:
  vale para todos tus proyectos y **nunca se versiona en un repo**. En un equipo, cada
  uno le habla a su agente con su nombre.
- **Cómo llega al agente:** el proyector lee ese archivo y le inyecta la identidad al
  generar `.claude/agents/chief.md`. Sin nombre, el agente arranca en modo
  presentación (skill `onboarding`).
- **Cambiarlo:** pedíselo al agente, o `node tools/user-config.mjs set agentName "<nombre>"`
  (regenera la proyección).

**Perfil del developer:** `~/.workspace/profile.md`, tope de 2.000 caracteres. El agente
lo actualiza solo al cerrar una sesión o una historia, sin pedir OK; cada versión
anterior queda en `~/.workspace/profile.history/`. Comandos: `profile-show`,
`profile-history`, `profile-revert <archivo>`.

**Con un solo equipo, el agente principal y el lead son la misma sesión:** el proyector
fusiona `chief.md` con `lead.md` (`fuses: lead`), con las herramientas de los dos y el
nivel del lead, porque es quien orquesta y verifica. Cuando haya equipos en paralelo
(fase 3), el daemon los separa.

## Formato de un rol

```yaml
name: backend
description: >-          # cuándo usarlo; la lee el lead para decidir
capabilities: [read, write, execute, skills]   # abstractas, nunca nombres de tools
tier: estándar           # rápido | estándar | máximo — nunca un nombre de modelo
mcp: [memory, context7]  # conectores del catálogo que usa (solo los activos se proyectan)
skills: [terse, project-guard]
```

Capabilities disponibles: `read`, `write`, `execute`, `skills`, `delegate`, `network`,
`git-commit`, `git-push`. Cada runtime las traduce en `runtimes.json`.

## Usarlo con Claude Code hoy

```bash
node tools/project.mjs claude
```

Genera `.claude/agents/`, `.claude/skills/`, `.claude/settings.json` (abre la sesión
principal como el agente `chief`), `CLAUDE.md` (importa `AGENTS.md`) y `.mcp.json`.
Todo lleva cabecera `generado — no editar`. Después, `claude` a secas arranca con tu
agente; la primera vez se presenta y te pregunta su nombre.

- **Si editás un generado a mano, la próxima corrida no lo pisa**: avisa y te pide llevar
  el cambio a `.agents/` (o `--force` para descartarlo).
- Los generados van en `.gitignore`: se versiona solo la fuente.
- **¿Quedó vieja?** `node tools/project.mjs claude --check` no escribe nada y sale con 1
  si la proyección no coincide con `.agents/`. La sesión principal lo corre sola al
  arrancar (hook `SessionStart`) y te avisa. No sirve en CI: los generados no se
  versionan y dependen de tu configuración de usuario.
- Codex lee `AGENTS.md` y `.agents/skills/` de forma nativa. Los roles, para Codex, los
  orquesta la app (adaptador pendiente).

## Verificación y revisión: nadie se aprueba solo

Dos reglas que hacen mecánico el principio "un reporte no es
evidencia":

- **Cada tarea declara su comando de verificación** (`verifica:` en `tasks.md`) y **lo
  corre el lead**, no el agente. Si falla, la tarea queda *necesita atención* aunque el
  agente diga que terminó.
- **`qa` y `security` terminan con una línea de veredicto** (`Veredicto: aprobado` o
  `Veredicto: cambios-pedidos`). La segunda vuelta es una **revisión de seguimiento**:
  los hallazgos anteriores (resuelto, no resuelto, parcial) y las regresiones del
  arreglo, no todo de nuevo. **Tope: dos vueltas**; después, o sin veredicto, decide el
  developer. Nunca un ciclo a ciegas.

## Conectores MCP

El catálogo vive en `.agents/mcp.json`: cada conector viene **preparado y apagado**
salvo los que no tienen costo ni secretos. Se activa con un comando, que avisa si falta
una variable de entorno o completar algo, y regenera la proyección:

```bash
node tools/mcp.mjs list                 # estado, quién lo usa, qué falta
node tools/mcp.mjs enable firecrawl     # o disable (decisión humana)
node tools/mcp.mjs grant playwright qa --story US-12   # concesión por historia (lead)
```

**Regla de costo:** las herramientas de cada conector se pagan en cada turno del agente
que las tiene. Por eso:

- Solo `github` y `memory` (y el tablero que actives: `jira`, `linear` o
  `azure-devops`) van a la **sesión principal** (`main: true`, `.mcp.json`).
- El resto se define **dentro de los roles que lo piden** (campo `mcp:` del rol): el
  proyector lo escribe en el `mcpServers` del agente y le habilita sus herramientas. La
  sesión principal no carga sus definiciones.

| Conector | Por defecto | Roles | Costo y cuidado |
|---|---|---|---|
| `github`, `memory` | activo | sesión principal y quien lo pida | `GITHUB_TOKEN` en el entorno |
| `jira` · `linear` · `azure-devops` | apagado | sesión principal, analista, PO, scrum master | activá solo el tablero que usás |
| `context7` | activo | architect, backend, frontend, security | gratis; docs vigentes de librerías, menos APIs inventadas |
| `microsoft-learn` | apagado | architect, backend | gratis, sin login; activalo en proyectos .NET o Azure |
| `playwright` | apagado | frontend, qa | **caro**: cada snapshot entra al contexto. Preferí el CLI (abajo) |
| `firecrawl` | apagado | architect, analista, PO | OAuth; uso gratis diario limitado. Para sitios donde WebFetch falla |
| `perplexity` | apagado | architect | **cobra por llamada** (`PERPLEXITY_API_KEY`). WebSearch primero |
| `posthog` | apagado | analista, PO | solo lectura y herramientas acotadas desde la URL |
| `figma` | apagado | frontend, PO | fuente cara: el preset pide avisar antes de abrirla |
| `sentry` | apagado | backend, analista | errores de producción como evidencia de bugs |
| `composio` | apagado | analista, PO | **tercero en el medio** de todas las apps que conectes; solo para fuentes sin conector oficial |

**Los agentes conocen el catálogo y piden lo que les falta.** La skill `connectors` les
dice qué hay y cómo pedirlo; no se lo activan solos, porque sumar una herramienta es
sumar un permiso (y una vía para que una instrucción inyectada saque datos). El agente
deja `pide-mcp: <conector> · para: … · sin él: …` en su reporte y el lead decide:

| Riesgo | Quién aprueba |
|---|---|
| `bajo`: sin costo extra ni datos sensibles (context7, microsoft-learn, playwright, firecrawl) | el lead, desde el nivel de autonomía 2; en 0 y 1, el developer |
| `alto`: cobra, datos de producción o un tercero en el medio (perplexity, posthog, sentry, figma, composio) | siempre el developer (piso) |

Concedido, el lead corre `node tools/mcp.mjs grant <conector> <rol> --story <US-ID>`: la
proyección se regenera y Claude Code toma el cambio en la próxima delegación, sin
reiniciar. La concesión vive en `.workspace/mcp-grants.json` (local) y `close-story` la
revoca. Lo ideal es concederlo al taskear, antes del primer spawn: a mitad de tarea
obliga a relanzar al agente.

**Hoy es una regla, no una barrera.** Nada impide técnicamente que un subagente con
`Bash` corra `tools/mcp.mjs`; el daemon lo va a imponer (solo él escribe el catálogo y
las concesiones). Hasta entonces, si querés blindarlo, negá ese comando en los permisos
de Claude Code y dejá que lo corras vos.

**Playwright: CLI antes que MCP.** El CLI escribe los snapshots a disco y le devuelve al
agente una ruta, en lugar de meter cada snapshot en el contexto (las mediciones
publicadas dan varias veces menos tokens). Instalación:
`npm install -g @playwright/cli` y `playwright-cli install --skills`. Esa skill se
escribe en `.claude/skills/`: revisala y copiala a `.agents/skills/playwright-cli/` para
que sea parte de la fuente neutral (licencia Apache-2.0).

**A verificar:** que Claude Code expanda `${VARIABLE}` dentro de los `mcpServers`
definidos en un agente igual que en `.mcp.json` (afecta a `perplexity`). Si no, usá el
login OAuth de Perplexity o pasalo a la sesión principal.

## Flujo proporcional: ODD por defecto, SDD cuando el riesgo lo pide

Decisión en [ADR-0027](adr/ADR-0027-flujo-proporcional.md); procedimiento en la skill
`feature-doc`. El lead clasifica cada pedido con la **prueba de retomar** (¿se puede
retomar mañana solo con el pedido y el `git diff`?):

| Ruta | Cuándo | Qué se escribe |
|---|---|---|
| **Chica** | Pasa la prueba, se entiende y el riesgo está acotado | Nada: pedido literal, tests primero, gate de diff y PR |
| **Grande** | No pasa la prueba de retomar | Un `specs/<###>-<slug>/feature.md` (specs citadas literal, tareas, registro) con un único gate |
| **SDD** | Reglas de negocio nuevas, cliente que aprueba el *qué*, zona crítica, arquitectura o historias en paralelo | Spec Kit completo (abajo) |

En las tres: preguntas y propuestas son de solo lectura hasta que pedís un cambio; el
pedido original va literal; los agentes trabajan por referencia al documento; tests
primero con el rojo observado; commits por unidad de trabajo (unas 400 líneas como
guía), lo de alto riesgo en un commit propio.

## Spec-driven development con Spec Kit (ruta SDD)

El SDD sigue a [Spec Kit](https://github.com/github/spec-kit) con el preset propio
`workspace-sdd`. Todo lo de una historia vive en `specs/<###>-<slug>/`:

```
ticket ─► analysis.md ─► spec.md ─► [gate] ─► plan.md ─► tasks.md ─► [gate] ─► despacho multi-agente
         (AFU)          (PO, /speckit-specify)   (architect)  (lead, /speckit-tasks)   (lead, no /implement)
```

**Principio: componer, no bifurcar.** Los comandos del core se **envuelven** (`wrap`):
nuestras reglas van antes y después del comando original, con prioridad explícita ante
conflicto. Así heredamos las mejoras del core y sus scripts (carpeta y rama de la
feature, checklist de requisitos, aclaraciones).

| Pieza | Estrategia | Qué agrega el preset |
|---|---|---|
| Plantillas `spec`, `tasks`, `constitution` | replace | Formato propio en español; mantiene los IDs de Spec Kit (`US#`, `FR-###`, `SC-###`, `[P]`, `[NEEDS CLARIFICATION]`) para que `analyze` y `converge` sigan andando |
| `speckit.specify` | wrap | Ticket por MCP, análisis funcional, aviso de fuentes caras, topes, estimación, nunca `aprobada` |
| `speckit.plan` | wrap | Artefactos **condicionales** (research, data-model, contracts, quickstart solo si aportan), RFC/ADR si cambia la arquitectura, zonas críticas en el Constitution Check |
| `speckit.tasks` | wrap | AC que cierra, nivel de modelo y estimación por tarea; `[P]` estricto |
| `speckit.implement` | **replace** | La única bifurcación: la implementación la orquesta el `lead`, una tarea `[P]` por worktree |

**La constitución es la única fuente de principios, stack y barandas.** Trae seis
principios por defecto (simplicidad, Clean Architecture donde hay dominio, SOLID,
verificable o no está hecho, seguridad en dos capas, fallar ruidosamente).
`project-guard` quedó solo con lo operativo.

Verificar la composición después de instalar: `specify preset resolve speckit.plan`.

**Instalación (ADR-018):** Python solo hace falta para *configurar* (init y preset); los
comandos corren scripts de bash o PowerShell. La app lo resuelve bajo demanda: usa
`specify` o `uv` si ya están; si no, baja uv fijado y con checksum verificado, y uv trae
su propio Python. En Windows, `init` va con `--script ps`. A mano, hoy:

```bash
specify init . --integration claude --script sh   # Windows: --script ps · o codex, gemini…
specify preset add --dev .agents/speckit-preset
specify preset resolve speckit.plan     # debe mostrar: core + [wrap] workspace-sdd
```

**Ojo con la constitución:** `init` siembra `.specify/memory/constitution.md` con la
plantilla del core **antes** de que exista el preset, e instalar un preset después no la
reescribe. Después de `preset add`, corré `/speckit-constitution` (resuelve nuestra
plantilla y completa los datos del proyecto) o reemplazá el archivo si todavía está sin
tocar.

Probado el 19/10 con Spec Kit 1.2.2: la composición resuelve como se espera y los
comandos envueltos quedan en unas 2.800 (specify), 1.400 (plan) y 1.900 (tasks)
palabras. El core del plan sigue diciendo que `research.md` es prerrequisito de la fase
1; la regla de prioridad del preset lo resuelve, pero conviene vigilarlo en las primeras
features.

## Cómo adaptarlo a un proyecto

1. Completá `.agents/skills/project-guard/SKILL.md` y `AGENTS.md`.
2. En `.agents/runtimes.json`, dejá solo las suscripciones que tenés y completá el
   mapeo de OpenAI si vas a usar Codex.
3. Sumá skills de stack en `.agents/skills/` y referencialas en los roles que las usan.
4. Un rol especializado se crea copiando el genérico más cercano y agregando solo lo
   específico. **No dupliques** lo que ya dice `project-guard`.
