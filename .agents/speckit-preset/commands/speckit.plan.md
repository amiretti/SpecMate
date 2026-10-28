---
description: Plan técnico (cómo) desde la spec aprobada, con artefactos solo cuando hacen falta y RFC/ADR si cambia la arquitectura.
strategy: wrap
---

## Reglas del preset `workspace-sdd` (prioridad)

**Si alguna instrucción del core de abajo contradice estas reglas, mandan estas.**

1. **La spec tiene que estar `aprobada`.** Si está en `borrador`, reportá y pará.
2. **Constitución + `project-guard`.** El Constitution Check del core incluye además las
   zonas críticas (`project-guard` §5) y los bloqueos vigentes (§7). Si la feature toca
   un bloqueo, no hay plan: reportá.
3. **Artefactos condicionales.** El core los genera siempre; acá, solo si aportan:

| Artefacto | Se genera solo si |
|---|---|
| `research.md` | Hay `[NEEDS CLARIFICATION]` técnicas, o hay que elegir librería o enfoque entre alternativas |
| `data-model.md` | La feature crea o cambia entidades persistidas |
| `contracts/` | La feature expone o consume una interfaz (API, eventos, mensajes) |
| `quickstart.md` | Zona crítica, o AC `manual` que necesitan un guion de validación |

   Lo que no se genera se declara en una línea en `plan.md` ("sin cambios de modelo de
   datos"), para que nadie lo busque.

{CORE_TEMPLATE}

## Reglas del preset `workspace-sdd` (después del core)

- **Si el plan cambia la arquitectura** (un borde entre módulos, una dependencia nueva,
  algo que ninguna ADR fija o que contradice una), marcalo en `plan.md` como
  **RFC requerido**: se abre como PR para discusión y termina en una ADR (skill `adr`).
  No se taskea hasta que la ADR esté aceptada.
- Complexity Tracking del core: toda excepción a los principios de la constitución va
  con su motivo. Sin motivo, no hay excepción.
- **Tamaño de `plan.md`: entre 900 y 1.600 tokens** (guía, no gate). Menos suele dejar
  ambigüedad; más degrada el contexto del agente que implementa. Si no entra, el
  detalle va a `data-model.md` o `contracts/`, o son dos features.
- Actualizá la **estimación** de la cabecera de la spec con lo que sabés ahora.
- Reporte ≤ 15 líneas: ruta · artefactos generados y omitidos · RFC sí/no · zona
  crítica sí/no · excepciones a la constitución · estimación actualizada.
