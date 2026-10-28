# ADR-0027 — Flujo proporcional: ODD por defecto, SDD cuando el riesgo lo pide

- **Estado:** Aceptada
- **Fecha:** 2026-10-28
- **Reemplaza:** — (precisa ADR-0016: Spec Kit queda para la ruta SDD)
- **Afecta a:** rol `lead`, skills `tasking` y `feature-doc`, preset `workspace-sdd`, épica E3, constitución (principios IV y X)

## Contexto

El kit encaraba toda historia con SDD (Spec Kit): hasta cinco artefactos por historia
(`analysis`, `spec`, `test-plan`, `plan`, `tasks`) y dos gates antes de escribir código.
Para un cambio entendido y de riesgo acotado, eso es costo sin retorno: tokens de
escritura y de lectura en cada handoff, y un humano aprobando papeles.

Organic Driven Development (ODD), el flujo por defecto de Gentle AI (Gentleman
Programming, MIT) desde su v3.0, propone proporcionalidad: lo chico sin artefactos, lo
grande con un solo documento recuperable, SDD solo como rama explícita. No baja las
barreras: autorización explícita, tests primero con el rojo observado, checks con
evidencia y revisión según el riesgo.

SDD sigue siendo necesario cuando hay que aprobar el *qué* antes del *cómo*: reglas de
negocio nuevas, un cliente que valida, zonas críticas, cambios de arquitectura o varias
historias en paralelo que tienen que declarar qué tocan.

## Decisión

1. Todo pedido pasa primero por **autorizar**: preguntas, análisis y propuestas son de
   solo lectura hasta que el developer pide un cambio.
2. El lead **clasifica** con la *prueba de retomar*: ¿se puede retomar el trabajo solo
   con el pedido y el `git diff`?
   - **Chica** (sí, se entiende y el riesgo está acotado): sin artefactos. Un agente,
     tests primero, gate de diff y PR según el nivel de autonomía.
   - **Grande** (no pasa la prueba de retomar): **un solo documento por feature**
     (`specs/<###>-<slug>/feature.md`, skill `feature-doc`), espejado en Engram, con un
     único gate humano sobre el documento antes de escribir código.
   - **SDD** (Spec Kit completo, preset `workspace-sdd`): solo si hay reglas de negocio
     nuevas, un cliente que aprueba el *qué*, una zona crítica de `project-guard` §5, un
     cambio de arquitectura o historias en paralelo.
   La cantidad de archivos, comandos o tareas nunca decide la clasificación.
3. En las tres rutas:
   - **El pedido original va literal** al documento (o al prompt del agente, en la
     ruta chica). Las specs citan palabras, mensajes y ejemplos exactos del pedido.
   - **Se delega por referencia:** cada agente recibe la ruta del documento, su tarea y
     sus specs, nunca un resumen del pedido.
   - **Tests primero por defecto**, con el rojo observado antes de implementar, cuando
     existe un test ejecutable y un resultado esperado claro. Si no, se explica la
     excepción y se corren checks funcionales.
   - **Commits por unidad de trabajo** de unas 400 líneas como guía (no tope), con tests
     y docs junto al comportamiento; lo de alto riesgo va en un commit propio.
4. La estimación y la reserva de presupuesto se mantienen en las rutas grande y SDD.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con SDD para todo | Costo en tokens y en gates desproporcionado para la mayoría de los pedidos; contradice el principio IX (el costo es un requisito) |
| Reemplazar SDD por ODD del todo | Se pierde la aprobación del *qué* antes del *cómo* donde más importa (clientes, reglas de negocio, zonas críticas) y la declaración de rutas que necesita el paralelismo |
| Adoptar Gentle AI como dependencia | Proyecto muy joven y de cambio rápido (v3 a v4.3 en un mes), una sola persona detrás, y se superpone con nuestro kit y con la capa `.agents/`. Se toman las ideas, no el código |

## Consecuencias

**Positivas:** menos artefactos y menos tokens por historia; un solo documento que
sobrevive a sesiones y compactaciones; menos teléfono descompuesto entre agentes; TDD
como norma verificable.

**Negativas (costo asumido):** la clasificación pasa a ser un juicio del lead y puede
equivocarse hacia lo chico; dos formatos de documento conviven (`feature.md` y el de
Spec Kit); `analyze` y `converge` de Spec Kit no aplican a la ruta grande.

**Cómo se impone:** el lead anuncia la ruta en una línea con su motivo, y el developer
puede pedir otra. Ante la duda entre dos rutas, la más larga. Sin gate automático
todavía: en E3, el daemon registra la ruta elegida y si la historia tuvo que rehacerse,
para medir el error de clasificación.

**Revisar cuando:** las métricas del MVP muestren historias de ruta chica o grande que
hubo que rehacer por un *qué* mal entendido.
