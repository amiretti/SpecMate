---
name: tasking
description: >-
  Tasking out de una historia: verifica la spec, la descompone en tareas de un
  entregable, arma el equipo mínimo de agentes, asigna skills y modelo por tarea,
  coordina y cierra con gate. La usa el lead. Invocar como /tasking <US-ID | ticket>.
metadata:
  argument-hint: "[US-ID | ticket URL]"
  invocation: manual
---

# Tasking out de $1

Sos el **lead**: coordinás, verificás y sintetizás. **No implementás.**

## 0. Precondiciones

- Cargá `project-guard` (repo, rama base, tablero, gates, bloqueos) y `model-routing`.
- Verificá `git rev-parse --is-inside-work-tree`.
- Si $1 toca algo de `project-guard` §7 (bloqueos vigentes): **no se taskea, se reporta.**
- Mirá en `project-guard` §6 qué gates corren en el PR y cuáles después. Si la historia
  toca una zona crítica y sus gates no corren en el PR, corrélos local.
  **Verde del PR ≠ verificado.**

## 1. Spec aprobada, o no hay tasking

| Lo que llega | Qué hacés |
|---|---|
El flujo sigue a Spec Kit (preset `workspace-sdd`, en `.agents/speckit-preset/`). Todo
vive en `specs/<###>-<slug>/`.

| Lo que llega | Qué hacés |
|---|---|
| `spec.md` con `estado: aprobada` y sin `plan.md` | `architect` con `/speckit-plan` → seguís al paso 2 |
| `spec.md` aprobada con `plan.md` | Seguís al paso 2 |
| `spec.md` en `borrador` | Pedís aprobación al humano. No taskeás un borrador |
| Ticket (GitHub, Jira, Azure DevOps) sin spec | `functional-analyst` → `analysis.md` · `product-owner` con `/speckit-specify <ticket>` · `qa` en modo diseño si aplica · **gate humano de spec**. Ticket chico sin reglas nuevas: salteás el análisis |
| Nada escrito | Pedís la fuente. No inventás la historia |

Después:
- Leé las ADR del §1 de la spec. `ADR > spec > criterio del implementador`. Si la spec
  contradice una ADR, parás y reportás; no arbitrás.
- Verificá en disco las rutas que nombra `plan.md`. Filesystem > memoria.
- Verificá que las dependencias de la cabecera estén **cerradas de verdad** (PR
  mergeado, no "alguien dijo").
- `[git]` Rama según la convención de `project-guard` §1, sobre la rama base.

## 2. Descomposición

Corré `/speckit-tasks`: genera `tasks.md` con tareas de **un entregable**, cada una con
`[P]` si es paralelizable, `[US#]`, los **AC de §5 que cierra**, su **nivel de modelo** y
su **estimación**. Revisalo antes de mostrarlo:

- Tarea sin AC = scope creep: sacala o pedí el AC.
- El §4 de la spec es la otra defensa: lo que está ahí no se hace.
- Un `[P]` mal puesto (archivos, contrato o build compartidos) rompe el paralelo: sacalo.
- Corré `analyze` (consistencia spec ↔ plan ↔ tareas) y resolvé lo que no cierre.
- Listá en `plan.md` las **rutas que toca la historia** (carpetas, contratos, archivos de
  build): con eso se detectan choques con otras historias en paralelo (ADR-022).
- Presentá `tasks.md` al humano (**gate de plan**) con la estimación total, antes de
  levantar a nadie. Esa estimación es la **reserva de presupuesto** de la historia: si
  no hay margen en las suscripciones, la historia no arranca y lo decís.

## 3. Equipo: el mínimo

| Agente | Cuándo | Alcance |
|---|---|---|
| `backend` | dominio, casos de uso, endpoints, persistencia, migraciones | implementa |
| `frontend` | componentes, features, tokens, layouts | implementa |
| `qa` | verificación contra AC | solo lectura |
| `security` | auth, autorización, secretos, datos personales, zona crítica | solo lectura, flaguea |
| `architect` | decisión que **ninguna ADR fija**; borde entre módulos; deriva código↔ADR | solo lectura; no edita `docs/adr/` |
| `functional-analyst` | primera etapa: reglas, flujos, casos borde, impacto, riesgos, bloqueos | escribe `specs/<feature>/analysis.md` |
| `product-owner` | análisis + ticket → spec, historia que resulta ser dos, AC no verificable | escribe `specs/<feature>/spec.md` |
| `scrum-master` | cierre de historia o de fase: tablero, épica, issues | edita `docs/` y el tablero; no pushea |

Los tres últimos operan **antes** y **alrededor** del ciclo de código, no dentro. Si te
encontrás arbitrando una regla de negocio → `architect`.

`security` es **bloqueante** (Crítico/Alto frena el cierre) en toda historia que toque
datos personales, autorización o una zona crítica.

**Reglas de armado**
- **Delegá solo trabajo grande e independiente.** Lo que resolvés en un puñado de
  llamadas lo hacés vos.
- Un agente es mejor que tres. **Cadena acoplada → un solo agente** (ej: un tipo de
  dominio + su analizador + sus tests).
- Backend ∥ frontend solo si no comparten contrato. Si lo comparten, congelá el
  contrato del backend primero.
- Nombres **únicos por historia** al spawnear.
- `qa` lo absorbés vos si el diff es chico y la suite está verde. No, si hay AC `manual`
  o el diff toca una zona crítica.
- **Verificador ≠ implementador cuando el entregable son números.** Única excepción
  sana a "mínimo".

## 3.1. Skills por agente

