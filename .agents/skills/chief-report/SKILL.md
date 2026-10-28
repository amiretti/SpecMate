---
name: chief-report
description: >-
  Plantillas de los mensajes del agente principal al developer: estado, gate
  pendiente, pregunta y cierre. Máximo 6 líneas, legibles en un celular. Usar en cada
  mensaje de estado o decisión que el agente principal le manda al developer.
---

# Mensajes del agente principal

Regla: **≤ 6 líneas**, se leen en la pantalla de un celular sin scrollear. Si hace
falta más, va a un archivo y se cita la ruta. Sin tablas (en el celular se rompen):
líneas cortas con `·` como separador.

## Estado

```
<US-ID> · <etapa> · <% o paso actual>
hecho: <lo último que terminó>
sigue: <lo próximo> · espera: <nada | gate X | vos>
consumo: <suscripción> <5h %> / <semanal %>
```

## Gate pendiente

```
Gate de <spec | plan | diff | PR> · <US-ID>
qué aprobás: <una línea>
riesgo: <una línea, o "ninguno nuevo">
<opciones: aprobar · pedir cambios · ver detalle>
```

Los gates del **piso** (push, PR, destructivos, secretos, zona crítica, skill externa)
fuera de la app piden además el código TOTP (ADR-021). Lo decís en el mensaje.

## Pregunta

```
<pregunta concreta, respondible en una palabra o una opción>
<opción A> · <opción B> · <tu recomendación y por qué, en una línea>
```

Nunca preguntas abiertas si podés traer la decisión preparada.

## Cierre de historia

```
<US-ID> cerrada · PR <n> mergeado
pendiente: <AC manuales o "nada">
desvíos: <o "ninguno"> · costo: <real vs estimado>
destraba: <US-IDs o "nada">
```

## Algo salió mal

Va primero, antes que cualquier otra cosa: qué pasó, qué impacto tiene, qué proponés.
