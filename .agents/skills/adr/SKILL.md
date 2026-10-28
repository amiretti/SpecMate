---
name: adr
description: >-
  Redacta una ADR en formato Nygard, o detecta deriva entre el código y las ADR
  vigentes. Usar cuando una decisión no la fija ninguna ADR y el código está por
  inventarla, cuando una regla de negocio solo vive en un comentario, o cuando hay que
  reemplazar una decisión. Invocar como /adr <tema>.
metadata:
  argument-hint: "[tema]"
---

# ADR: $1

Una ADR registra **qué se decide, qué se descarta y qué cuesta**. No es documentación:
es la razón por la que alguien, dentro de un año, no deshace la decisión sin saberlo.

## 0. Antes de redactar

1. **Ubicá la pregunta real.** Muchas llegan mal planteadas. Antes de elegir entre
   opciones, preguntate si alguna las vuelve innecesarias: la mejor decisión a veces
   disuelve el problema.
2. **Verificá contra el código, no contra la ADR.** Las ADR se escriben y el código se
   va. Abrí los archivos y mirá las líneas.
3. Contá las ADR existentes y sus estados **con un comando**, nunca de memoria
   (ver `project-guard` §8). Ojo con los patrones que devuelven vacío en verde.

## 1. Formato

Archivo: `docs/adr/ADR-NNNN-<slug>.md`, número siguiente al último existente.

```markdown
# ADR-NNNN — <decisión en una oración>

- **Estado:** Propuesta        <!-- Propuesta | Aceptada | Reemplazada por ADR-MMMM | Descartada -->
- **Fecha:** <AAAA-MM-DD>
- **Reemplaza:** <ADR-MMMM o "—">
- **Afecta a:** <módulos, US, zonas críticas>

## Contexto
<qué fuerza la decisión, en ≤ 8 líneas. Cita otras ADR en vez de repetirlas>

## Decisión
<qué se hace, en imperativo. Una regla por línea>

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|

## Consecuencias
**Positivas:** <...>
**Negativas (costo asumido):** <...>
**Cómo se impone:** <test, analizador o gate. Si no hay ninguno: "(sin gate)" y por qué>
**Revisar cuando:** <disparador concreto, o "—">
```

## 2. Criterios

- **Al menos dos alternativas**, cada una con su por qué no.
- **Una ADR sin consecuencias negativas es propaganda.** Declarás el costo asumido.
- **Preferí lo que falla ruidosamente.** Un fallo en compilación es mejor que uno en
  ejecución, y uno en ejecución es mejor que uno silencioso.
- **Un gate que puede pasar en verde midiendo nada no es un gate.** Preguntate cómo se
  ve cuando no verifica.
- **Un catálogo cerrado se defiende con un test tabular**, mejor por reflexión: sumar el
  valor N+1 tiene que ser un cambio visible en el diff.
- **Lo derivado envejece mal.** Si proponés un artefacto que resume otro, decí quién lo
  regenera.
- **El costo lo paga quien consume la decisión.** Contá cuántos consumidores tiene hoy
  y cuántos tendrá cuando alguien quiera revertirla.
- **Una regla que solo vive en un comentario dura tres sprints.** Si es de negocio o de
  cálculo, va a una ADR.
- Un **disparador de revisión sin fecha** ("al crear la primera saga") se escribe en
  `Revisar cuando`: si no, se olvida.
- Si la decisión depende de una obligación **legal o contable**, no la tomás: lo decís y
  queda abierta.

## 3. Reglas de proceso

- **Una ADR aceptada no se edita.** Se cambia escribiendo otra que la reemplaza, y la
  vieja pasa a `Reemplazada por ADR-MMMM`.
- **Un agente nunca pasa una ADR a `Aceptada`.** Eso lo hace el humano.
- Quién escribe el archivo en `docs/adr/` lo decide el lead. El `architect` redacta el
  contenido en su reporte.

## 3.1 RFC con varias perspectivas (solo decisiones caras)

Cuando el plan marca **RFC requerido** y la decisión es cara de revertir, antes de la
ADR podés pedir una ronda de discusión: 2 o 3 roles (ej: `architect`, `security`,
`backend`) como subagentes independientes de nivel `rápido` o `estándar`, cada uno con
la propuesta y la pregunta *"¿qué se rompe con esto y qué harías distinto?"*. Una ronda,
no un debate: vos sintetizás las objeciones en *Alternativas descartadas* y
*Consecuencias*. Para cualquier otra decisión es gasto: no la uses.

## 4. Detectar deriva

Cuando la tarea es auditar, por cada ADR aceptada del área:
1. ¿Hay un test, analizador o gate que la imponga? Si no, es deriva latente.
2. ¿El código cumple? Buscalo con `grep`, no lo supongas.
3. ¿Algún `AGENTS.md`, comentario o spec afirma algo distinto? Reportá **las dos
   fuentes con `archivo:línea`** sin elegir cuál tiene razón.

## 5. Reporte

Recomendación en una línea · problema real si difiere del planteado · alternativas con
su por qué no · costo asumido · ADR propuesta completa · qué historias se destraban ·
qué se rompe si la respuesta fuera la contraria.
