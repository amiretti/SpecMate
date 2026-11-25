# Plan de implementación: US-17, el negocio, el objetivo y el tono

**Rama**: `069-negocio-objetivo-tono` | **Fecha**: 2026-11-24 | **Spec**: [spec.md](./spec.md) (aprobada 2026-11-24) | **Plan**: aprobado (2026-11-24, Andy: "sí, aprobado!")
**Artefactos**: este plan, con la forma de la propuesta y de `steps.profile` abajo. Sin `research.md` ni `contracts/`:
la interfaz es el comando y la propuesta, descritos acá. `quickstart.md`: no; los AC `manual` se corren con la skill.

## Resumen

Un comando nuevo, `specmate profile <slug>`, guarda los pasos 2 a 4 en `steps.profile`: recibe la propuesta que arma
el agente de la sesión, la valida y verifica las citas contra los archivos del cliente. Muestra **encontré · inferí ·
falta** y registra lo que Harvi confirma, corrige o delega. La lectura con modelo la hace un subagente nuevo de solo
lectura (`client-reader`), conducido por una skill nueva (`relevamiento`). El CLI no llama a ningún modelo (ADR-0041).

## Contexto técnico

`packages/cli`, TypeScript estricto, solo sintaxis borrable · Clean Architecture (ADR-0034) · vitest e integración con
`src/cli/index.ts` sin compilar · **sin dependencias nuevas** · Windows primero. **Impacto en tokens (principio IX):**
una lectura del subagente por relevamiento, con tope de 20 archivos y 300 KB de texto; se estima en ~30-60k tokens de
entrada y ~2k de salida en nivel `estándar`, una vez por cliente (y otra si Harvi pide releer).

## Constitution Check (pasa)

I ✅ sin dependencias · IV ✅ rojo primero, una prueba por regla · V ✅ el texto del cliente lo lee solo un subagente sin
escritura ni ejecución; lo que devuelve pasa por un validador de campos cerrados y las citas se verifican · IX ✅ CLI sin
modelo; el consumo del subagente queda declarado y con tope · XI ✅ lo inferido nunca queda confirmado sin Harvi · XII ✅
clientes inventados en `os.tmpdir()`. **Zona crítica (§5): no**; revisión `security` antes del PR (OWASP LLM01).
**RFC: no.**

## Comando

```
specmate profile <slug> [--clients <dir>]                       muestra los pasos 2 a 4 y qué falta preguntar
specmate profile <slug> propose [--clients <dir>]               lee una propuesta JSON por stdin, la valida y la guarda
specmate profile <slug> set <campo> <valor>                     Harvi confirma un valor propio (corrige o completa)
specmate profile <slug> confirm <campo>                         Harvi confirma lo inferido tal cual
specmate profile <slug> pick <campo>                            "no sé, elegí vos"
```

- Carpeta del cliente y sitio: los mismos de `inventory` y `tokens` (`--clients` o `SPECMATE_CLIENTS_DIR`); `--clients`
  solo hace falta para `propose` y para mostrar, que leen archivos del cliente.
- **Volver a un paso anterior** no es un comando: es corregir con `set` un campo de un paso anterior (FR-008). La
  conversación la lleva la skill.
- Salidas: 0 hecho · 1 falló (la propuesta o el valor no valen, nombrando el campo; nada cambia) · 2 uso incorrecto.

## Decisiones (para el gate)

1. **Campos** (FR-002), con su catálogo:
   - `business.category`: uno de 16 rubros (peluquería y barbería, estética, restaurante, cafetería, panadería,
     comercio, ferretería, taller mecánico, veterinaria, consultorio médico, odontología, psicología, estudio jurídico,
     estudio contable, gimnasio, oficios a domicilio) u `other:<nombre>` (hasta 60 caracteres).
   - `business.differentiator` y `business.audience`: texto de hasta 280 caracteres.
   - `goal.action`: `call`, `whatsapp`, `book`, `visit` o `quote`.
   - `tone.choice`: `close` (cercano), `professional` (profesional) o `energetic` (enérgico).
   - `tone.samples`: la misma frase en los tres tonos, hasta 240 caracteres cada una. Se muestra; no se confirma.
2. **Tabla de rubros** en el dominio (`src/domain/business-profile.ts`): por rubro, la acción y el tono sugeridos y los
   datos obligatorios (para US-19). Un test tabular fija las 16 filas; sumar una es una línea visible en el diff.
3. **La propuesta** llega por stdin (hasta 64 KB), así no queda un archivo suelto:
   ```json
   { "fields": { "business.category": { "value": "peluqueria", "kind": "found",
       "source": "textos/quienes-somos.txt", "quote": "Somos una peluquería de barrio" } },
     "samples": { "close": "…", "professional": "…", "energetic": "…" } }
   ```
   Se rechaza entera ante: una clave desconocida, un valor fuera de catálogo o de largo, una `source` que no es un
   archivo presente del inventario de clase `text`, `brand-manual` o `prices`, o `kind` que no sea `found` o `inferred`.
   `goal.action` y `tone.choice` no se aceptan en la propuesta: salen de la tabla (ADR-0041 punto 4).
