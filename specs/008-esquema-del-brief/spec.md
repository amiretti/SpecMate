---
id: US-14 (#66)
titulo: Construir cada sitio desde un relevamiento.json validado, donde cada dato publicable dice de dónde salió y quién lo confirmó
estado: hecha             # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/66
analisis: no requerido (el lead lo analizó inline con lo medido en el spike: §1, §6 y §7)
depende_de: []
revisa: developer (Andy, spec aprobada 2026-11-20: "sí"); revisión `security` obligatoria antes del PR
zona_critica: esquema del brief (project-guard §5)
estimacion: ~200k tok · ~5-6 h de agente · nivel máximo por zona crítica · a revisar tras el plan
---

# Construir cada sitio desde un relevamiento.json validado

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #66 (épica E2, #20) | AC-1: rechaza un dato publicable sin fuente o sin confirmación, nombrando el campo · AC-2: basta un canal de contacto confirmado; horario, dirección, coordenadas, link de Maps y dominio opcionales · AC-3: contenido libre, logo claro y oscuro, lista blanca de orígenes (#49) · AC-4: la plantilla construye desde un `relevamiento.json` inventado y los 7 controles pasan |
| Decisión del developer (2026-11-20) | Un solo archivo, `relevamiento.json`, en la raíz del repo del sitio, con el brief adentro; cada dato publicable lleva `source` y `confirmedBy` (quién, cómo y cuándo), que reemplaza al `confirmed: true` |
| ADR-0030 (fila *Brief válido*) | Cada dato publicable tiene fuente y quién lo confirmó; 0 datos sin confirmar |
| ADR-0031 punto 6 | Todo queda en `relevamiento.json`, con la fuente de cada dato, y se puede retomar |
| ADR-0035 | Dirección y Maps opcionales; el tipo de schema.org sale del caso (dirección, zona o solo online); JSON-LD solo con el serializador de la plantilla |
| ADR-0040 puntos 1 y 4 | Sin Places; basta un canal de contacto; horario y dominio opcionales; contenido libre; logo claro y oscuro; coordenadas o link de Maps a mano |
| Constitución XI y XII | Nada se publica sin fuente y confirmación; los ejemplos son clientes inventados y marcados |
| Spike US-06 (`docs/spike/informe.md`, incógnita 1) | El esquema trabó a un negocio que solo atiende por WhatsApp y sin dominio, y no tenía lugar para "cómo funciona" ni "qué incluye" |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** arma el sitio de un cliente, **esto cambia** que los
datos del negocio viven en un solo archivo que se puede revisar, retomar y auditar: cada
dato publicado dice de dónde salió y quién lo confirmó, y un dato sin confirmar no llega
al sitio.

- **SC-001**: Un `relevamiento.json` con un dato obligatorio sin `source` o sin `confirmedBy` hace fallar el build, y el error nombra el campo con su ruta completa.
- **SC-002**: Un negocio con un solo canal de contacto (por ejemplo, solo WhatsApp), sin horario, sin dirección y sin dominio propio construye un sitio que pasa los 7 controles de ADR-0030.
- **SC-003**: Los tres sitios de ejemplo de la plantilla salen de tres `relevamiento.json` inventados y marcados, y la suite de la plantilla sigue en verde.

## §3 Requisitos funcionales

- **FR-001**: El sitio DEBE construirse desde `relevamiento.json` en la raíz de su repo. El archivo DEBE tener una versión de esquema y un `brief` con los datos que el sitio publica; PUEDE tener el estado de los pasos del relevamiento (ADR-0031), que el build ignora.
- **FR-002**: Todo dato publicable DEBE llevar `source` (de dónde salió) y `confirmedBy` (quién lo confirmó, cómo y cuándo), ambos texto no vacío. Un dato sin `confirmedBy` está sin confirmar.
- **FR-003**: Un dato obligatorio sin confirmar, o sin `source`, DEBE hacer fallar el build con un error que nombra su ruta (por ejemplo, `brief.contact.email.confirmedBy`). Un dato opcional sin confirmar NO DEBE publicarse.
- **FR-004**: Son obligatorios: el nombre, la frase de presentación, el texto "sobre el negocio", la URL del sitio (`https`, solo el origen; puede ser la de Workers si no hay dominio propio) y **al menos un canal de contacto confirmado** entre teléfono, WhatsApp y email.
- **FR-005**: Teléfono y WhatsApp DEBEN ser canales separados: un número solo de WhatsApp no genera un botón "Llamar".
- **FR-006**: Son opcionales: horarios, dirección, zona de atención, coordenadas, link de Maps, perfiles, preguntas frecuentes, logo, secciones de contenido libre y orígenes externos. Si no están, el sitio no muestra su sección ni los incluye en el JSON-LD.
- **FR-007**: El brief DEBE admitir **secciones de contenido libre**: cada una con título y un texto o una lista, en el orden en que se cargaron, con `source` y `confirmedBy`.
- **FR-008**: El brief DEBE admitir el **logo** en una versión para fondo claro y, opcional, otra para fondo oscuro, más su texto alternativo. Las rutas DEBEN apuntar a archivos dentro del repo del sitio; una ruta que sale del repo o que no existe DEBE hacer fallar el build.
- **FR-009**: Las coordenadas DEBEN ser latitud y longitud válidas, y el link de Maps DEBE ser `https`. "Cómo llegar" DEBE usar el link de Maps si existe, y si no la dirección (ADR-0035).
- **FR-010**: La **lista blanca de orígenes externos** (cada origen `https` exacto con su motivo) DEBE vivir en el brief, y `check:origins` DEBE leerla de ahí (#49).
- **FR-011**: Una clave desconocida en el brief DEBE hacer fallar el build, nombrándola, para que un error de tipeo no haga desaparecer un dato.
- **FR-012**: Todo texto del brief DEBE renderizarse escapado, y el JSON-LD DEBE salir solo del serializador de la plantilla (ADR-0035, ADR-0037).
- **FR-013**: Los tres sitios de ejemplo de la plantilla (con dirección, con zona y solo online) DEBEN salir de tres `relevamiento.json` inventados y marcados como tales, y `specmate new` DEBE dejar en el repo del cliente el de dirección.

**Entidades clave:**
- **Relevamiento**: el archivo; versión, brief y estado de los pasos.
- **Brief**: los datos que el sitio publica.
- **Dato publicable**: un valor con `source` y `confirmedBy`.
- **Canal de contacto**: teléfono, WhatsApp o email.
- **Sección de contenido libre**: título más texto o lista, con fuente y confirmación.

## §4 Fuera de alcance

- Los pasos del relevamiento que llenan el archivo (US-15 a US-19) y el comando `specmate brief`.
- Leer el archivo de tokens del cliente (US-16).
- El diseño de las secciones de contenido libre y del logo: alcanza con que se muestren de forma simple; su estilo es de la biblioteca (E4).
- Migrar sitios de clientes ya creados con el formato anterior.

## §5 Historias y criterios de aceptación

### US1 — Un dato sin confirmar no llega al sitio (Prioridad: P1)

**Prueba independiente:** construir la plantilla con `relevamiento.json` mutados, un campo por caso.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** un relevamiento válido **cuando** se le quita `confirmedBy` o `source` a cada dato obligatorio, de a uno **entonces** el build falla y el error nombra la ruta del campo | test tabular |
| AC-2 | **Dado** un dato opcional sin `confirmedBy` (un horario, un perfil, una sección libre) **cuando** se construye **entonces** el build pasa y el dato no aparece ni en el HTML ni en el JSON-LD | test |
| AC-3 | **Dado** una clave desconocida en el brief **cuando** se construye **entonces** el build falla nombrándola | test |

### US2 — Un negocio chico entra en el esquema (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-4 | **Dado** un brief con un solo canal confirmado, para cada uno de teléfono, WhatsApp y email **cuando** se construye **entonces** el build pasa y el sitio muestra solo ese canal | test tabular |
| AC-5 | **Dado** un brief sin ningún canal confirmado **cuando** se construye **entonces** el build falla diciendo que falta un canal de contacto | test |
| AC-6 | **Dado** un brief solo con WhatsApp, sin horario, sin dirección y con una URL de Workers **cuando** se construye y se corren los 7 controles **entonces** todos pasan y no hay botón "Llamar" | integración |
| AC-7 | **Dado** dos secciones de contenido libre y un logo claro y oscuro **cuando** se construye **entonces** las secciones aparecen en su orden, escapadas, y el logo se muestra con su texto alternativo | test |
| AC-8 | **Dado** un logo con una ruta fuera del repo (`../x.svg`) o inexistente **cuando** se construye **entonces** el build falla nombrando el campo | test |

### US3 — Los ejemplos y los controles usan el relevamiento (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-9 | **Dado** los tres `relevamiento.json` de ejemplo **cuando** se corre la suite de la plantilla **entonces** pasa entera, con los 7 controles en verde en las tres variantes | suite |
| AC-10 | **Dado** un origen externo en la lista blanca del brief y otro fuera **cuando** se corre `check:origins` **entonces** pasa con el primero y falla nombrando el segundo | test |
| AC-11 | **Dado** un repo creado con `specmate new` **cuando** se mira su raíz **entonces** tiene el `relevamiento.json` del ejemplo con dirección, marcado como inventado | integración del CLI |

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| Las claves del archivo van en inglés, como el código de la plantilla | Los artefactos técnicos van en inglés; el contenido, en el idioma del cliente | Renombrar claves; no cambia la lógica |
| `confirmedBy` es texto libre ("Andrés, por WhatsApp, 2026-11-19"), no una estructura | Alcanza para auditar y no obliga a un formato que nadie pidió | Un objeto `{ who, how, at }` |
| La plantilla valida el archivo al construir; el CLI lo va a validar con el mismo esquema en US-19 | La plantilla no puede depender del CLI, y el build es el último punto antes de publicar | El plan decide cómo se comparte el esquema |
| Las coordenadas se publican solo en el JSON-LD (`geo`), no como mapa embebido | Un mapa embebido pide un origen externo en la CSP | Un mapa embebido es un origen en la lista blanca, con motivo |

## §7 Riesgos y decisiones abiertas

- **Constitución, principio XI:** decía "Google Maps pre-llena y cruza datos", y ADR-0040 sacó Places del MVP. Enmienda 2.4.0 ratificada por Andy con esta spec (2026-11-20).
- **Contradicciones entre fuentes** (reportadas, no arbitradas; resueltas por el developer el 2026-11-20):

| Contradicción | Fuente A dice | Fuente B dice | Resolución |
|---|---|---|---|
| Nombre del archivo | ADR-0030: `brief.json` | ADR-0031: `relevamiento.json` con el brief adentro | `relevamiento.json` (decisión del developer) |
| Marca de confirmación | ADR-0030: `confirmadoPor` (quién) | Plantilla US-11: `confirmed: true` | `confirmedBy` con quién, cómo y cuándo (decisión del developer) |

- **Esquema compartido:** el CLI (Zod, `packages/cli/AGENTS.md`) y la plantilla (validador propio) tienen que validar lo mismo sin que la plantilla dependa del CLI. Lo resuelve el plan.
- **Tamaño de los textos:** el esquema no fija largos máximos; un texto enorme rompe el diseño pero no la seguridad (se escapa). El plan decide si se acotan.
