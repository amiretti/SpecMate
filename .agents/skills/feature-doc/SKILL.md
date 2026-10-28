---
name: feature-doc
description: >-
  Flujo proporcional (ADR-0027): cómo clasificar un pedido (chico, grande o SDD) con la
  prueba de retomar, y cómo escribir y mantener el documento único de una feature
  grande (specs citadas literal, tareas y registro). La usa el lead al recibir un
  pedido; los agentes la leen para trabajar por referencia al documento.
metadata:
  argument-hint: "[pedido | ruta del feature.md]"
---

# Flujo proporcional

## 1. Autorizar

¿El pedido autoriza un cambio? Preguntas, análisis, revisiones y propuestas son **de
solo lectura** hasta que el developer pide cambiar algo. No se crean documentos ni se
toca código.

## 2. Explorar y resolver dudas

Explorá el código y las fuentes **en proporción al pedido**. Para cerrar dudas:

- Investigación solo para una duda con nombre.
- **Una** pregunta al developer por cada decisión de producto real, de a una.
- Como mucho **un** cuestionamiento independiente a una premisa de alto impacto no
  probada (incluso en un cambio chico, si es de seguridad).

## 3. Clasificar (la prueba de retomar)

> ¿Se podría retomar este trabajo mañana, en otra sesión, solo con el pedido y el
> `git diff`?

| Ruta | Cuándo | Qué se escribe |
|---|---|---|
| **Chica** | Pasa la prueba, se entiende y el riesgo está acotado | Nada. Pedido literal en el prompt del agente |
| **Grande** | No pasa la prueba: varias sesiones, esperas externas, requisitos que no sobreviven a una compactación | Un `feature.md` (§4) y su espejo en Engram |
| **SDD** | Reglas de negocio nuevas, un cliente aprueba el *qué*, zona crítica (`project-guard` §5), cambio de arquitectura o historias en paralelo | Spec Kit completo (`/speckit-specify` y siguientes) |

- **La cantidad de archivos, comandos o tareas no decide nada.**
- Anunciá la ruta en una línea con su motivo: *"ruta grande · tres sesiones y espera
  respuesta del cliente"*. El developer puede pedir otra.
- Ante la duda entre dos rutas, la más larga.

## 4. El documento de una feature grande

Ruta: `specs/<###>-<slug>/feature.md`. Se crea **antes de la primera escritura de
código** y se le avisa al developer en una línea (ruta y cantidad de tareas). Es lo que
aprueba el developer en el único gate previo al código.

```markdown
---
estado: borrador          # borrador | aprobada | hecha
ticket: <url o "pedido directo">
estimacion: <~Nk tok · ~horas>
tests: <runner y comando>
entrega: ask-on-risk      # o single-pr | auto-chain
---

# <título>

## Specs

- **S1** — <lo que tiene que pasar, con las palabras, mensajes y ejemplos EXACTOS del
  pedido entre comillas>.
  - AC: <criterio observable> · verifica: <unit | integración | e2e | manual> `<comando>`
- **S2** — ...

## Fuera de alcance

- <lo que no se hace, aunque parezca natural>

## Tareas

- [ ] T1 · S1 · <entregable> · ruta: <agente o inline> · nivel: <rápido|estándar|máximo> · commit: —
- [ ] T2 · S1, S2 · ...

## Registro

- **L1** — <el pedido original, literal, sin resumir>
- L2 — <AAAA-MM-DD> <corrección del developer, hallazgo, decisión o evidencia>
```

Reglas:

- **Las specs citan literal.** Nunca parafrasees el pedido: copiá sus palabras.
- **Un cambio de requisito reescribe solo la spec afectada** y reabre solo sus tareas,
  con el motivo en el Registro. Lo hecho y válido se conserva.
- **Una tarea se tilda con evidencia observada** (salida del `verifica:`) y el commit
  que la contiene. Tildar no es aprobar.
- **Espejo en Engram:** después de cada cambio, guardá el documento completo con el
  topic `feature/<slug>`. Si Engram no está, seguí y reportá que el espejo quedó
  pendiente.
- Alcance nuevo que aparece en el camino **no se agrega solo**: va al developer.

## 5. Delegar por referencia

El prompt de cada agente lleva **la ruta del `feature.md`, el ID de su tarea y sus
`S#`**, nunca un resumen del pedido. El agente lee el documento hasta `## Registro`
antes de editar y reporta qué `S#` cubrió. En la ruta chica, el pedido va literal en el
prompt.

## 6. Tests primero

Si hay un test ejecutable y un resultado esperado claro:

1. **ROJO observado:** un test por regla pedida, que falla antes de implementar. Se
   reporta la salida del fallo.
2. **VERDE:** la implementación mínima que lo hace pasar.
3. **REFACTOR** con los tests en verde.
4. Por cada comando u opción existente que el cambio toca, un test que prueba que su
   comportamiento anterior se mantiene.

Si no hay test posible: decí por qué y corré checks funcionales igual.

## 7. Commits por unidad de trabajo

- Unas **400 líneas** cambiadas por commit como guía, no como tope: no partas
  artificialmente ni minifiques para entrar.
- Tests y docs en el mismo commit que el comportamiento.
- Lo de **alto riesgo** (zona crítica, seguridad, migraciones) va en un commit propio,
  para que la revisión lo tome solo.
- `<type>: <desc>` y, en la ruta grande, el commit se anota en la tarea.

## 8. Cierre

Resultado verificado · checks que fallaron o quedaron pendientes · siguiente paso.
En la ruta grande, `estado: hecha` y `close-story`.