4. **Verificar la cita** (FR-004): solo en archivos `.txt` y `.md`, leídos con el `readFile` de US-16 (tope de 1 MB,
   sin links ni hardlinks). Se compara con los espacios y saltos de línea colapsados y sin mayúsculas. En otro formato,
   o si la cita no está, el dato queda en `inferred` con un aviso. La cita se guarda hasta 300 caracteres.
5. **`steps.profile`**:
   ```json
   { "version": 1,
     "fields": { "business.category": { "state": "confirmed", "value": "peluqueria", "source": "…", "quote": "…",
                 "confirmedBy": "Harvi, specmate profile set, 2026-11-24", "delegated": false } },
     "samples": { "close": "…", "professional": "…", "energetic": "…", "source": "agent" } }
   ```
   `state`: `missing`, `found`, `inferred` o `confirmed`. Una propuesta nueva solo toca los campos que no están
   `confirmed` (FR-009). Cambiar `business.category` recalcula las sugerencias y avisa si una acción o un tono
   confirmados difieren (FR-008). Un `steps.profile` con otra forma falla nombrando el campo.
6. **Subagente `client-reader`** (rol nuevo en `.agents/roles/`): `capabilities: [read]` (Read, Grep y Glob, sin
   Bash, escritura, web ni MCP), nivel `estándar`. Recibe la lista de archivos y devuelve solo el JSON de la propuesta.
   La skill `relevamiento` lo lanza, le pasa los archivos dentro del tope (20 archivos, 300 KB) y entrega la salida a
   `specmate profile <slug> propose` por stdin. Después conduce la conversación: muestra el paso, pregunta lo que falta
   y usa `set`, `confirm` o `pick`.
7. **Cómo se impone ADR-0041**: un test del CLI falla si `packages/cli/package.json` declara una dependencia de un SDK
   de modelos, si el código del CLI lee una clave de proveedor de IA, o si el rol `client-reader` tiene algo más que
   `capabilities: [read]` o algún MCP.

## Estructura

| Archivo | Cambio |
|---|---|
| `packages/cli/src/domain/business-profile.ts` | Campos, catálogos, tabla de rubros, validar la propuesta, fusionar con lo guardado, sugerencias, confirmar, corregir y delegar |
| `packages/cli/src/domain/quote.ts` | Normalizar y buscar una cita en un texto |
| `packages/cli/src/application/business-profile-step.ts` | Casos de uso: mostrar, proponer, `set`, `confirm`, `pick` |
| `packages/cli/src/application/ports.ts` | `StepName` suma `profile`; `Io` recibe stdin |
| `packages/cli/src/cli/main.ts`, `index.ts` | Comando `profile`, subcomandos, ayuda y salida |
| `packages/cli/AGENTS.md` | Fila de `profile` e invariante de ADR-0041 |
| `.agents/roles/client-reader.md`, `.agents/skills/relevamiento/SKILL.md` | Rol y skill; los archivos de `.claude/` se regeneran con `tools/project.mjs` |
| `packages/cli/test/**` | Unit del dominio, integración del comando, test de ADR-0041 |

## Orden test-first y unidades

| # | Unidad | Rojo primero | Cubre |
|---|---|---|---|
| U1 | Catálogo y tabla | Tabla de 16 rubros con acción y tono; `other:` sin sugerencia | FR-002, FR-005 |
| U2 | Propuesta | Una por cada rechazo de la decisión 3; propuesta válida → estados | FR-003 · AC-1, AC-2 |
| U3 | Cita | Cita presente con otro espaciado; ausente; PDF → `inferred` | FR-004 · AC-3 |
| U4 | Confirmar, corregir, delegar | `pick` con y sin sugerencia; cambio de rubro con acción confirmada; propuesta que no pisa un confirmado | FR-007 a FR-009 · AC-4 a AC-6 |
| U5 | Comando | Mostrar encontré · inferí · falta; `propose` por stdin; resto del JSON intacto; nombres escapados | FR-001, FR-006, FR-010 · AC-1 |
| U6 | ADR-0041 | Sin SDK ni claves en el CLI; `client-reader` solo lee | ADR-0041 |
| U7 | Rol y skill | Proyección regenerada; la skill nombra topes y el comando | FR-011 · AC-7, AC-8 (manual) |

**Quién escribe:** el lead, inline (cadena acoplada). Después, **`security`** (nivel máximo) como verificador
independiente y la suite entera una vez. Los AC `manual` (AC-7, AC-8) se corren con la skill sobre un cliente inventado
y se pegan en `tasks.md`.

## Riesgos abiertos

- **El subagente puede leer cualquier archivo**: Read no se limita a una carpeta. La skill le pasa solo las rutas del
  inventario y no tiene red ni escritura, pero un texto hostil podría hacerle leer otro archivo y volcarlo en un campo
  de texto. Se acota con los largos y con la cita verificada, y queda en el repo del cliente, nunca en el de SpecMate.
  Lo revisa `security`.
- **Calidad de la inferencia**: no se puede probar por igual (ADR-0041); se mide en los AC `manual`.
