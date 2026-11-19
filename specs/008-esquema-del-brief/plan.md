# Plan de implementación: US-14, el sitio se construye desde `relevamiento.json`

**Rama**: `066-esquema-del-brief` | **Fecha**: 2026-11-20 | **Spec**: [spec.md](./spec.md) (aprobada 2026-11-20) | **Plan**: borrador
**Artefactos**: este plan. Sin `research.md` ni `contracts/`: el contrato es el esquema, que vive en el código y en sus tests.

## Resumen

La plantilla deja de leer un módulo `.ts` de datos (`@data`) y pasa a leer `relevamiento.json`. El validador que ya
existe (`src/lib/site.ts`, `parseSite`) se convierte en el validador del brief: mismo estilo (sin dependencias, error que
nombra la ruta del campo), con `source` y `confirmedBy` en cada dato publicable, un canal de contacto como mínimo y los
campos nuevos de ADR-0040. Los tres ejemplos y los fixtures de los tests pasan a ser `relevamiento.json`.

## Contexto técnico

Astro 7 estático · TypeScript estricto, solo sintaxis borrable · tests con `node:test` sobre builds reales
(`test/lib/build.mjs`, `SITE_DATA`/`SITE_OUT`) · sin dependencias nuevas · Windows primero · impacto en tokens de
modelo: ninguno (todo determinista).

## Constitution Check (pasa)

I ✅ sin dependencias nuevas · IV ✅ rojo primero, test tabular por campo · V ✅ el relevamiento es dato: se valida y se
escapa, nunca se ejecuta · VI ✅ un dato obligatorio sin confirmar rompe el build · XI ✅ 2.4.0, fuente y confirmación
por dato · XII ✅ los ejemplos son inventados y marcados. **Zona crítica: sí** (esquema del brief): revisión `security`
antes del PR. **RFC: no.**

## Estructura (`templates/site/`)

| Archivo | Cambio |
|---|---|
| `relevamiento.json` (raíz) | Nuevo: el del sitio; en la plantilla, el ejemplo con dirección (lo que `specmate new` copia) |
| `src/data/examples/{address,area,online}.relevamiento.json` | Reemplazan a los tres `.ts` |
| `src/lib/site.ts` | `parseRelevamiento(json, { root })` → `Site`; reemplaza a `parseSite` |
| `src/data/site.ts` | Lee el JSON de `SITE_DATA` (por defecto `relevamiento.json`) y llama al validador |
| `scripts/site-env.mjs`, `astro.config.mjs`, `tsconfig.json` | Se va el alias `@data`; `SITE_DATA` pasa a ser la ruta del JSON |
| `src/pages/index.astro`, `src/layouts/Base.astro`, `src/lib/schema.ts`, `src/lib/head.ts` | Canales separados, contenido libre, logo, link de Maps y `geo` |
| `scripts/controls/origins.mjs` | Lee la lista blanca del brief (`--data <relevamiento.json>`) |
| `test/**` | Fixtures a JSON; tests tabulares nuevos por campo |
| `AGENTS.md` (plantilla y CLI) | La invariante del archivo y el comando que lo valida |

## Decisiones (para el gate)

1. **El validador de la plantilla es la única fuente del esquema.** El CLI no tiene un esquema propio: cuando haga
   falta validar fuera del build (US-19), corre el validador del repo del sitio (`npm run check:brief`). *Por qué:* la
   plantilla no puede depender del CLI y cada repo de cliente queda con el esquema de su versión. *Descartado:* Zod en
   el CLI (dos esquemas que divergen) y un JSON Schema con `ajv` (una dependencia nueva para lo que ya hace
   `parseSite`). `packages/cli/AGENTS.md` deja de mencionar Zod.
2. **Forma del dato publicable:** `{ ...valor, "source": "…", "confirmedBy": "…" }`, como hoy con `confirmed`. Un
   `confirmedBy` vacío o ausente = sin confirmar.
3. **Contacto:** `contact: { phone?, whatsapp?, email? }`; teléfono y WhatsApp tienen `display` y `e164`. Se exige uno
   confirmado. `telephone` del JSON-LD sale del teléfono; si solo hay WhatsApp, de WhatsApp (sigue siendo un número del
   negocio); el email va a `email`.
4. **Ubicación:** `address?`, `areaServed?`, `geo?: { latitude, longitude }`, `mapsUrl?` (`https`). El tipo de
   schema.org sigue la tabla de ADR-0035; `geo` solo se agrega con dirección.
5. **Contenido libre:** `sections?: [{ id, title, body } | { id, title, items }]`; `id` en minúsculas y guiones, único,
   usado como ancla. Se muestran en su orden, después de "Nosotros", con un estilo simple.
6. **Logo:** `logo?: { light, dark?, alt }`, rutas relativas al repo; el validador rechaza `..`, rutas absolutas y
   archivos que no existen. Se muestra en el header con `<picture>` (oscuro por `prefers-color-scheme`).
7. **Claves desconocidas rompen el build** (FR-011), en todos los niveles; se admiten `$comment` y `$schemaVersion`.
8. **`steps`** (estado de los pasos) se acepta como objeto opaco y no se valida en US-14: lo definen US-15 a US-19.

## Orden test-first y unidades

| # | Unidad | Rojo primero | Cubre |
|---|---|---|---|
| U1 | Validador del brief | Test tabular: cada dato obligatorio sin `source`/`confirmedBy`; clave desconocida; sin canal; cada canal solo; rutas de logo inválidas; coordenadas y link inválidos | FR-002 a FR-009, FR-011 · AC-1, AC-3, AC-5, AC-8 |
| U2 | Carga desde `relevamiento.json` | El build con `SITE_DATA=<json>` construye; sin archivo, falla nombrándolo | FR-001 |
| U3 | Render | Opcional sin confirmar no aparece en HTML ni JSON-LD; WhatsApp solo sin "Llamar"; secciones libres en orden y escapadas; logo con su `alt` | FR-005 a FR-008, FR-012 · AC-2, AC-4, AC-7 |
| U4 | Ejemplos y fixtures a JSON | La suite actual, migrada, en verde | FR-013 · AC-9 |
| U5 | `check:origins` desde el brief | Un origen dentro de la lista pasa y uno fuera falla | FR-010 · AC-10 |
| U6 | Sitio chico de punta a punta y `specmate new` | Variante "solo WhatsApp, sin horario ni dirección, URL de Workers" con los 7 controles; el repo creado tiene `relevamiento.json` | AC-6, AC-11 |

**Quién escribe:** U1 a U6 son una cadena acoplada (el validador, sus datos y sus tests): **un solo agente
`frontend`, nivel máximo** por zona crítica, motivo de delegación: respaldo de contexto (la sesión del lead es larga).
Después, **`security`** como verificador independiente, y la suite entera una vez, al final.

## Riesgos abiertos

- **Migración de la suite:** ~90 referencias a los ejemplos y fixtures en `test/`. Es mecánico pero largo; el riesgo es
  bajar la cobertura sin notarlo. Mitigación: el conteo de tests no baja (hoy 519) y cada fixture conserva su caso.
- **`specmate new`:** el e2e del CLI construye el repo creado; cambia lo que copia (el JSON en vez del `.ts`), no cómo.
- **Sitios ya creados** (el del spike) quedan con el formato anterior: fuera de alcance (spec §4).

## Complexity Tracking

Sin desvíos de la constitución.
