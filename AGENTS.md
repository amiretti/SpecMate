# SpecMate

De la carpeta del cliente a la web publicada: SpecMate genera sitios estáticos para
negocios (one page, landing o pocas páginas) desde el material del cliente, su URL de
Google Maps y referencias online, con datos verificados, tests, controles de seguridad
que bloquean la publicación y un diseño propio (ADR-0029, ADR-0030). Es un CLI más
agentes de Claude Code.

Este archivo es para cualquier agente que trabaje en este repositorio, sea cual sea el
proveedor (estándar abierto AGENTS.md). Cada paquete tiene su propio `AGENTS.md` con su
lenguaje y sus invariantes.

## Antes de tocar nada

- Cargá la skill `terse` (mandamientos de costo) y `project-guard` (lo operativo), y leé
  la constitución (`.specify/memory/constitution.md`: principios, stack y barandas).
- Orden de autoridad: **ADR > spec > criterio propio.**
- El developer habla con el agente principal (rol `lead`), que trabaja inline por
  defecto y delega solo con un motivo con nombre: escritores en paralelo, verificador
  independiente, exploración larga o respaldo de contexto.
- Configuración de agentes, skills y conectores: `.agents/`. Los archivos de cada
  proveedor (`CLAUDE.md`, `.claude/`, `.mcp.json`, `.codex/`) **son generados: no se
  editan a mano.**

## Estructura

```
packages/cli/         # CLI: new, brief, verify, publish
templates/site/       # plantilla de cada sitio de cliente (Astro, CSP, tests)
.agents/              # roles, skills, conectores y ruteo (fuente neutral)
.specify/             # Spec Kit: constitución, plantillas y scripts
specs/                # una carpeta por historia
docs/adr/             # decisiones de arquitectura
tools/                # proyector a cada proveedor, conectores y GitHub Project
```

## Convenciones

- TypeScript estricto. Node.js 24 LTS.
- Windows es la plataforma principal: rutas con `path`, nada de supuestos de shell
  POSIX en el código del producto.
- Ramas `###-slug`; commits `<type>: <desc>`; PR con `Closes #n`.
- Build: `npm run build` · Tests: `npm test`.
- El producto se construye con su propio flujo, **proporcional al riesgo** (ADR-0027,
  skill `feature-doc`): chico sin artefactos, grande con un `feature.md`, SDD con Spec
  Kit solo cuando el riesgo lo pide. Tests primero, pedido literal, delegación por
  referencia.
