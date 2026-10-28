---
id: <clave del ticket o slug>
titulo: <verbo + objeto, desde el usuario>
estado: borrador          # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: <URL del ticket (GitHub / Jira / Azure DevOps) o "manual">
analisis: <analysis.md | no requerido>
depende_de: [<id>]
revisa: <humano o rol que aprueba>
zona_critica: <no | zona según project-guard §5>
estimacion: <tokens · tiempo · costo si hay nivel asignado>
---

# <título>

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| `ADR-NNNN §n` | <una línea> |
| `<ticket>` | <qué pide, en una línea> |
| `<ruta>/AGENTS.md` | <invariante que aplica> |

## §2 Valor y criterios de éxito

**Para** <persona concreta> **que** <situación real>, **esto cambia** <qué puede hacer o
qué deja de pasar>.

- **SC-001**: <resultado medible, con número>

## §3 Requisitos funcionales

Qué hace el sistema, no cómo (el cómo va en `plan.md`).

- **FR-001**: El sistema DEBE <capacidad verificable>
- **FR-002**: El sistema DEBE <...> [NEEDS CLARIFICATION: <pregunta concreta>]

**Entidades clave** (si hay datos): <entidad>: <qué representa, atributos clave>

## §4 Fuera de alcance

- <qué NO entra, aunque parezca natural>
- <hueco declarado: qué ninguna fuente resuelve y por qué no hace falta acá>

## §5 Historias y criterios de aceptación

### US1 — <título> (Prioridad: P1)

<una oración: quién, qué, para qué>. **Prueba independiente:** <cómo se demuestra sola>.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** <estado> **cuando** <acción> **entonces** <resultado> | unit |
| AC-2 | **Dado** ... | integración |
| AC-3 | **Dado** ... | manual — <qué hay que ver fallar> |

**Casos borde:** <uno por línea, cada uno con su AC si se verifica>

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|

## §7 Riesgos y decisiones abiertas

- <qué falta decidir · quién lo decide · qué bloquea>
- Contradicciones entre fuentes: tabla del `product-owner` (fuente A · fuente B · propuesta · por qué)
