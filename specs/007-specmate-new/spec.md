---
id: US-13 (#41)
titulo: Crear el repo de un cliente desde la plantilla con un comando, sobre un CLI con Clean Architecture
estado: hecha             # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/41
analisis: no requerido (historia M sin reglas de negocio nuevas; el lead la analizó inline: §6 y §7)
depende_de: [US-11 (#39)]
revisa: developer (Andy)
zona_critica: no (no toca controles, brief, publicación, CSP ni credenciales)
estimacion: ~150k tok · ~4-5 h de agente · nivel estándar · a revisar tras el plan (duración del test de integración)
---

# Crear el repo de un cliente desde la plantilla con un comando

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #41 (épica E1, #19) | AC-1: `specmate new <slug>` crea un repo desde `templates/site` con contenido de ejemplo inventado y marcado; `npm ci`, build y tests del repo creado pasan · AC-2: Clean Architecture con test de arquitectura que falla si se viola una dependencia · AC-3: funciona en Windows, rutas con `path` |
| `ADR-0034` | El CLI sigue Clean Architecture; dominio y aplicación sin infraestructura; lo externo (sistema de archivos) entra por puertos; el test de arquitectura es gate desde la primera historia con código |
| `ADR-0029` y `packages/cli/AGENTS.md` | `new` crea el repo del sitio desde `templates/site`; `templates/site/AGENTS.md`: "`specmate new` la copia a un repo propio del cliente" |
| `.specify/memory/constitution.md` (XII, «Stack») | Ningún dato de un cliente real en este repo; Windows como plataforma principal |
| `specs/006-suite-de-controles/` (US-12) | La plantilla trae 513 tests y los controles `check:*`; el repo creado los hereda |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** arranca un sitio por cliente, **esto cambia** que cada
repo nace igual, con un comando y sin copiar carpetas a mano, y que el CLI empieza con
la estructura que va a sostener `brief`, `verify` y `publish`.

- **SC-001**: `specmate new <slug>` crea el repo en 1 comando, sin pasos manuales previos ni posteriores para que `npm ci`, `npm run build` y `npm test` pasen en él.
- **SC-002**: El test de arquitectura del CLI falla en al menos 1 caso construido a propósito (una importación de infraestructura desde dominio o aplicación) y pasa sobre el código real.
- **SC-003**: Los tests del CLI pasan en Windows.

## §3 Requisitos funcionales

- **FR-001**: `specmate new <slug>` DEBE crear una carpeta `<slug>` con una copia de `templates/site` sin los artefactos de build ni de instalación (`node_modules/`, `dist/`, `.astro/`, `.wrangler/`).
- **FR-002**: El repo creado DEBE ser un repositorio git con un primer commit que contiene la copia.
- **FR-003**: El contenido del repo creado DEBE ser el de un cliente de ejemplo inventado, marcado como inventado en el sitio que se construye (aviso visible) y en sus datos (principio XII).
- **FR-004**: El `<slug>` DEBE cumplir un formato fijo (minúsculas, dígitos y guiones, sin guion al inicio ni al final, ≤ 63 caracteres); si no lo cumple, el comando DEBE fallar sin crear nada y decir el formato esperado.
- **FR-005**: Si la carpeta destino ya existe, el comando DEBE fallar sin tocarla.
- **FR-006**: Si el comando falla a mitad de la copia, NO DEBE quedar una carpeta a medio crear.
- **FR-007**: El nombre del paquete del repo creado DEBE ser el `<slug>`.
- **FR-008**: El CLI DEBE separar dominio, aplicación e infraestructura; dominio y aplicación NO DEBEN importar infraestructura ni módulos de Node de E/S (ADR-0034).
- **FR-009**: Un test de arquitectura DEBE fallar ante cualquier violación de FR-008 y DEBE tener un caso que lo hace fallar a propósito.
- **FR-010**: El comando DEBE terminar con código 0 si creó el repo y distinto de 0 si no, con un mensaje que nombra la causa.

**Entidades clave:**
- **Slug del cliente**: identificador del repo y del paquete; formato de FR-004.
- **Repo del cliente**: carpeta con git, copia de la plantilla y datos de ejemplo inventados.

## §4 Fuera de alcance

- Las opciones `--carpeta`, `--maps` y `--ref` de `packages/cli/AGENTS.md` y el inventario del material del cliente (E2).
- Crear el repo remoto (GitHub u otro) o configurar un `remote`: necesita credenciales y es de publicación (E5).
- Datos reales de un cliente: el repo creado solo lleva el ejemplo inventado (XII).
- `specmate brief`, `verify` y `publish`.
- Actualizar un repo de cliente ya creado cuando cambia la plantilla.
- CI (GitHub Actions): los tests corren local en Windows (`project-guard` §6, gates a configurar).

## §5 Historias y criterios de aceptación

### US1 — Un comando crea el repo del cliente (Prioridad: P1)

El dueño de Harvi corre `specmate new <slug>` y obtiene un repo listo para trabajar.
**Prueba independiente:** correr el comando en una carpeta temporal y, dentro del repo
creado, `npm ci`, `npm run build` y `npm test`.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** una carpeta vacía **cuando** se corre `specmate new panaderia-ejemplo` **entonces** existe `panaderia-ejemplo/` con git y 1 commit, sin `node_modules/`, `dist/`, `.astro/` ni `.wrangler/`, con `name: "panaderia-ejemplo"` en su `package.json`, y el comando termina con código 0 | integración |
| AC-2 | **Dado** el repo de AC-1 **cuando** se corren `npm ci`, `npm run build` y `npm test` dentro de él **entonces** los 3 terminan con código 0 y `npm test` informa al menos 513 tests, 0 fallidos | integración |
| AC-3 | **Dado** el repo de AC-1 construido **cuando** se mira la página de inicio **entonces** muestra el aviso de sitio de ejemplo con datos ficticios | integración |
| AC-4 | **Dado** un slug inválido (al menos: `Mayus`, `-guion`, `guion-`, `con espacio`, `ñandu`, uno de 64 caracteres) **cuando** se corre el comando **entonces** termina con código ≠ 0, nombra el formato y no crea nada | unit |
| AC-5 | **Dado** que `<slug>/` ya existe (vacía o con archivos) **cuando** se corre el comando **entonces** termina con código ≠ 0 y la carpeta queda byte a byte igual | integración |
| AC-6 | **Dado** una falla inyectada a mitad de la copia **cuando** se corre el comando **entonces** termina con código ≠ 0 y `<slug>/` no existe | integración |

### US2 — El CLI nace con Clean Architecture (Prioridad: P1)

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-7 | **Dado** el código del CLI **cuando** corre el test de arquitectura **entonces** pasa, y cubre las 3 capas | arquitectura |
| AC-8 | **Dado** un archivo de dominio o de aplicación que importa infraestructura, o `node:fs` / `node:child_process` **cuando** corre el test de arquitectura **entonces** falla y nombra el archivo y la importación (al menos 2 casos: uno por capa) | arquitectura |
| AC-9 | **Dado** Windows **cuando** corren todos los tests del CLI **entonces** pasan; ningún archivo del CLI arma rutas concatenando `/` o `\\` | unit + `manual` (salida pegada en Windows) |

**Casos borde:**
- `git` no instalado: el comando falla con un mensaje claro y no deja la carpeta (AC-6, FR-006).
- Slug válido de 63 caracteres: se acepta (AC-4).
- Ejecutar el comando desde una ruta con espacios o acentos (`C:\Users\José Pérez\sitios`): funciona (AC-9).

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| "Crea un repo" es un repositorio git local con un primer commit, sin remoto | El ticket dice "repo" y no hay ADR que diga dónde vive | FR-002 y AC-1; el remoto sería otra historia con credenciales |
| El repo se crea en la carpeta actual, como `./<slug>` | El ticket no fija el destino | Una opción de destino; no cambia el resto |
| El ejemplo es la variante con dirección (`address`), que la plantilla construye por defecto | FR-003 pide un cliente inventado y la plantilla ya trae tres | Elegir otra variante es cambiar un dato |
| El formato del slug de FR-004 alcanza para nombre de carpeta, paquete npm y subdominio | Evita renombrar después; 63 es el largo de una etiqueta DNS | El patrón y AC-4 |
| El CLI encuentra `templates/site` desde su propia instalación en este repo | Hoy el CLI no se publica | Empaquetar la plantilla con el CLI (decisión de E5) |

## §7 Riesgos y decisiones abiertas

- **Duración de AC-2**: `npm ci` más los 513 tests de la plantilla tardan ~7-8 minutos y piden red (`npm audit`) y los navegadores de Playwright. El plan fija si AC-2 corre en `npm test` del CLI o como prueba aparte.
- **Plantilla que cambia**: el repo creado hereda la plantilla del momento; si después cambia, no se actualiza (fuera de alcance, §4).
- **Contradicciones entre fuentes** (reportadas, no arbitradas):

| Contradicción | Fuente A dice | Fuente B dice | Propuesta | Por qué |
|---|---|---|---|---|
| Firma de `new` | Issue #41: `specmate new <slug>` | `packages/cli/AGENTS.md`: `specmate new <cliente> --carpeta <ruta> --maps <url> [--ref <url>…]` (E1, E2) | US-13 hace `new <slug>`; las opciones llegan con E2 y `AGENTS.md` se actualiza para marcarlas como E2 | El ticket es E1 y el material del cliente es E2 |
