---
name: model-routing
description: >-
  Política para elegir el modelo de cada agente que el lead levanta, balanceando
  consumo de tokens y calidad. El lead la aplica en CADA spawn, dentro o fuera del
  tasking. Define tres niveles (rápido, estándar, máximo), qué tareas van a cada uno,
  cuándo escalar y cómo evitar el costo oculto del arranque en frío.
---

# Model routing

**Regla madre: el modelo más barato que alcanza para que el resultado no haya que
rehacerlo.** Un spawn barato que falla dos veces cuesta más que uno caro que acierta;
uno caro haciendo trabajo mecánico es tirar tokens.

## 1. Niveles

La política se escribe en niveles, nunca en nombres de modelo: el runtime puede ser
cualquier proveedor. El mapeo nivel → modelo vive en `.agents/runtimes.json` y se
completa por instalación.

| Nivel | Perfil |
|---|---|
| **rápido** | Mecánico, verificable, sin decisión |
| **estándar** | Implementación y revisión normales. **Default** |
| **máximo** | Razonamiento caro de revertir |

**Siempre pasá el nivel explícito en cada spawn.** Un agente sin modelo puede heredar
el del lead, que suele ser `máximo`: es el error de costo más común y no se ve.

## 2. Qué va a cada nivel

| rápido | estándar (default) | máximo (solo esto) |
|---|---|---|
| Correr suites y resumir el resultado | Implementar backend o frontend fuera de zona crítica | Implementar en una **zona crítica** de `project-guard` §5 |
| Explorar el repo y ubicar archivos | QA de una historia normal | Seguridad **bloqueante** (auth, datos personales, secretos, zona crítica) |
| Verificar la licencia de una dependencia | Seguridad no bloqueante | Derivar a mano los valores de referencia que verifican una zona crítica |
| Mover tarjetas, tildar épicas, sincronizar un ticket | Escribir specs (product owner) | Redactar una ADR o resolver un borde entre módulos con consecuencias |
| Sincronizar docs o `AGENTS.md` sin decisión | Arquitecto con pregunta acotada | Lead: orquestar, verificar y cerrar |
| Limpiar artefactos | Scrum master planificando una fase | Reintento tras dos fallos en `estándar` (ver §3) |

Ante la duda entre dos niveles: **estándar**. Subir requiere que la tarea esté en la
columna `máximo`; bajar requiere que sea mecánica **y** verificable por un comando.

## 3. Escalar, no arrancar arriba

- Si un agente `estándar` falla **dos veces la misma tarea con evidencia concreta**,
  respawneá en `máximo` pasándole **su reporte y el diff**, no el contexto desde cero.
- Si un agente `rápido` devuelve algo que exige juicio (no solo un resultado), no le
  pidas que decida: escalá esa parte.
- Nunca bajes de nivel a mitad de una zona crítica para ahorrar.

## 4. El costo oculto es el arranque en frío

Un agente que relee spec + 3 ADR + 6 archivos gasta más que la diferencia entre niveles.
Por eso:

- **Continuar > respawnear.** Los ajustes van por mensaje al agente vivo, que conserva
  su contexto.
- **Prompt masticado.** Pasale extractos (secciones y líneas), no archivos enteros, y el
  ground-truth ya verificado para que no re-explore.
- **Lo chico lo hace el lead.** Mover una tarjeta, un `grep` cuyo destino ya conocés o
  crear un issue no justifica un spawn.
- **No uses un agente para re-chequear tu propio trabajo**: es pagar dos veces el mismo
  contexto.

## 5. Paralelismo

- Paralelo solo si las tareas **no comparten contrato, archivos ni build**. Dos agentes
  compilando o corriendo suites en el mismo árbol se pisan.
- Agentes de solo lectura sí pueden correr al lado de uno que escribe.
- Cada agente que escribe en paralelo va en su propio worktree.

## 6. Suscripción (si hay más de una)

`.agents/runtimes.json` puede tener varias suscripciones (ADR-020). Por cada spawn,
además del nivel, elegís dónde corre, con estas reglas en orden:

1. **Afinidad:** si el rol fija un `runtime`, va ahí.
2. **Presupuesto:** la suscripción con más margen en su ventana de 5 h y semanal. Por
   encima de `routing.stopAt` (default 85 %), una suscripción no recibe tareas nuevas
   de nivel `estándar` o `máximo`.
3. **Revisión cruzada:** con `routing.review: other`, `qa` y `security` corren en una
   suscripción de **otro proveedor** que el que implementó.

Si ninguna tiene margen: skill `checkpoint` y aviso al developer.

## 7. Lo que el lead reporta

Al cerrar una historia, una línea por spawn: **agente · nivel · suscripción · por qué
ese nivel · si escaló**. Es lo que permite calibrar esta tabla con datos del proyecto en vez de
intuición.
