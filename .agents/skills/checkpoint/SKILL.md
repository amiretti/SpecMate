---
name: checkpoint
description: >-
  Congela el trabajo en disco cuando se acerca un límite de consumo (sesión, semanal o
  contexto) y lo restaura al retomar, borrando el checkpoint solo cuando la reanudación
  anduvo. La usa el lead. Invocar como /checkpoint save | resume.
metadata:
  argument-hint: "save | resume"
---

# Checkpoint: $1

## Cuándo guardar (lo dispara el lead o la app)

| Disparador | Umbral |
|---|---|
| Ventana de sesión (5 h) | ≥ 85% |
| Ventana semanal | ≥ 95% |
| Aviso de límite del runtime | al recibirlo |
| Contexto de un agente | ≥ 80% |
| El developer lo pide | siempre |

## save

1. Pedí a cada agente que escribe que **cierre su paso actual** (no a mitad de un
   archivo) y haga **commit local de trabajo** en su rama: `wip: <tarea>`. Nunca push.
2. Escribí `.workspace/checkpoints/<historia>.md` en modo `terse`:

```markdown
---
historia: US-XXX
creado: <ISO>
nivel: <autonomía>
gate: <spec | plan | diff | pr | —>
---
## hecho
- T1 <tarea> · <evidencia: comando · conteo>
## en curso
| agente | nivel | worktree | rama | commit | sesión | haciendo | siguiente |
|---|---|---|---|---|---|---|---|
## decisiones no escritas en otro lado
- <una por línea>
## pendiente del humano
- <gate o pregunta abierta>
```

3. Registrá el evento `session.checkpointed` y avisá al developer en una línea: dónde
   quedó y qué se retoma.

## resume

1. Leé el checkpoint. **Verificá el disco**: cada rama existe y su HEAD es el commit
   guardado. Si algo no coincide, **no retomes a ciegas**: decí qué cambió y pedí cómo
   seguir.
2. Retomá cada agente por su id de sesión si el runtime lo permite; si no, levantá uno
   nuevo con su fila del checkpoint como prompt masticado (mismo nivel).
3. **Borrá el checkpoint solo cuando el primer paso retomado terminó bien.** Si lo borrás
   al leerlo y la reanudación falla, perdiste el avance.
4. Registrá `session.resumed`.

## Basura

- Un checkpoint de más de 7 días o de una historia ya cerrada se **lista** al abrir el
  workspace. No se borra solo.
- Los commits `wip:` se aplastan antes del PR.

## Corte sin aviso

Si no hubo checkpoint, reconstruí uno aproximado desde el event store (`agent.*`,
`task.*`, `fs.*`). Los eventos dan los hechos, **no la intención**: el siguiente paso de
cada agente y las decisiones no escritas se infieren, y pueden estar mal. Antes de
retomar, corré build y tests (el código puede haber quedado a mitad de tarea) y mostrale
al developer lo reconstruido para que lo confirme. Es caro: por eso se guarda antes.
