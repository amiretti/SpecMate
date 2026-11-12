# El kit de agentes de SpecMate

Con este kit se **construye** SpecMate. Está en `.agents/`, en un formato propio que no
depende de ningún proveedor (ADR-013), y cada proveedor recibe una proyección generada.

Los agentes que el **producto** lleva a la carpeta de cada cliente (relevamiento,
opciones, construcción) son otra cosa: van a vivir en `packages/cli/agents/` y se crean
en las épicas E2 a E4. El mismo proyector los va a instalar en la carpeta del cliente.

## Estructura

```
AGENTS.md                  # instrucciones del proyecto (estándar abierto AGENTS.md)
.agents/
├── roles/                 # 5 roles, formato propio
│   ├── lead.md            # el agente principal: clasifica, trabaja inline, delega con motivo, verifica, cierra
│   ├── developer.md       # CLI y herramientas en TypeScript
│   ├── frontend.md        # plantilla del sitio y biblioteca de secciones (Astro)
│   ├── qa.md              # verificador independiente
│   └── security.md        # revisor de seguridad de los sitios y de la herramienta
├── skills/                # 8 skills, estándar abierto Agent Skills (SKILL.md)
│   ├── terse/             # mandamientos de costo (todos los roles la cargan)
│   ├── project-guard/     # lo operativo: repo, gates, zonas críticas, bloqueos
│   ├── feature-doc/       # flujo proporcional: ruta chica, grande o SDD, y el feature.md
│   ├── tasking/           # historia grande o SDD: tareas, inline o delegado, verificación
│   ├── close-story/       # cierre de historia o fase con el estado verdadero
│   ├── adr/               # redactar una ADR o detectar deriva
│   ├── spec/              # criterio de una buena spec (ruta SDD)
│   └── connectors/        # qué conectores hay y cómo pedir uno (se pide, no se activa)
├── speckit-preset/        # preset "workspace-sdd" de Spec Kit
├── autonomy.json          # el piso: lo que siempre pide aprobación humana
├── providers.json         # capacidades → herramientas y niveles → modelos, por proveedor
└── mcp.json               # catálogo de conectores MCP
tools/project.mjs          # proyector .agents/ → formato nativo (hoy: claude)
tools/mcp.mjs              # ver, activar y apagar conectores
tools/github-project.ps1   # campos del GitHub Project desde los issues
```

## Cómo se trabaja

Hablás con el **lead**. Trabaja inline por defecto y delega solo cuando puede nombrar
el motivo (lo midió Gentle AI: delegar sin motivo sale más caro y más lento):

| Motivo | A quién |
|---|---|
| Dos unidades independientes, sin archivos compartidos, de varios minutos cada una | `developer` y `frontend` en paralelo |
| Cambio en zona crítica, seguridad o números | `qa` o `security` como verificador independiente |
| Entender el código pide más que un par de búsquedas | un explorador de solo lectura |
| La sesión es larga y la siguiente unidad se puede acotar | el rol de la tarea, en una sesión nueva |

El que escribió un cambio nunca lo verifica.

**El piso** (`.agents/autonomy.json`) frena siempre y pide aprobación cada vez: push,
PR, publicar un sitio, comandos destructivos o fuera del worktree, contradicción con una
ADR, hallazgos de seguridad críticos o altos, un secreto detectado, instalar una skill
externa y activar un conector.

## Formato de un rol

```yaml
name: developer
description: >-          # cuándo usarlo; la lee el lead para decidir
capabilities: [read, write, execute, skills]   # abstractas, nunca nombres de herramientas
tier: estándar           # rápido | estándar | máximo, nunca un nombre de modelo
mcp: [memory, context7]  # conectores del catálogo que usa (solo los activos se proyectan)
skills: [terse, project-guard]
```

Capacidades: `read`, `write`, `execute`, `skills`, `delegate`, `network`,
`git-commit` y `git-push`. Cada proveedor las traduce en `providers.json`.

## Usarlo con Claude Code

```bash
node tools/project.mjs claude
```

