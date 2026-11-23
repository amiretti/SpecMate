# Plan de implementación: US-15, inventario de la carpeta del cliente

**Rama**: `067-inventario-de-la-carpeta` | **Fecha**: 2026-11-23 | **Spec**: [spec.md](./spec.md) (aprobada 2026-11-23) | **Plan**: borrador
**Artefactos**: este plan y [data-model.md](./data-model.md) (forma de `steps.inventory`). Sin `research.md`: no hay
aclaraciones técnicas abiertas y la única alternativa (cómo leer dimensiones) se resuelve acá. Sin `contracts/`: la
interfaz es el comando, descrito abajo. Sin `quickstart.md`: no hay AC `manual`.

## Resumen

Un comando nuevo del CLI, `specmate inventory <slug>`, recorre la carpeta del cliente en modo solo lectura, clasifica
cada archivo por nombre, extensión y metadatos, lee las dimensiones de las imágenes desde su cabecera (sin
decodificarlas), muestra **encontré · falta · avisos** y guarda el resultado en `steps.inventory` del
`relevamiento.json` del sitio, conservando las correcciones manuales.

## Contexto técnico

`packages/cli`, TypeScript estricto, solo sintaxis borrable · Clean Architecture (ADR-0034, lo impone
`test/architecture.test.ts`) · vitest; integración corriendo `src/cli/index.ts` sin compilar · **sin dependencias
nuevas** · Windows primero · impacto en tokens de modelo: ninguno (todo determinista, principio IX).

## Constitution Check (pasa)

I ✅ sin dependencias · IV ✅ rojo primero, tests tabulares por clase y por caso hostil · V ✅ no se lee ni se guarda
el contenido: un archivo no puede dar instrucciones · VI ✅ carpeta ilegible, tope superado o raíz dentro de SpecMate
fallan con el motivo · IX ✅ sin modelo · XII ✅ carpetas inventadas en `os.tmpdir()`; la raíz de clientes no puede
estar dentro del repo. **Zona crítica (§5): no**, pero entrada no confiable: revisión `security` antes del PR.
**RFC: no** (ningún borde nuevo entre módulos; el inventario es un caso de uso más del CLI).

## Comando

```
specmate inventory <slug> [--clients <dir>]
```

- Carpeta del cliente: `<raíz>/<slug>`. Raíz: `--clients`, si no `SPECMATE_CLIENTS_DIR`; sin ninguna, uso incorrecto
  (salida 2) nombrando las dos.
- Sitio: `./<slug>/relevamiento.json` (el repo que creó `specmate new`); si no existe, falla nombrándolo.
- Salidas: 0 hecho · 1 falló (el mensaje dice por qué) · 2 uso incorrecto, como `new`.

## Decisiones (para el gate)

1. **Dimensiones desde la cabecera, sin decodificar.** Un parser propio y acotado lee ancho y alto de PNG, JPEG,
   WebP, GIF, SVG (`width`/`height`/`viewBox`, sin ejecutar ni resolver nada) y AVIF. *Por qué:* no decodificar
   elimina las bombas de descompresión y la superficie de un decodificador nativo. *Descartado:* `sharp` en el CLI
   (binario nativo y dependencia nueva) e `image-size` (dependencia nueva para ~150 líneas). Una cabecera que no se
   entiende = "ilegible"; `ancho × alto` > 100 MP = aviso "supera el tope de píxeles".
2. **Reglas de clasificación en una tabla del dominio** (`src/domain/inventory.ts`), sobre el nombre normalizado
   (minúsculas, sin acentos, separadores unificados), en este orden: posible secreto → tokens (`*.tokens.json`,
   `tokens*.json`) → manual (`manual|brand|brandbook|identidad|guia de marca` + pdf) → logo (`logo|isologo|isotipo|
   logotipo` + imagen o `ai|eps|pdf`) → precios (`precio|tarifa|lista de precios` + pdf, planilla o texto) → foto
   (imagen) → texto (`txt|md|doc|docx|odt|rtf|pdf`) → sin clasificar.
