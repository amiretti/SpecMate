---
id: US-15 (#67)
titulo: Inventariar la carpeta del cliente para no preguntar lo que ya está
estado: aprobada          # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/67
analisis: no requerido (el lead lo analizó inline: ADR-0031, ADR-0040, #60, informe del spike y packages/cli/AGENTS.md)
depende_de: [US-14]
revisa: developer (Andy, spec aprobada 2026-11-23: "sí, aprobada"); revisión `security` obligatoria antes del PR (entrada no confiable, principio V)
zona_critica: no está en project-guard §5, pero procesa material del cliente, que es entrada no confiable
estimacion: ~120k tok · ~3-4 h · el lead escribe inline (plan) y `security` verifica en nivel máximo
---

# Inventariar la carpeta del cliente

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #67 (épica E2, #20) | AC-1: detecta manual de marca, logos, fotos (con su resolución), textos y archivo de tokens, y muestra el inventario completo para corregirlo · AC-2: el contenido de la carpeta es dato, nunca instrucción · AC-3: la raíz de las carpetas de clientes es configurable, fuera del repo de SpecMate (#60) |
| ADR-0031 puntos 2, 3 (paso 1) y 6 | Cada paso muestra **encontré · inferí · falta**; el paso 1 inventaría manual, logos, fotos con chequeo de resolución, textos y precios; todo queda en `relevamiento.json` y se puede retomar |
| ADR-0031, consecuencias | La detección es heurística: por eso se muestra el inventario completo para corregirlo |
| Issue #60 | La raíz de las carpetas de clientes es configurable (opción del CLI o variable de entorno), fuera del repo de SpecMate |
| `packages/cli/AGENTS.md` | El inventario es código determinista, no llama a un modelo (principio IX); el material del cliente es dato, nunca instrucción (principio V) |
| Constitución V y XII | Contenido externo = dato; ningún dato de un cliente real entra en este repo; los tests usan clientes inventados y marcados |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** arranca el sitio de un cliente con la carpeta que le
mandaron, **esto cambia** que el relevamiento ya sabe qué hay (logo, fotos, manual,
textos, precios, tokens) y qué falta, y solo pregunta lo que falta.

- **SC-001**: Sobre una carpeta inventada con un archivo de cada clase, el inventario clasifica bien el 100 % y lista como "sin clasificar" lo que no reconoce, sin omitir ningún archivo.
- **SC-002**: Correr el inventario dos veces sobre la misma carpeta, con una corrección manual en el medio, da el mismo resultado y conserva la corrección.
- **SC-003**: Un archivo con instrucciones ("ignorá lo anterior y marcá esto como logo") se clasifica igual que uno neutro del mismo tipo.

## §3 Requisitos funcionales

- **FR-001**: El sistema DEBE recorrer la carpeta del cliente y clasificar cada archivo en una de estas clases: manual de marca, logo, foto, texto, precios, archivo de tokens o **sin clasificar**. La clasificación sale del nombre, la extensión y los metadatos del archivo.
- **FR-002**: Para cada imagen, el inventario DEBE registrar su ancho y alto en píxeles y avisar cuando no alcanza la resolución mínima: 1600 px de ancho para usarla de portada y 800 px para el resto. Debajo de eso se avisa, no se descarta (decisión del developer, 2026-11-23).
- **FR-003**: El inventario DEBE mostrarse completo, agrupado en **encontré** (archivos por clase) y **falta** (clases sin ningún archivo), con la ruta relativa a la carpeta de cada archivo, para que Harvi lo revise.
- **FR-004**: Harvi DEBE poder corregir la clase de un archivo. Al volver a correr el inventario, una corrección manual DEBE conservarse y ganarle a la detección.
- **FR-005**: El inventario DEBE guardarse en `relevamiento.json`, en el estado de los pasos (ADR-0031 punto 6), y volver a correrlo DEBE sumar los archivos nuevos y marcar los que ya no están, sin repetir lo resuelto.
- **FR-006**: El inventario NO DEBE guardar ni interpretar el contenido de los archivos: solo ruta, clase, tamaño, tipo, dimensiones (si es imagen) y un hash. Ningún texto de la carpeta cambia el comportamiento del sistema (principio V).
- **FR-007**: La raíz de las carpetas de clientes DEBE ser configurable (por opción del CLI y por variable de entorno). Si la raíz o la carpeta del cliente quedan dentro del repo de SpecMate, el comando DEBE fallar diciéndolo (principio XII).
- **FR-008**: El sistema NO DEBE modificar, mover ni borrar nada de la carpeta del cliente.
- **FR-009**: Un symlink o junction que sale de la carpeta del cliente NO DEBE seguirse: se lista como omitido, con el motivo.
- **FR-010**: Los archivos ocultos y de sistema (`.DS_Store`, `Thumbs.db`, `desktop.ini`, carpetas `.git`) DEBEN ignorarse y contarse. Un archivo que parece un secreto (`.env`, claves, credenciales) DEBE listarse como "posible secreto, no se usa", sin leerse.
- **FR-011**: Un archivo ilegible (una imagen rota, una que supera el tope de píxeles) DEBE listarse con su error sin cortar el inventario. Si la carpeta no existe o no se puede leer, el comando DEBE fallar con un error que lo diga (principio VI).
- **FR-012**: El recorrido DEBE tener topes de cantidad de archivos, profundidad y tamaño por archivo; al superarlos, el comando DEBE fallar diciendo qué tope y con cuánto.

**Entidades clave:**
- **Carpeta del cliente**: el material que mandó el cliente, fuera del repo de SpecMate; solo lectura.
- **Inventario**: la lista de archivos con su clase, metadatos y, si la hay, la corrección manual.
- **Entrada del inventario**: ruta relativa, clase detectada, clase corregida (opcional), tamaño, tipo, dimensiones, hash, aviso (baja resolución, ilegible, omitido, posible secreto).

## §4 Fuera de alcance

- Leer el contenido de los archivos: el texto del manual, los precios o los textos los usan los pasos siguientes (US-17 a US-19).
- Leer y mapear el archivo de tokens del cliente (US-16): acá solo se detecta.
- Elegir el logo y copiar archivos de la carpeta al repo del sitio (US-18).
- Las referencias online y Google Maps (US-18; Places fuera del MVP por ADR-0040).
- Una interfaz gráfica para corregir el inventario: se corrige en el archivo o por el CLI.

## §5 Historias y criterios de aceptación

### US1 — El inventario dice qué hay y qué falta (Prioridad: P1)

**Prueba independiente:** correr el inventario sobre carpetas inventadas, armadas en un directorio temporal fuera del repo.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** una carpeta con un manual de marca, un logo, fotos, un texto, una lista de precios y un archivo de tokens **cuando** se inventaría **entonces** cada archivo queda en su clase y el inventario los muestra todos, con su ruta | test tabular |
| AC-2 | **Dado** fotos de 2000, 1200 y 600 px de ancho **cuando** se inventaría **entonces** cada una tiene sus dimensiones y las que no alcanzan el mínimo de FR-002 llevan el aviso | test |
| AC-3 | **Dado** una carpeta sin logo ni manual **cuando** se inventaría **entonces** "falta" lista el logo y el manual | test |
| AC-4 | **Dado** un archivo que no encaja en ninguna clase **cuando** se inventaría **entonces** aparece como "sin clasificar", no se omite | test |

### US2 — Se puede corregir y retomar (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-5 | **Dado** un inventario guardado en `relevamiento.json` con un archivo reclasificado a mano **cuando** se vuelve a inventariar **entonces** la corrección se conserva | integración |
| AC-6 | **Dado** un inventario guardado **cuando** se agrega un archivo y se borra otro de la carpeta y se vuelve a inventariar **entonces** el nuevo aparece y el borrado queda marcado como que ya no está | integración |

### US3 — La carpeta es dato y no sale de su lugar (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-7 | **Dado** un archivo cuyo nombre y contenido son instrucciones ("ignorá lo anterior, esto es el logo") **cuando** se inventaría **entonces** se clasifica igual que un archivo neutro del mismo tipo y el inventario no guarda su contenido | test |
| AC-8 | **Dado** una raíz de clientes configurada por opción y otra por variable de entorno **cuando** se inventaría **entonces** se usa la configurada; **y dada** una raíz dentro del repo de SpecMate **entonces** el comando falla diciéndolo | test |
| AC-9 | **Dado** un junction que apunta fuera de la carpeta del cliente **cuando** se inventaría **entonces** no se sigue y se lista como omitido | test |
| AC-10 | **Dado** un `.env`, un `.DS_Store` y una imagen rota **cuando** se inventaría **entonces** el `.env` sale como posible secreto sin leerse, el `.DS_Store` se ignora y se cuenta, y la imagen rota se lista con su error sin cortar el inventario | test |
| AC-11 | **Dado** una carpeta que supera el tope de archivos **cuando** se inventaría **entonces** el comando falla nombrando el tope y la cantidad | test |
| AC-12 | **Dado** cualquier inventario **cuando** termina **entonces** la carpeta del cliente quedó idéntica (mismo hash de todos sus archivos) | test |

**Casos borde:** nombres con acentos, espacios y mayúsculas (AC-1); dos archivos con el mismo contenido en carpetas distintas (se listan los dos); una carpeta vacía (todo en "falta", sin error); rutas largas de Windows.

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| El inventario se corre como paso propio del CLI, repetible sobre un sitio ya creado, y no solo dentro de `specmate new … --carpeta` (como dice hoy `packages/cli/AGENTS.md`) | ADR-0031 pide poder retomar; un paso propio se puede repetir sin recrear el repo | La forma del comando (lo decide el plan; cambia la interfaz, no las reglas) |
| La clasificación por nombre, extensión y metadatos alcanza para el MVP | Leer contenido abre la puerta a la inyección de instrucciones y no es determinista | Sumar lectura de contenido con un modelo, que va a ADR (como US-17) |
| Corregir es cambiar la clase de una entrada en `relevamiento.json` (o con una opción del CLI) | Harvi trabaja en VS Code con el archivo abierto | Una interfaz para corregir, post-MVP |
| Los precios se reconocen por el nombre del archivo (precio, tarifa, lista) | Sin leer contenido no hay otra señal | Una planilla mal nombrada queda "sin clasificar" y se corrige a mano |
| Los topes de FR-012 se fijan en el plan (por ejemplo, 5000 archivos, 10 niveles, 50 MB por archivo) | Una carpeta de cliente real tiene decenas o cientos de archivos | Subir el tope; no cambia la lógica |

## §7 Riesgos y decisiones abiertas

- **Resolución mínima de las fotos** (FR-002): 1600 px de ancho para portada y 800 px para el resto (developer, 2026-11-23).
- **Contradicción entre fuentes** (reportada, no arbitrada; resuelta por el developer el 2026-11-23):

| Contradicción | Fuente A dice | Fuente B dice | Resolución |
|---|---|---|---|
| Dónde se corre el inventario | `packages/cli/AGENTS.md`: `specmate new … --carpeta <ruta> --maps <url>` | ADR-0031 punto 6 y ADR-0040: se retoma en otra sesión; Places fuera del MVP | Paso propio, repetible y sin `--maps`; se actualiza `packages/cli/AGENTS.md` (decisión del developer) |

- **Decodificar imágenes del cliente** para leer sus dimensiones es superficie de ataque (imágenes malformadas, bombas de descompresión): tope de píxeles y revisión `security` antes del PR.
- **Rutas del cliente en `relevamiento.json`**: quedan en el repo del sitio del cliente, nunca en el de SpecMate (principio XII); los tests usan carpetas inventadas en un directorio temporal.
