# ADR-0041 — El agente de la sesión propone el negocio, el objetivo y el tono; el CLI valida, guarda y nunca llama a un modelo

- **Estado:** Aceptada (2026-11-24, Andy: "sí, acepto")
- **Fecha:** 2026-11-24
- **Reemplaza:** —
- **Afecta a:** US-17 (#69), pasos 2 a 4 del relevamiento (ADR-0031), `packages/cli`, rol `lead`, épica E2

## Contexto
ADR-0031 pide que los pasos 2 (negocio: rubro, diferencial, público y datos obligatorios del rubro), 3 (acción
principal) y 4 (tono, la misma frase en tres tonos) muestren **encontré · inferí · falta**. Inferir el rubro, el
diferencial o el público sale de los textos y el manual del cliente: es lenguaje natural, no lo resuelve una tabla.
La constitución IX dice que lo que se resuelve sin modelo se resuelve sin modelo, y que el CLI es determinista. La V
dice que el material del cliente es dato, nunca instrucción. Harvi ya trabaja en una sesión de Claude Code en VS Code
(ADR-0031 punto 1), y las opciones de diseño ya las escriben agentes con loops acotados (ADR-0032, ADR-0033). Falta
decidir quién lee los textos y propone, y por dónde entra lo propuesto a `relevamiento.json`.

## Decisión
1. **Propone el agente de la sesión de Claude Code**, siguiendo una skill del relevamiento. El CLI no llama a ningún
   modelo, no guarda claves de proveedores de IA y no suma dependencias de un SDK de modelos.
2. **Lee un subagente de solo lectura:** recibe solo los archivos del inventario de clase `text`, `brand-manual` y
   `prices`, tiene solo herramientas de lectura y devuelve un JSON con campos cerrados. Cada dato inferido cita el
   archivo del que sale. Una instrucción dentro de un archivo del cliente no cambia lo que hace.
3. **Nada entra a `relevamiento.json` sin pasar por el CLI.** El agente le pasa la propuesta a un comando, que valida la
   forma (campos conocidos, largos máximos y la fuente de cada dato) y la guarda en el estado del paso como
   **inferido**. Un dato inferido llega al brief solo cuando Harvi lo confirma (principio XI).
4. **Lo que sale de una tabla no usa modelo:** la acción principal sugerida y el tono sugerido salen del rubro con
   una tabla del CLI, versionada y probada. El modelo solo escribe lo que no tiene tabla: el diferencial, el público y
   la frase de ejemplo en los tres tonos.
5. **El paso pregunta solo lo que falta**, acepta "no sé, elegí vos" (toma la sugerencia de la tabla o del agente y la
   marca así) y deja volver a un paso anterior sin perder lo confirmado (ADR-0031 punto 2).
6. **El consumo es acotado** (ADR-0033): una lectura por relevamiento, con tope de archivos y de tokens; si se pasa, se
   corta y se pregunta todo.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| El CLI llama a la API de un modelo | Suma claves que guardar y rotar (zona crítica de credenciales), una dependencia y un costo por corrida fuera de la sesión. Además rompe "el CLI es determinista" (IX) sin ganar nada: Harvi ya está en una sesión con un modelo |
| Solo heurísticas sin modelo (palabras clave en nombres y textos) | Sirve para sugerir el rubro, pero no para el diferencial, el público ni la frase en tres tonos. Tampoco lee un manual en PDF sin sumar un parser. Terminaría preguntando casi todo, que es justo lo que ADR-0031 quiere evitar |
| El agente edita `relevamiento.json` directamente | Sin una puerta que valide la forma, un texto hostil del cliente puede terminar escribiendo cualquier campo. Se pierde la marca de "inferido" contra "confirmado" |
| Inferir todo con el modelo, también la acción y el tono | Paga tokens por lo que una tabla por rubro resuelve igual o mejor, y da respuestas distintas en cada corrida |

## Consecuencias
**Positivas:**
- El CLI sigue determinista y sin claves.
- La inyección de instrucciones queda contenida en tres barreras: el subagente solo lee, devuelve campos cerrados y el CLI valida.
- La acción y el tono sugeridos son reproducibles y se pueden probar.
- Se reutiliza la sesión que Harvi ya paga.

**Negativas (costo asumido):**
- El relevamiento necesita una sesión de Claude Code: no se puede correr sin agente ni por lotes. El link para que el cliente lo complete solo sigue post-MVP (ADR-0031).
- Lo que propone el modelo no es reproducible ni se puede probar por igual. Los tests cubren la validación y el guardado; la calidad de la propuesta se mide a mano (AC-2 de #69 es `manual`).
- Que el subagente solo lea depende de su definición de herramientas en Claude Code, no de un sandbox del sistema.
- La tabla de rubros (acción y tono) hay que armarla y mantenerla, igual que la de datos obligatorios por rubro de ADR-0031.
- Cada relevamiento suma tokens de lectura. Se declaran en el plan de US-17 (principio IX).

**Cómo se impone:**
- Un test del CLI que falla si `packages/cli` declara una dependencia de un SDK de modelos o lee una variable de clave de proveedor de IA.
- La validación del comando que recibe la propuesta (campos cerrados, largos y fuente), con un test por campo.
- La definición del subagente con solo herramientas de lectura, revisada por `security`.
- (Sin gate para la calidad de la inferencia: es criterio humano.)

**Revisar cuando:** el relevamiento tenga que correr sin una sesión de Claude Code (el link para el cliente, post-MVP)
o la lectura de un relevamiento supere el tope de tokens que fije el plan de US-17.