3. **No se sigue ningún link**, apunte adentro o afuera: se lista como omitido. Cumple FR-009 y evita dobles conteos.
4. **Topes**: 5000 archivos, 10 niveles, 50 MB por archivo; superarlos hace fallar el comando nombrando el tope y el
   valor (FR-012). Un video grande hace fallar: se acepta para el MVP (ver riesgos).
5. **Se escribe solo `steps.inventory`**: el resto de `relevamiento.json` se conserva tal cual (se reescribe con
   `JSON.stringify(_, null, 2)` y LF); escritura atómica (temporal + `rename`). Entradas ordenadas por ruta y sin fecha,
   para que dos corridas iguales den el mismo archivo (SC-002).
6. **La raíz de SpecMate** sale de `TemplateSource.locate()` (dos niveles arriba de `templates/site`); se compara con
   `realpath` de la raíz de clientes y de la carpeta del cliente.
7. **Corregir = editar `kind` en `steps.inventory`** y volver a correr: la entrada pasa a `correctedBy: "manual"` y
   gana. Una opción del CLI para corregir queda para cuando haga falta.

## Estructura (`packages/cli/`)

| Archivo | Cambio |
|---|---|
| `src/domain/inventory.ts` | Clasificación, normalización de nombres, fusión con el inventario anterior |
| `src/domain/image-header.ts` | Dimensiones desde los primeros bytes; sin `node:*` |
| `src/application/inventory-client-folder.ts` | Caso de uso: valida raíces, recorre, clasifica, fusiona, guarda |
| `src/application/ports.ts` | `ClientFolder` (listar con `lstat`, leer cabecera, hash) y `RelevamientoStore` (leer y escribir `steps.inventory`) |
| `src/infrastructure/node-client-folder.ts`, `node-relevamiento-store.ts` | Adaptadores de Node |
| `src/cli/main.ts` | Comando `inventory`, opción `--clients`, `SPECMATE_CLIENTS_DIR`, salida agrupada |
| `test/**` | Unit del dominio; integración con carpetas inventadas en `os.tmpdir()` |
| `AGENTS.md` (CLI) | Fila de `inventory`; se va `new … --carpeta --maps` (decisión del gate de la spec) |

## Orden test-first y unidades

| # | Unidad | Rojo primero | Cubre |
|---|---|---|---|
| U1 | Cabeceras de imagen | Tabla por formato con bytes inventados; cabecera rota; > 100 MP | FR-002, FR-011 · AC-2 |
| U2 | Clasificación | Tabla por clase, con acentos, mayúsculas y espacios; nombre con instrucciones = neutro | FR-001, FR-006, FR-010 · AC-1, AC-4, AC-7 |
| U3 | Recorrido seguro | Junction, `.env`, `.DS_Store`, imagen rota, topes, carpeta vacía, carpeta intacta (hash) | FR-008 a FR-012 · AC-9 a AC-12 |
| U4 | Raíces y comando | `--clients`, variable de entorno, ninguna, raíz dentro de SpecMate | FR-007 · AC-8 |
| U5 | Guardar y retomar | Corrección conservada; archivo nuevo y borrado; resto del JSON intacto | FR-003 a FR-005 · AC-3, AC-5, AC-6 |

**Quién escribe:** el lead, inline; es una cadena acoplada (dominio → caso de uso → comando) y no hay motivo para
delegar. Después, **`security`** (nivel máximo) como verificador independiente y la suite entera una vez.

## Riesgos abiertos

- **Videos y archivos grandes**: un video de más de 50 MB hace fallar el inventario (FR-012). Si en el uso real molesta,
  se cambia a "omitido por tamaño" con una enmienda a la spec.
- **Heurística de nombres**: una planilla de precios mal nombrada queda "sin clasificar"; se corrige a mano (FR-004).
