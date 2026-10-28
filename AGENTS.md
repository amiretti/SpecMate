# SpecMate

Workspace local de agentes de IA: el developer le habla a un solo agente y este lleva
cada ticket hasta el merge con un equipo de agentes, specs (Spec Kit), gates de
aprobación y el costo bajo control. Núcleo en un daemon local; interfaz como extensión
de VS Code (ADR-025, ADR-026).

Este archivo es para cualquier agente que trabaje en este repositorio, sea cual sea el
proveedor (estándar abierto AGENTS.md). Cada paquete tiene su propio `AGENTS.md` con su
lenguaje y sus invariantes.

## Antes de tocar nada

- Cargá la skill `terse` (mandamientos de costo) y `project-guard` (lo operativo), y leé
  la constitución (`.specify/memory/constitution.md`: principios, stack y barandas).
- Orden de autoridad: **ADR > spec > criterio propio.**
- El developer habla con **un solo agente**, el principal (rol `chief`), con el nombre
  que cada usuario elige en el primer arranque. El nombre vive en la configuración de
  usuario (`~/.workspace/user.json`), nunca en este repo.
- Configuración de agentes, skills y conectores: `.agents/`. Los archivos de cada
  proveedor (`CLAUDE.md`, `.claude/`, `.mcp.json`, `.codex/`) **son generados: no se
  editan a mano.**

## Estructura

```
packages/daemon/      # núcleo local: orquestación, event store, gates, presupuesto
packages/extension/   # extensión de VS Code: chat, agentes, bandeja de gates, consumo
.agents/              # roles, skills, conectores y ruteo (fuente neutral)
.specify/             # Spec Kit: constitución, plantillas y scripts
specs/                # una carpeta por historia
docs/adr/             # decisiones de arquitectura
tools/                # proyector, configuración de usuario y conectores
```

## Convenciones

- TypeScript estricto en los dos paquetes. Node.js LTS.
- Windows es la plataforma principal: rutas con `path`, nada de supuestos de shell
  POSIX en el código del producto.
- Ramas `###-slug`; commits `<type>: <desc>`; PR con `Closes #n`.
- Build: `npm run build --workspaces` · Tests: `npm test --workspaces`.
- El producto se construye con su propio flujo, **proporcional al riesgo** (ADR-0027,
  skill `feature-doc`): chico sin artefactos, grande con un `feature.md`, SDD con Spec
  Kit solo cuando el riesgo lo pide. Tests primero, pedido literal, delegación por
  referencia.
