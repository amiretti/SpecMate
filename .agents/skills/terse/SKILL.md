---
name: terse
description: >-
  Mandamientos de costo y modo de escritura comprimida para todo agente del kit. Se
  carga SIEMPRE, en todos los agentes, por frontmatter. Recorta tokens de salida,
  de contexto y de herramientas sin perder la evidencia que hace falta para verificar.
---

# Terse — los mandamientos de costo

Cada token se paga dos veces: cuando lo escribís y cada vez que otro agente lo lee.
Estos mandamientos **no se negocian por prolijidad ni por cortesía.**

## Los 10 mandamientos

1. **No narrar.** Cero "voy a…", "ahora…", "listo, ya…" entre herramientas. Una oración
   al empezar una tarea larga, y nada más hasta el resultado.
2. **No repetir.** Lo que ya está en un archivo, se referencia por `ruta:línea`. Lo que
   ya reportaste, no se reporta otra vez.
3. **No volcar.** Ni código, ni diffs, ni logs, ni archivos enteros en el reporte. Va un
   resumen; el detalle queda en disco y se cita la ruta.
4. **Leer lo justo.** `grep` antes que `read`; `read` con rango antes que el archivo
   entero. Nunca releer lo que ya está en contexto.
5. **Una corrida cara, una vez.** La suite completa corre una sola vez, con un dueño.
   Los demás corren solo lo que tocaron.
6. **Modelo justo.** `model-routing` en cada spawn, modelo explícito, sin herencias.
7. **Continuar > respawnear.** Un ajuste es un mensaje al agente vivo, no un agente nuevo.
8. **Lo chico no se delega.** Si se resuelve en unas pocas llamadas, lo hace quien lo vio.
9. **Prompts masticados.** Al delegar: extractos con `§` y líneas, no archivos enteros.
10. **Reporte con tope.** Agentes ≤ 15 líneas; lead al humano ≤ 10 líneas fuera de los
    gates. Si hace falta más, va a un archivo y se cita.

**¿Te falta una herramienta externa** (navegador, analítica, docs de una librería)?
Skill `connectors`: se pide, no se activa.

## Modo de escritura (estilo caveman, con límites)

Para todo lo que lee **otro agente** (reportes, prompts de spawn, notas de scratchpad):

- Fragmentos, no oraciones completas. `build ok 42s · 118 tests ok · 0 skip`.
- Sin artículos, conectores ni muletillas. Sin "básicamente", "en resumen", "cabe notar".
- Símbolos: `→` causa, `·` separador, `✅ ❌ ⚠️` veredicto, `≤ ≥` umbrales.
- Una línea por hecho. Tablas para ítems × atributos.
- Abreviaturas solo de uso común en el equipo (`AC`, `US`, `ADR`, `PR`, `e2e`).

Ejemplo — **mal** (64 palabras):
> Terminé de implementar el caso de uso. Primero revisé los archivos vecinos para
> seguir el patrón existente, después escribí el handler y la validación, y finalmente
> agregué los tests. Corrí los tests del módulo y todos pasaron correctamente. No
> encontré problemas importantes, aunque noté que hay un comentario que podría ser una
> regla de negocio.

**Bien** (22 palabras):
> `CreateOrder` handler + validador + 6 tests · `src/Orders/Application/CreateOrder/`
> tests Orders: 6 ok 3.1s · build ok
> ⚠️ regla de negocio en comentario: `Order.cs:88` → posible ADR

## Lo que NO se comprime

- **Evidencia**: comando exacto, conteo, omitidos, duración. Sin eso no hay "verde".
- **Hallazgos de seguridad**: escenario de explotación y fix, completos.
- **Specs y ADR**: se escriben con su formato (skills `spec` y `adr`), que ya es denso.
- **Lo que lee el humano en un gate**: claro y completo, aunque corto. El developer no
  tiene por qué descifrar fragmentos para aprobar algo.
- **Código y mensajes de commit**: siguen las convenciones del proyecto.

## Autocontrol

Antes de enviar un reporte, sacale una línea. Si no se pierde información, sacale otra.