Genera `.claude/agents/`, `.claude/skills/`, `.claude/settings.json` (abre la sesión
como el `lead`), `CLAUDE.md` (importa `AGENTS.md`) y `.mcp.json`. Todo lleva cabecera
`generado — no editar` y va en `.gitignore`.

- **Si editás un generado a mano, la próxima corrida no lo pisa**: avisa y te pide llevar
  el cambio a `.agents/` (o `--force` para descartarlo).
- **Lo que sobra se borra solo:** si sacás un rol o una skill de `.agents/`, la próxima
  corrida borra su proyección, salvo que la hayas editado. Lo que no generó el proyector
  (por ejemplo, las skills de Spec Kit) no se toca.
- **¿Quedó vieja?** `node tools/project.mjs claude --check` no escribe nada y sale con 1
  si la proyección no coincide. La sesión lo corre sola al arrancar (hook
  `SessionStart`).

## Verificación y revisión: nadie se aprueba solo

- **Cada tarea declara su `verifica:`** y lo corre el lead, no el agente. Si falla, la
  tarea queda pendiente aunque el agente diga que terminó.
- **`qa` y `security` terminan con una línea de veredicto** (`Veredicto: aprobado` o
  `Veredicto: cambios-pedidos`). La segunda vuelta es de seguimiento. **Tope: dos
  vueltas**; después, o sin veredicto, decide el developer.

## Conectores MCP

| Conector | Por defecto | Quién lo usa | Para qué |
|---|---|---|---|
| `github` | activo | sesión principal | Issues, PRs y repos (`GITHUB_TOKEN` en el entorno) |
| `memory` | activo | sesión principal | Engram: memoria del proyecto |
| `context7` | activo | developer, frontend, security | Documentación vigente de librerías (Astro, Zod, Playwright) |
| `playwright` | apagado | frontend, qa | Mirar un sitio en el navegador. **Caro:** cada captura entra al contexto; preferí los tests de Playwright |
| `firecrawl` | apagado | — | Leer sitios con mucho JavaScript (referencias, documentación) |

Solo `github` y `memory` van a la sesión principal; el resto se define dentro de los
roles que lo piden, para no pagar sus herramientas en cada turno del lead. Un agente que
necesita uno lo pide en su reporte (`pide-mcp: …`), y activarlo es decisión del
developer:

```bash
node tools/mcp.mjs list
node tools/mcp.mjs enable playwright     # o disable
```

## Flujo proporcional

Decisión en [ADR-0027](adr/ADR-0027-flujo-proporcional.md); procedimiento en la skill
`feature-doc`. El lead clasifica cada pedido con la **prueba de retomar** (¿se puede
retomar mañana solo con el pedido y el `git diff`?):

| Ruta | Cuándo | Qué se escribe |
|---|---|---|
| **Chica** | Pasa la prueba, se entiende y el riesgo está acotado | Nada: pedido literal, tests primero |
| **Grande** | No pasa la prueba de retomar | Un `specs/<###>-<slug>/feature.md` con un único gate |
| **SDD** | Reglas de negocio nuevas, zona crítica, arquitectura o historias en paralelo | Spec Kit con el preset `workspace-sdd` |

En las tres: preguntas y propuestas son de solo lectura hasta que pedís un cambio; el
pedido va literal; los agentes trabajan por referencia al documento; tests primero con
el rojo observado; commits por unidad de trabajo.

## Spec Kit (ruta SDD)

[Spec Kit](https://github.com/github/spec-kit) con el preset propio `workspace-sdd`,
que **compone sobre el core en vez de bifurcarlo**: envuelve `specify`, `plan` y `tasks`
con nuestras reglas, reemplaza las plantillas (formato propio en español, con los IDs de
Spec Kit) y reemplaza `implement` para que lo orqueste el lead.

En una PC nueva, las skills de Spec Kit se regeneran con:

```bash
specify init --here --force --integration claude --script ps --preset ./.agents/speckit-preset
specify preset resolve speckit.plan     # debe mostrar: core + [wrap] workspace-sdd
```

`init` no pisa la constitución si ya existe; si la pisara, se recupera de git.
