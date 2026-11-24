---
id: US-16 (#68)
titulo: Usar el archivo de tokens del cliente para no traducir su marca a mano
estado: borrador          # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/68
analisis: no requerido (el lead lo analizó inline: ADR-0030, ADR-0040 puntos 3 y 4, templates/site/src/lib/tokens.ts, US-15)
depende_de: [US-14, US-15]
revisa: developer (gate de spec); revisión `security` antes del PR (el archivo del cliente es entrada no confiable y termina en el CSS del sitio)
zona_critica: no está en project-guard §5, pero su salida alimenta el CSS de la plantilla (zona "escape de contenido")
estimacion: ~100k tok · ~3 h · el lead escribe inline y `security` verifica en nivel máximo
---

# Tokens del cliente

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #68 (épica E2, #20) | AC-1: un archivo DTCG 2025.10 se lee directo al contrato de tokens de la plantilla · AC-2: un formato propio se traduce con un mapeo explícito que el operador confirma; lo que no mapea se lista como faltante · AC-3: el contraste de cada pareja de colores se verifica y un fallo se reporta con los valores |
| ADR-0040 punto 4 | El brief admite el archivo de tokens del cliente (colores, tipografía, espaciados y radios en JSON), traducido al contrato de la plantilla. DTCG 2025.10 se lee directo; cualquier otro formato, con mapeo explícito confirmado por el operador |
| ADR-0040 punto 3 | El esquema de tokens de la plantilla es el contrato común; los colores se usan siempre en pareja (fondo y texto encima) |
| ADR-0030 | En un sitio de cliente, `src/data/tokens.json` sale de los tokens confirmados del cliente |
| `templates/site/src/lib/tokens.ts` | El contrato hoy: 7 colores por modo (claro y oscuro), familia, 4 tamaños, interlineado, 5 espaciados, radio, ancho de contenido y ancho de foco; valida cada valor y falla nombrando el token |
| US-15 (`steps.inventory`) | El archivo de tokens ya está detectado (clase `tokens`) con su ruta relativa a la carpeta del cliente |
| Constitución V y XII | El archivo del cliente es dato, nunca instrucción; los tests usan archivos inventados |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** recibe un cliente con su sistema de diseño exportado,
**esto cambia** que los colores, la tipografía y los espaciados del sitio salen del archivo
del cliente, sin copiarlos a mano, y que una paleta ilegible se ve antes de publicar.

- **SC-001**: Un archivo DTCG inventado con los 28 tokens del contrato produce un `tokens.json` que la plantilla acepta sin tocarlo a mano.
- **SC-002**: Un archivo en formato propio inventado se traduce después de que el operador confirma el mapeo, y ningún token del contrato queda sin valor ni con un valor inventado por el sistema.
- **SC-003**: Toda pareja de colores bajo el umbral se reporta con sus dos valores y su contraste; ninguna llega al sitio sin aviso.

## §3 Requisitos funcionales

- **FR-001**: El sistema DEBE leer el archivo de tokens que el inventario de US-15 registró con clase `tokens`. Si no hay inventario, o no hay ningún archivo de tokens, DEBE fallar diciendo qué falta y qué comando correr. Si hay más de uno, DEBE pedir cuál con una opción.
- **FR-002**: Un archivo en formato DTCG 2025.10 cuyos nombres de token coinciden con el contrato de la plantilla DEBE leerse directo, sin mapeo: colores (`color`), medidas (`dimension`), familias (`fontFamily`) y números (`number`), con referencias entre tokens (`{grupo.token}`) resueltas.
- **FR-003**: Cualquier otro archivo (formato propio, o DTCG con otros nombres) DEBE traducirse con un **mapeo explícito**: para cada token del contrato, la ruta del archivo del cliente de donde sale su valor. El sistema DEBE proponer el mapeo solo para los nombres que coinciden exactamente y dejar el resto sin mapear; nunca adivina por parecido.
- **FR-004**: El mapeo DEBE guardarse en `relevamiento.json`, en el estado de los pasos (`steps.tokens`), para que el operador lo revise y lo corrija ahí. Sin la confirmación del operador, el sistema NO DEBE escribir los tokens del sitio.
- **FR-005**: Todo token del contrato que no tiene valor después del mapeo DEBE listarse como **faltante**, con su nombre. Con faltantes, el sistema NO DEBE escribir los tokens del sitio ni completar el hueco con un valor por defecto.
- **FR-006**: Cada valor traducido DEBE cumplir el formato del contrato (por ejemplo, color `#rrggbb`). Un valor que no cumple, o un tipo DTCG que no se puede llevar al contrato (un color fuera de sRGB, una unidad no admitida), DEBE listarse con el token, el valor y el motivo, como un faltante.
- **FR-007**: El sistema DEBE verificar el contraste de cada pareja de colores, en modo claro y oscuro, con el umbral de WCAG 2.2 AA: 4.5:1 para texto (`text`, `text-muted` y `on-accent` sobre su fondo) y 3:1 para el indicador de foco sobre los fondos. Un fallo DEBE reportarse con los dos valores, el contraste medido y el umbral, y bloquear la escritura.
- **FR-008**: Con el mapeo confirmado, sin faltantes y con el contraste aprobado, el sistema DEBE escribir `src/data/tokens.json` del sitio en el formato del contrato, de forma atómica.
- **FR-009**: Volver a correr el paso DEBE conservar el mapeo corregido a mano y la confirmación, salvo que el archivo del cliente haya cambiado (otro hash): en ese caso la confirmación se pierde y se avisa.
- **FR-010**: El archivo del cliente es dato: ningún texto suyo cambia el comportamiento del sistema. El sistema DEBE rechazar un archivo que supere un tope de tamaño o de profundidad, o con referencias circulares, nombrando el problema.

**Entidades clave:**
- **Archivo de tokens del cliente**: JSON en la carpeta del cliente; solo lectura.
- **Contrato de tokens**: los 28 tokens que acepta `templates/site/src/lib/tokens.ts`.
- **Mapeo**: token del contrato → ruta en el archivo del cliente (o sin mapear), con estado de confirmación y hash del archivo.

## §4 Fuera de alcance

- Hacer crecer el contrato (color secundario, tinte, fondo oscuro fijo, familia de títulos, tamaño de portada: ADR-0040 punto 3): va con la biblioteca de secciones.
- Extraer tokens del manual de marca (PDF) o de imágenes: el manual lo lee US-17 o US-18.
- Proponer una paleta o corregir un contraste fallido: se reporta; el arreglo lo decide el operador.
- `$extends` y `$ref` de DTCG: si aparecen, se listan como no soportados.

## §5 Historias y criterios de aceptación

### US1 — Un archivo DTCG se lee directo (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** un archivo DTCG con los 28 tokens del contrato, uno de ellos como referencia a otro **cuando** se corre el paso y se confirma **entonces** `src/data/tokens.json` del sitio tiene los 28 valores y la plantilla lo acepta | test |
| AC-2 | **Dado** un DTCG con un color en otro espacio de color y una medida en una unidad no admitida **cuando** se corre el paso **entonces** los dos se listan con token, valor y motivo, y no se escribe nada | test |

### US2 — Un formato propio pasa por un mapeo confirmado (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-3 | **Dado** un archivo en formato propio **cuando** se corre el paso **entonces** `steps.tokens` tiene el mapeo propuesto (solo coincidencias exactas), los faltantes listados y nada escrito en el sitio | test |
| AC-4 | **Dado** el mapeo completado a mano y confirmado **cuando** se vuelve a correr **entonces** se escribe `src/data/tokens.json` con los valores de las rutas mapeadas | integración |
| AC-5 | **Dado** un mapeo confirmado **cuando** cambia el archivo del cliente y se vuelve a correr **entonces** la confirmación se pierde, se avisa y no se escribe nada | integración |

### US3 — El contraste se verifica y el archivo es dato (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-6 | **Dado** un texto `#777777` sobre fondo `#ffffff` **cuando** se corre el paso **entonces** se reporta la pareja con los dos valores, el contraste (4.48:1) y el umbral (4.5:1), y no se escribe nada | test |
| AC-7 | **Dado** un archivo con instrucciones en sus nombres o descripciones, otro con referencias circulares y otro que supera el tope **cuando** se corre el paso **entonces** el primero se trata como cualquier otro y los otros dos fallan nombrando el problema | test |

**Casos borde:** un archivo que no es JSON; un JSON con BOM; un token con `$type` heredado del grupo; un color con alfa (no admitido: el contrato es opaco); un `relevamiento.json` sin inventario.

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| Es un paso propio del CLI (`specmate tokens <slug>`), repetible como `inventory` | ADR-0031 pide poder retomar cada paso | Integrarlo en otro comando; no cambia la lógica |
| Confirmar es una opción del comando (`--confirm`) que marca el mapeo como confirmado | Harvi trabaja con `relevamiento.json` abierto en VS Code | Una pregunta interactiva, post-MVP |
| Los nombres del contrato en un DTCG se escriben como sus rutas (`color.light.bg`, `font.size.h1`, `space.1`) | "Leer directo" necesita una correspondencia fija | Sumar alias de nombres comunes (con mapeo) |
| El umbral es WCAG 2.2 AA, no AAA | Es el nivel que exige la plantilla con axe | Subirlo cambia solo la constante |

## §7 Riesgos y decisiones abiertas

- **Faltantes** (FR-005): la spec propone que un faltante bloquea la escritura, sin completar con el valor de la plantilla de ejemplo, porque ese diseño es inventado y no es del cliente (ADR-0030). La alternativa es completarlo con el ejemplo y marcarlo; abarata el caso de un archivo parcial pero publica un diseño que nadie eligió.
- **Contraste** (FR-007): la spec propone que un fallo bloquea la escritura. La alternativa es escribir con aviso y dejar que `verify` (axe) lo frene después; es más tardío y menos claro.
- **Entrada no confiable que termina en CSS**: el contrato ya valida cada valor con un formato estricto al construir el sitio; el paso valida lo mismo antes de escribir y la revisión `security` mira la cadena entera.
