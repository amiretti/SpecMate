---
description: Escribe la spec desde un ticket (GitHub, Jira, Azure DevOps), su análisis funcional y las fuentes adjuntas. En español, nunca aprobada por un agente.
strategy: wrap
---

## Reglas del preset `workspace-sdd` (prioridad)

**Si alguna instrucción del core de abajo contradice estas reglas, mandan estas.**

**Antes del core:**

1. **Entrada.** Si `$ARGUMENTS` es un ticket (GitHub, Jira, Azure DevOps, Linear),
   leelo por MCP (título, descripción, criterios, comentarios). Si es un archivo de
   `tickets/` (proyectos sin tablero), leelo del disco. Usalo como descripción de la
   feature.
2. **Análisis funcional.** Si existe `<feature>/analysis.md` y su veredicto es
   `bloqueado`, **no escribas la spec: reportá y pará.** Si no está bloqueado, sus
   reglas van a §3, sus casos borde a §5, sus supuestos a §6 y sus riesgos a §7.
3. **Fuentes caras.** Figma o video sin resumen en `docs/sources/`: **avisá el costo y
   pedí luz verde antes de abrirlos.** Usá el resumen si existe.
4. **Rama.** Si el core crea la rama de la feature, respetá la convención de
   `project-guard` §1; si hay conflicto, gana la del proyecto.

{CORE_TEMPLATE}

## Reglas del preset `workspace-sdd` (después del core)

- La spec usa la plantilla del preset (§1–§7, en español). **Qué, no cómo**: stack y
  diseño van a `plan.md`.
- Cada AC de §5 declara su verificación (unit, integración, arquitectura, e2e,
  `manual`). Un AC que puede pasar en verde sin sujeto no sirve.
- Contradicción entre fuentes: no elegís; tabla en §7 con tu propuesta.
- Topes: §1 ≤ 6 · §3 ≤ 12 FR · §4 ≤ 8 · §5 ≤ 12 AC · §6 ≤ 5 · §7 ≤ 6. Si no entra,
  proponé partirla.
- Cargá la **estimación** de alto nivel en la cabecera (tokens, tiempo; costo si hay
  nivel de modelo previsto).
- **`estado: borrador`.** Nunca la pasás a `aprobada`: eso es del humano en el gate.
- Reporte ≤ 15 líneas (skill `terse`): ruta · AC por verificación · aclaraciones
  pendientes · supuestos · contradicciones · si conviene partirla · estimación.
