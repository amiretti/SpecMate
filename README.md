# SpecMate

**Tu compañero de desarrollo con IA.** Le hablás a un solo agente y él lleva cada
ticket hasta el merge con un equipo de agentes, specs, gates de aprobación y el costo
bajo control. Local, en VS Code, con tu propia suscripción.

> **Estado:** en construcción. Estamos en el spike de la fase 0 (épica E0). Todavía no
> hay nada para instalar.

## Qué va a hacer

- **Un solo interlocutor.** Le hablás a tu agente, con el nombre que le pongas. Él arma
  el equipo (analista, product owner, arquitecto, backend, frontend, QA, seguridad) y te
  trae las decisiones listas para aprobar.
- **Del ticket al merge con proceso.** Desarrollo guiado por especificación con
  [Spec Kit](https://github.com/github/spec-kit): análisis, spec, plan, tareas,
  implementación en worktrees y PR.
- **Vos decidís cuánto intervenir.** Cinco niveles de autonomía, con un piso que ninguno
  saltea: push, PR, secretos y comandos destructivos siempre pasan por vos.
- **El costo como requisito.** Modelo justo para cada tarea, estimación antes de
  arrancar, consumo de tu suscripción a la vista y checkpoint antes de que se corte.
- **Local y neutral.** Corre en tu PC, en VS Code, con tu suscripción de Claude (Codex,
  más adelante). Los agentes, skills y conectores viven en un formato propio que se
  proyecta al de cada proveedor.

## Cómo está armado

| Pieza | Qué es |
|---|---|
| `packages/daemon` | Núcleo local: orquesta agentes, registra cada paso, aplica gates y presupuesto |
| `packages/extension` | Extensión de VS Code: chat, agentes en vivo, bandeja de gates, consumo |
| `.agents/` | Roles, skills, conectores MCP y ruteo entre suscripciones |
| `.specify/` | Spec Kit con el preset `workspace-sdd` y la constitución del proyecto |

## Trabajar en el repo

Hoy el repo se trabaja con su propio kit de agentes sobre Claude Code:

```bash
node tools/project.mjs claude   # genera la configuración de Claude Code desde .agents/
claude                          # abre el agente principal; la primera vez te pide su nombre
```

Spec Kit ya está inicializado con el preset (`.specify/`). En una PC nueva, las skills de
Spec Kit para Claude se regeneran con
`specify init --here --force --integration claude --script ps --preset ./.agents/speckit-preset`.
Detalle del kit: [docs/kit.md](docs/kit.md).

## Licencia

Sin licencia por ahora: todos los derechos reservados. El código es visible, pero no se
puede usar, copiar ni redistribuir sin permiso.
