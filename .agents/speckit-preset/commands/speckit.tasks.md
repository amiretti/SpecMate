---
description: Tareas de un entregable desde spec + plan, con [P], AC que cierra, nivel de modelo y estimación. Lo usa el lead.
strategy: wrap
---

## Reglas del preset `workspace-sdd` (prioridad)

**Si alguna instrucción del core de abajo contradice estas reglas, mandan estas.**

1. **Precondiciones:** spec `aprobada`, `plan.md` existente y sin "RFC requerido"
   pendiente. Si falla alguna, reportá y pará.
2. **Formato:** el de la plantilla `tasks-template` del preset:
   `- [ ] T### [P] [US#] <entregable> — <ruta> · cierra: AC-n · nivel: <…> · est: <…>`

{CORE_TEMPLATE}

## Reglas del preset `workspace-sdd` (después del core)

- **Una tarea = un entregable.** Cadena acoplada (tipo + analizador + tests) = una tarea.
- **`cierra:`** obligatorio. Tarea sin AC = scope creep: sacala o pedí el AC. Lo que
  está en §4 de la spec no se hace.
- **`[P]`** solo si no comparte archivos, contrato ni build con otra tarea abierta. El
  contrato compartido lo congela una tarea previa, sin `[P]`.
- **Tests:** según la constitución del proyecto, no según el default opcional del core.
- **`nivel:`** por `model-routing`: default `estándar`; zona crítica → `máximo`;
  `rápido` solo para lo mecánico y verificable por un comando.
- **`est:`** por tarea, y el total en la cabecera.
- Última tarea: verificación contra AC y gates (`qa`, una sola corrida completa).
- **No despaches nada:** `tasks.md` va al gate humano de plan.
- Reporte ≤ 10 líneas: ruta · tareas por fase · `[P]` · tareas en `máximo` y por qué ·
  estimación total · AC sin tarea (debe ser cero).
