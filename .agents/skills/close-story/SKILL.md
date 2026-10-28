---
name: close-story
description: >-
  Cierra una historia o una fase dejando el estado del proyecto verdadero: verifica que
  esté entregada de verdad, actualiza tablero, épica, ticket de origen y spec, y lista
  lo que se destraba y lo que quedó colgando. Invocar como /close-story <US-ID>.
metadata:
  argument-hint: "[US-ID]"
---

# Cierre de $1

El objetivo no es mover tarjetas: es que **todo lo que afirme el proyecto sea cierto**.

## 1. Verificá que esté cerrada de verdad

No alcanza con que alguien lo diga. Las tres cosas, con comando:

- [ ] El PR está **mergeado** (no abierto, no aprobado: mergeado).
- [ ] La rama base contiene el merge.
- [ ] La suite está verde **sobre la rama base**, con conteo y duración.

Si falta una, la historia no está cerrada. Reportalo y pará.

## 2. Actualizá el estado, en este orden

1. **Spec:** `estado: hecha` en la cabecera.
2. **Tablero:** la tarjeta al estado de entregado.
3. **Épica:** tildá la historia en el cuerpo de la épica. Si no se tilda, la fase se ve
   más atrasada de lo que está.
4. **Ticket de origen** (Jira/GitHub): comentario con link al PR y resumen en una línea,
   y transición al estado de entregado.

## 3. Lo que cambia el conteo

- Si el PR cerró **otros issues** además del suyo, verificá que quedaron cerrados y
  **decilo**: cambia lo que falta.
- Un issue cerrado **por fusión o descarte no es una entrega.** Si el tablero lo movió a
  entregado por automatismo, sacalo o usá un estado propio. Al tocar las opciones de un
  campo del tablero, mandá **el conjunto completo**: mandar solo la nueva borra las otras.

## 4. Lo que se destraba

Recorré el grafo de `specs/README.md` y las cabeceras de las specs: listá las
historias que dependían de esta **con su número de issue**, y si ahora están libres.

## 5. Dónde se esconden los pendientes

Revisá antes de cerrar, y registrá lo que encuentres como issue:

- **§7 de la spec** ("Riesgos y decisiones abiertas"): lo que quedó sin issue.
- **Hallazgos Bajos de seguridad** que se rutearon pero no se registraron.
- **Reglas de negocio en comentarios** del código del diff: son pendientes, no notas.
- **Disparadores de revisión sin fecha** en ADR ("revisar cuando..."): si esta historia
  los activó, decilo.
- **AC `manual`** que quedaron pendientes.

## 6. Cierre de fase (si es la última historia)

- Conteos de la fase **con el comando que los produjo** (`project-guard` §8).
- Tablero vs repositorio: cada tarjeta en entregado tiene su PR mergeado.
- Resúmenes mantenidos a mano que se pueden derivar: derivalos o borralos.

## 6.1 Memoria del proyecto

Guardá en la memoria (Engram) **solo lo aprendido que no quedó en un archivo**: una
decisión con su motivo, una trampa del entorno, un patrón que funcionó o falló. Una
entrada por aprendizaje, en modo `terse`, con origen:

```bash
ENGRAM_DATA_DIR="<proyecto>/.workspace/engram" engram save "<título corto>" \
  "<qué · por qué · origen: <feature>, <archivo>>" --type <decision|bugfix|pattern> --topic <tema>
```

Lo que ya está en una spec, una ADR o un `AGENTS.md` **no se guarda**: se cita. La
memoria indexa, no reemplaza.

**Errores de los agentes (pitfalls).** Si en la historia un agente se equivocó de una
forma que puede repetirse (afirmó tests que no corrió, tocó un archivo vedado, usó la
API vieja de algo), guardalo con `--type pitfall`: qué hizo, cómo se detectó, qué
hacer en su lugar. Si el mismo pitfall aparece **dos veces**, proponé llevarlo al
`AGENTS.md` del módulo como regla, con aprobación humana: ahí lo leen todos los agentes
sin tener que buscarlo.

## 6.2 Conectores concedidos

`node tools/mcp.mjs revoke-story <US-ID>`: las concesiones son por historia y no
sobreviven al cierre.

## 6.3 Perfil del developer

Corré la skill `profile`: si en la historia aprendiste algo nuevo de **la persona**
(cómo quiere los reportes, su vocabulario, decisiones que repite), actualizá su perfil.
Lo del proyecto va a Engram (§6.1), no al perfil.

## 7. Reporte

Archivos tocados · conteos con su comando · qué cambió de estado y qué issues cerró ·
qué se destraba, con número · **qué encontraste que no cierra** (va aunque no lo pidan:
es lo más valioso del reporte).
