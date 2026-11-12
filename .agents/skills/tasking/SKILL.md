---
name: tasking
description: >-
  Tasking out de una historia grande o SDD: verifica que el documento esté aprobado,
  completa las tareas, decide qué se hace inline y qué se delega (con motivo), coordina,
  verifica y cierra con gate. La usa el lead. Invocar como /tasking <US-ID | ruta del feature.md>.
metadata:
  argument-hint: "[US-ID | ruta del feature.md]"
  invocation: manual
---

# Tasking out de $1

Sos el **lead**. La ruta chica no pasa por acá: va directo, con el pedido literal.

## 0. Precondiciones

- Cargá `project-guard`. Si $1 toca un bloqueo de §7: **no se taskea, se reporta.**
- Si la historia toca una zona crítica (§5) y sus gates no corren en CI, los corrés
  local. **Verde del CI ≠ verificado.**

## 1. Documento aprobado, o no hay tasking

| Lo que llega | Qué hacés |
|---|---|
| `feature.md` con `estado: aprobada` | Paso 2 con su `## Tareas` |
| `feature.md` en `borrador`, o no existe | Lo escribís o completás con `feature-doc` y pedís el gate |
| Ruta SDD: `spec.md` aprobada sin `plan.md` | `/speckit-plan` → gate de plan → paso 2 |
| Ruta SDD: ticket sin spec | `/speckit-specify` → gate de spec |
| Nada escrito | Pedís la fuente. No inventás la historia |

Después: leé las ADR que gobiernan la historia (`ADR > spec > criterio propio`; si se
contradicen, parás y reportás), verificá en disco las rutas que nombra el documento y
creá la rama según `project-guard` §1.

## 2. Tareas

Cada tarea tiene **un entregable**, los `S#` o AC que cierra, su `verifica:` (comando o
tipo de prueba), su nivel de modelo y su ruta: **inline** o el agente que la hace.

- Tarea sin `S#` ni AC = alcance de más: sacala o pedí el criterio.
- Lo que está en *Fuera de alcance* no se hace.
- En la ruta SDD, `/speckit-tasks` las genera; revisalas con estas mismas reglas.

## 3. Inline o delegado

**Por defecto, inline.** Delegás solo con uno de los motivos del rol `lead`:

| Agente | Cuándo |
|---|---|
| `developer` | Escritor en paralelo en el CLI o las herramientas |
| `frontend` | Escritor en paralelo en la plantilla o la biblioteca de secciones |
| `qa` | Verificador independiente: zona crítica, AC `manual` o diff grande |
| `security` | Zona crítica de `project-guard` §5, claves o código que usa un modelo. **Bloqueante:** un Crítico o Alto frena el cierre |

- Una cadena acoplada (un tipo, su validador y sus tests) va a **un solo** agente.
- Dos escritores en paralelo solo si no comparten archivos. Si comparten un contrato,
  congelás un lado primero.
- El que escribió el cambio nunca lo verifica.

## 4. Prompt de spawn

- **Por referencia:** ruta del documento, ID de la tarea y sus `S#`. Nunca un resumen
  del pedido.
- Las ADR que gobiernan y qué imponen, una línea cada una.
- Archivos concretos y lo que ya verificaste en disco, para que no re-explore.
- Nivel de modelo y su motivo. Skills extra solo si la tarea las aplica.
- Barandas: no toca git; nada fuera de su alcance; nunca `docs/adr/`; dependencia nueva
  con licencia verificada antes.
- Reporte **≤ 15 líneas, una sola vez**, con comandos, conteo y duración.

Dale la tarea **entera** de entrada.

## 5. Verificación y vueltas de revisión

- **Cuando un agente dice que terminó, corrés vos su `verifica:`.** Si falla, le
  devolvés la salida del comando, no tu interpretación.
- **Escalera de fallos (ADR-0033):** 1.º fallo → el mismo agente con la salida tal cual;
  2.º → agente nuevo en `máximo` con reporte y diff; fallo en `máximo` → al developer
  con la evidencia. Si dos fallos seguidos dan la misma salida, o el diff no cambió,
  saltás al escalón siguiente.
- **Tope por tarea:** el doble de su estimación. Una tarea sin estimación no se
  despacha.
- `qa` y `security` terminan con `Veredicto: aprobado` o `Veredicto: cambios-pedidos`.
  Con cambios pedidos: el implementador arregla y la siguiente revisión es **de
  seguimiento** (hallazgos anteriores más regresiones del arreglo).
- **Tope: 2 vueltas.** Si la segunda sigue con cambios pedidos, o una revisión llega sin
  veredicto, va al developer con los dos reportes.

## 6. Gate y cierre

1. Revisá el diff buscando el punto sutil. Lo que un agente afirma y no está en el diff
   es un fallo.
2. **La suite entera corre una vez, al final, con un dueño.**
3. Los gates de `project-guard` §6 que la historia toca.
4. AC `manual`: con su salida pegada, o reportados como pendientes. Nunca cerrados en
   silencio.
5. `AGENTS.md` del paquete al día si cambió una invariante.
6. `git status --porcelain` = solo el entregable.
7. Commits por unidad de trabajo (`feature-doc` §7). **Frená y pedí luz verde antes de
   push y antes de PR, cada vez.**
8. `/close-story`.

**Cierre al developer:** hecho · AC manuales pendientes · desvíos · decisiones caras de
revertir · una línea por spawn con agente y nivel.
