---
name: spec
description: >-
  Criterio para escribir, partir o revisar una spec en formato Spec Kit (preset
  workspace-sdd). El procedimiento lo da el comando /speckit-specify; esta skill dice
  qué hace buena a una spec. Usar al convertir un ticket en spec, partir una historia o
  revisar si una spec está lista para el gate.
metadata:
  argument-hint: "[ticket | id de feature]"
---

# Spec: $1

**Formato y procedimiento:** comando `/speckit-specify` del preset `workspace-sdd`
(`.agents/speckit-preset/`). Plantilla: `spec-template`. Esta skill no los repite: dice
qué separa una spec buena de una que genera retrabajo.

## Dónde vive

`specs/<###>-<slug>/`, junto con todo lo de la historia:

| Archivo | Quién | Cuándo |
|---|---|---|
| `analysis.md` | `functional-analyst` | Antes de la spec (se saltea en tickets chicos) |
| `spec.md` | `product-owner` | Gate humano de spec |
| `test-plan.md` | `qa` en modo diseño | Antes del gate de spec, si aplica |
| `plan.md`, `data-model.md`, `contracts/` | `architect` (`/speckit-plan`) | Después de la spec aprobada |
| `tasks.md` | `lead` (`/speckit-tasks`) | Gate humano de plan |

## Las secciones (números fijos, se citan por número)

§1 Fuentes · §2 Valor y criterios de éxito (`SC-###`) · §3 Requisitos funcionales
(`FR-###`) · §4 Fuera de alcance · §5 Historias (`US#`) y criterios de aceptación
(`AC-n`) · §6 Supuestos · §7 Riesgos y decisiones abiertas.

**Spec = qué. Plan = cómo.** Stack, estructura de código y diseño técnico van a
`plan.md`, nunca a la spec.

## Criterios de aceptación

- **Verificable o no es AC.** Cada uno declara su verificación: unit, integración,
  arquitectura, e2e o `manual`.
- **`manual` es caro y honesto:** solo cuando hay que *ver fallar* algo. Queda pendiente
  explícito hasta que alguien pegue la salida.
- **Sin sujeto no sirve.** "Todos los casos pasan" exige "y son al menos N".
- **Números, no adjetivos.** "≤ 300 ms p95", no "rápido". Si el número sale de una ADR,
  citala.

## Cuándo partir una historia

- **Por regla de negocio, no por AC.** Si dos cortes comparten la misma invariante, son
  una sola historia.
- Partí cuando hay dos entregables que se aprueban por separado o los topes no alcanzan.
- Al sacar algo porque "lo hace otra historia", preguntá **quién lo hace cuando todavía
  no existe nada**. Si nadie: hueco en §7, no lo cerrás en otra spec por tu cuenta.

## Supuestos y aclaraciones

- `[NEEDS CLARIFICATION]` para lo que bloquea entender la historia (máx. 3).
- Supuesto en §6 para lo que se puede rehacer barato: **qué se supone · por qué hace
  falta · qué se rehace si es falso**. Sin la tercera parte es una adivinanza.
- **Prohibido suponer** reglas de cálculo, obligaciones legales o reglas de las que
  dependen otras historias: eso es `estado: bloqueada`.

## Estados

`borrador` → (gate humano) → `aprobada` → `en curso` → `hecha`. También `bloqueada` y
`descartada`, siempre con motivo. **Un agente nunca pasa una spec a `aprobada`.**

## Checklist antes del gate

- [ ] Cabecera completa: `origen` apunta al ticket; estimación cargada
- [ ] Cada AC con verificación; ninguno pasa sin sujeto
- [ ] §4 con al menos una exclusión concreta
- [ ] Cero suposiciones sobre cálculo o legales
- [ ] Nada de cómo (stack, código) en la spec
- [ ] Nada contradice una ADR; si algo lo hace, no arbitrás: reportás
