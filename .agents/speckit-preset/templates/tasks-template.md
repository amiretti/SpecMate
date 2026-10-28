---
spec: spec.md
plan: plan.md
estimacion_total: <tokens · tiempo · costo>
---

# Tareas: <título>

Formato: `- [ ] T### [P] [US#] <entregable> — <ruta> · cierra: AC-n · nivel: <rápido|estándar|máximo> · est: <~Nk tok · ~min> · verifica: `<comando>``

- **[P]**: paralelizable. Solo si **no comparte archivos, contrato ni build** con otra
  tarea abierta. Ante la duda, sin [P].
- **cierra**: los AC de §5 que la tarea deja en verde. Tarea sin AC = scope creep.
- **nivel**: según `model-routing`. Zona crítica → `máximo`.
- **verifica**: el comando que prueba la tarea (los tests de lo que toca, un build, un
  lint). **Lo corre el lead, no el agente**: si falla, la tarea no está hecha aunque el
  agente diga que sí. Tarea sin comando posible → `verifica: manual` y qué mirar.

## Fase 1 · Base (bloquea al resto)

- [ ] T001 <entregable> — <ruta> · cierra: — · nivel: estándar · est: <...> · verifica: `<comando>`

## Fase 2 · US1 (P1)

- [ ] T002 [P] [US1] <entregable> — <ruta> · cierra: AC-1 · nivel: estándar · est: <...> · verifica: `<comando>`
- [ ] T003 [US1] <entregable> — <ruta> · cierra: AC-2, AC-3 · nivel: máximo · est: <...> · verifica: `<comando>`

## Fase N · Cierre

- [ ] T0NN Verificación contra AC y gates (`qa`, una sola corrida completa)
