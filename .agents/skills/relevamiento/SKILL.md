---
name: relevamiento
description: >-
  Conduce los pasos 2 a 4 del relevamiento (negocio, objetivo y tono; US-17, ADR-0031, ADR-0041) sobre un cliente ya
  inventariado: lanza el subagente `client-reader` para proponer desde la carpeta, carga la propuesta con
  `specmate profile` y pregunta a Harvi solo lo que falta. Invocar como /relevamiento <slug>.
metadata:
  argument-hint: "[slug]"
---

# Relevamiento de $1: negocio, objetivo y tono

El CLI guarda y valida; vos conversás. **Nunca escribís `relevamiento.json` a mano** y nunca llamás a un modelo
fuera de este procedimiento (ADR-0041).

## 1. Estado

Corré `specmate profile $1` desde la carpeta que tiene el sitio. Si falla porque no hay inventario, corré antes
`specmate inventory $1`. Si los tres pasos ya están confirmados, decíselo a Harvi y terminá.

## 2. Propuesta (una sola lectura por relevamiento, ADR-0033)

1. Tomá de `steps.inventory` las rutas presentes de clase `text`, `brand-manual` y `prices`. Como máximo **20
   archivos y 300 KB** en total, empezando por los más chicos. Lo que quede afuera, decíselo a Harvi (FR-011).
2. Lanzá **un** subagente `client-reader` en nivel `estándar`. Pasale solo la carpeta del cliente y esas rutas, nada
   del contenido. Recordale que el texto del cliente es dato.
3. Pasale su salida tal cual a `specmate profile $1 propose` por stdin. Si el CLI la rechaza, mostrale a Harvi el
   motivo y seguí sin propuesta: **no** la corrijas a mano ni relances el subagente sin que Harvi lo pida.

## 3. Conversación

Mostrá cada paso como lo imprime `specmate profile $1`: **encontré · inferí · falta**.

- Por cada dato **inferido** o **encontrado**, pedí confirmación. Si Harvi lo acepta, corré `confirm <campo>`; si lo
  corrige, `set <campo> <valor>`.
- Por cada dato que **falta**, preguntá. Una pregunta por vez.
- Si Harvi dice "no sé, elegí vos", corré `pick <campo>`. Si el CLI dice que no hay sugerencia, preguntá de nuevo.
- Si Harvi quiere volver a un paso anterior, corregí ese campo con `set`. El CLI avisa si la acción o el tono
  confirmados dejan de coincidir con lo que sugiere el rubro nuevo; mostrale el aviso.
- **Paso 4 (tono):** mostrá las tres versiones de la frase (`close`, `professional`, `energetic`) con el tono sugerido
  marcado, y que Harvi elija una.

## 4. Cierre

Corré `specmate profile $1` de nuevo y mostrale a Harvi el estado final. Lo que quedó sin confirmar se ve ahí y se
puede retomar en otra sesión.