Los agentes ya cargan sus skills base. En el prompt **nombrá solo las que la tarea
aplica**: cada skill extra es contexto pagado en cada turno.

| La tarea toca | Skill |
|---|---|
| Cualquier código del proyecto | `project-guard` |
| Escribir o partir una historia | `spec` |
| Una decisión de arquitectura nueva | `adr` |
| Cerrar historia o fase | `close-story` |
| Stack específico | la que indique la constitución |

## 4. Modelo por spawn

El nivel de cada tarea ya viene en `tasks.md`; lo revisás contra **`model-routing`** y
**pasás el nivel explícito** en cada spawn, sin excepción. Con más de una suscripción
en `.agents/runtimes.json`, también la **suscripción** (`model-routing` §6). Resumen
operativo:

- Default `estándar`. `máximo` solo para lo que esa skill lista (zona crítica, seguridad
  bloqueante, ADR con consecuencias). `rápido` para lo mecánico y verificable.
- Escalá tras dos fallos con evidencia, pasando reporte y diff.
- **Continuar > respawnear.** Ajustes por mensaje al agente vivo.

## 5. Prompt de spawn (ya masticado)

Incluí, **como extracto** (secciones y líneas, no archivos enteros):
- Su tarea de `tasks.md` (entregable, ruta, AC que cierra, nivel) + los `FR` de §3 y
  los `AC` de §5 que toca (= "listo") + el extracto de `plan.md` que la afecta.
- ADR que gobiernan y **qué imponen**, una línea cada una.
- Archivos concretos + ground-truth ya verificado, para que no re-explore.
- `AGENTS.md` del módulo. **Si cambia una invariante, lo actualiza en el mismo trabajo.**
- Skills a aplicar (§3.1) y el **modelo elegido con su motivo**.
- **Conectores:** si la tarea necesita uno que el rol no tiene (ej.: `playwright` para que
  `qa` reproduzca un flujo, `posthog` para validar un AC de comportamiento), concedelo
  antes del spawn con `node tools/mcp.mjs grant` (reglas en el rol `lead`). Pedirlo a
  mitad de tarea obliga a relanzar al agente.
- Barandas: no toca git; nada fuera de su alcance; nunca `docs/adr/`; dependencia nueva
  → licencia verificada antes.
- Qué corre y qué no: los tests de lo que toca, no la suite entera. **Nada en segundo
  plano al terminar el turno.**
- Reporte **≤ 15 líneas, una sola vez**: archivos + 1 línea por cambio + desvíos +
  comandos con conteo y duración. Sin volcar código ni diffs.

Dale la tarea **entera** de entrada: una especificación completa rinde más que cinco
mensajes de ajuste.

## 6. Coordinación

- Ningún agente toca archivos de otro. Contrato compartido → congelá un lado.
- **Reporte ≠ evidencia.** "Tests verdes" vale si trae conteo, omitidos, duración y log
  en disco. Sin eso, o si el agente se cortó, lo corrés vos.
- **Un dueño por fase** para los archivos de build y CI compartidos. Secuenciá antes que
  romper la restauración.
- `idle` ≠ hecho: `git status --porcelain <ruta>`; si no hay nada, pedido concreto.
- Ante mensajes cruzados, mirá disco (`mtime`, conteo de tests) antes de reasignar. No
  hagas rehacer lo que ya está verde.
- Contrastá reporte vs pedido **punto por punto**; lo que no aparece se verifica en disco.

## 6.1. Verificación y vueltas de revisión

- **Cada tarea trae su `verifica:` en `tasks.md`. Cuando el agente reporta que terminó,
  corrés vos ese comando** (en su worktree). Si falla, la tarea queda *necesita
  atención*: le devolvés al agente la salida del comando, no tu interpretación. El
  reporte del agente no cambia eso.
- **Revisión con veredicto.** `qa` y `security` terminan con `Veredicto: aprobado` o
  `Veredicto: cambios-pedidos`. Con cambios pedidos: el implementador arregla (mensaje al
  agente vivo, con los hallazgos) y la siguiente revisión es **de seguimiento** (los
  hallazgos anteriores + regresiones del arreglo), no completa.
- **Tope: 2 vueltas** de revisión por tarea. Si la segunda sigue con cambios pedidos, o
  si una revisión llega sin línea de veredicto, **no hay tercera vuelta**: va al developer
  con los dos reportes. Nunca un ciclo a ciegas.

## 7. Gate y cierre

1. Revisá el diff buscando el punto sutil, no la línea obvia. Si absorbiste a `qa`,
   aplicá vos sus **lentes** (claims-check, borrados, AC sin cubrir, fuera de alcance):
   lo que un agente afirma y no está en el diff es un fallo.
2. **La suite entera corre UNA vez, al final, con un solo dueño** (`qa` o vos). Build y
   arquitectura sobre el árbol final los corrés siempre vos: son segundos.
3. Gates de `project-guard` §6 que la historia toca.
4. AC `manual`: verificados con su salida pegada, o reportados como pendientes. Nunca
   cerrados en silencio.
5. `AGENTS.md` del módulo vs diff: si cambió una invariante y el archivo no, **no está
   cerrado**.
6. `security`: cero Crítico/Alto abiertos.
7. `git status --porcelain` = solo el entregable.
8. `[git]` Commits → push → PR con la convención de cierre. **Frená y pedí luz verde
   antes de push y antes de PR, cada vez.**
9. Cierre de historia: skill `close-story`.

**Cierre al humano:** qué quedó hecho · AC manuales pendientes · desvíos · decisiones
caras de revertir · una línea por spawn con agente, nivel de modelo y si escaló.
