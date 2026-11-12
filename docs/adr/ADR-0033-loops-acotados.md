# ADR-0033 — Todo loop es acotado: meta verificable, tope, detección de estancamiento y salida al humano

- **Estado:** Aceptada (2026-11-12, Andy: "si crees que necesitas alguno, llevalo a main directamente")
- **Fecha:** 2026-11-12 (rescata la propuesta local del 2026-11-02, adaptada al producto de ADR-0029)
- **Reemplaza:** —
- **Afecta a:** rol `lead`, skill `tasking`, `specmate verify` y la generación de opciones (ADR-0032), épicas E3 y E5

## Contexto

Hay loops en dos lugares:

- **Construyendo SpecMate:** una tarea contra su `verifica:` y la revisión de `qa` y
  `security`. Solo la revisión tiene tope (dos vueltas).
- **En el producto:** cada opción se genera, se verifica y, si un control da rojo, se
  corrige y se vuelve a verificar (ADR-0032). Además, el cliente puede pedir mix,
  ajustes y opciones nuevas.

Un loop sin tope contradice el principio IX (el costo es un requisito) y `security` lo
marca como hallazgo (LLM10). Un loop que no avanza (el mismo control falla igual una y
otra vez) quema tokens y tiempo sin que nadie se entere.

## Decisión

1. **Todo loop declara cuatro cosas:** una **meta verificable** (un comando o un
   control, nunca la opinión del agente), **qué observa**, un **tope** y **a dónde
   sale** cuando llega al tope. Un loop sin las cuatro no se implementa.
2. **Escalera de fallos** (de una tarea o de una opción que no pasa `verify`):
   1. Primer fallo: el mismo agente, con la salida del comando tal cual.
   2. Segundo fallo: un agente nuevo en nivel `máximo`, con el reporte y el diff.
   3. Fallo en `máximo`: sale al humano, con la evidencia.

   Como mucho, tres intentos. Lo que ya arrancó en `máximo` sale al humano en su segundo
   fallo.
3. **Estancamiento.** Cada fallo deja una huella: el hash de la salida del control,
   normalizada (sin tiempos, duraciones ni rutas temporales), y el hash del diff. Si dos
   intentos seguidos dan la misma huella, o el diff no cambió, el loop no avanza: se pasa
   al escalón siguiente sin gastar otro intento en el mismo nivel.
4. **Topes de consumo.**
   - Una tarea: el doble de su estimación (`est:` en el `feature.md` o en `tasks.md`).
     **Una tarea sin estimación no se despacha.**
   - Un sitio en el producto: un tope en tokens hasta las tres opciones verificadas,
     fijado con lo que mida el spike (US-08), y otro por cada pedido del cliente (mix,
     ajuste u opción nueva). Al cruzarlo, se corta y se avisa a Harvi con lo que hay.
5. **Lo mecánico es código** (principio IX): contar intentos, calcular huellas y cortar
   por tope lo hace el CLI en el producto. Construyendo SpecMate, hasta que haya
   herramienta, lo aplica el lead a mano.
6. Siguen igual el tope de dos vueltas de revisión y el piso, y se suman a estos.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Repetir hasta alcanzar la meta, sin tope | El costo crece sin límite; un loop que no converge se come la cuota de la semana |
| Tope solo por cantidad de intentos | No frena un único intento que gira 200 turnos |
| Que un modelo juzgue si hubo progreso | Paga tokens por una comparación que resuelve un hash, y el modelo que está en el loop es el peor juez de su propio progreso |
| Que el mismo modelo revise su salida antes de reportar | Paga dos veces el mismo contexto y comparte el sesgo; la corrección viene de un control determinista o de otro revisor |

## Consecuencias

**Positivas:** ningún loop gasta sin límite; Harvi recibe el problema con evidencia
(tres intentos o una huella repetida) en vez de un "no pude"; las métricas de
escalado, estancamiento y corte calibran las estimaciones.

**Negativas (costo asumido):**
- Algunas tareas que habrían salido en un cuarto intento llegan al humano.
- Una estimación mala corta antes de tiempo: estimar bien pasa a ser un requisito.
- La normalización de la salida puede dar falsos positivos (dos errores distintos con la
  misma huella) o falsos negativos (ruido que cambia en cada corrida).

**Cómo se impone:** en el CLI, con tests de la escalera, de la huella normalizada y del
corte por tope (E3 y E5). Hasta entonces, `(sin gate)`: regla de proceso en `tasking`
§5 y en el rol `lead`.

**Revisar cuando:** las primeras historias y sitios muestren que más de la mitad de lo
cortado por tope habría terminado en verde con más presupuesto (el factor 2 es bajo), o
que la huella repetida casi nunca aparece (no aporta).
