# Plan de implementación: US-16, tokens del cliente

**Rama**: `068-tokens-del-cliente` | **Fecha**: 2026-11-24 | **Spec**: [spec.md](./spec.md) (aprobada 2026-11-24) | **Plan**: aprobado (2026-11-24, Andy: "sí")
**Artefactos**: este plan, con la forma de `steps.tokens` abajo. Sin `research.md`: el formato DTCG 2025.10 se leyó en
<https://www.designtokens.org/tr/2025.10/format/> y lo que importa está en "Lectura de DTCG". Sin `contracts/`: la
interfaz es el comando. Sin `quickstart.md`: no hay AC `manual`.

## Resumen

Un comando nuevo, `specmate tokens <slug>`, lee el archivo de tokens que el inventario (US-15) detectó en la carpeta
del cliente. Lo traduce al contrato de la plantilla: directo si es DTCG con los nombres del contrato, y si no, con un
mapeo que guarda en `steps.tokens` para que el operador lo complete y lo confirme. Verifica el contraste y, con todo en
orden y confirmado, escribe `src/data/tokens.json` del sitio.

## Contexto técnico

`packages/cli`, TypeScript estricto, solo sintaxis borrable · Clean Architecture (ADR-0034, `test/architecture.test.ts`)
· vitest e integración con `src/cli/index.ts` sin compilar · **sin dependencias nuevas** · Windows primero · sin modelo
(principio IX). Toca además `templates/site/src/lib/tokens.ts` (un export, decisión 1).

## Constitution Check (pasa)

I ✅ sin dependencias · IV ✅ rojo primero, una prueba por regla · V ✅ el archivo del cliente es dato: solo se leen
valores por ruta, nada se interpreta · VI ✅ cada bloqueo se nombra (faltante, valor inválido, contraste, tope, ciclo)
· IX ✅ sin modelo · XII ✅ archivos inventados en `os.tmpdir()`. **Zona crítica (§5): no**, pero la salida termina en el
CSS del sitio: revisión `security` antes del PR. **RFC: no.**

## Comando

```
specmate tokens <slug> [--clients <dir>] [--file <ruta>] [--confirm]
```

- Carpeta del cliente y sitio: igual que `inventory` (`--clients` o `SPECMATE_CLIENTS_DIR`; `./<slug>/relevamiento.json`),
  con los mismos chequeos de "fuera del repo de SpecMate".
- El archivo sale de `steps.inventory`: las entradas de clase `tokens` que siguen presentes. Ninguna: falla con "run
  specmate inventory first" o "no tokens file in the inventory". Varias: falla listándolas y pidiendo `--file <ruta>`.
- `--confirm` marca el mapeo actual como confirmado (para el hash actual del archivo).
- Salidas: **0** si escribió los tokens o si quedó esperando confirmación sin nada que lo bloquee · **1** si algo bloquea
  (faltantes, valores inválidos, contraste, archivo ilegible o fuera de tope) · **2** uso incorrecto. En 1, `steps.tokens`
  igual se guarda, para corregir sobre él.

## Decisiones (para el gate)

1. **El contrato sale del sitio, no se copia en el CLI.** `templates/site/src/lib/tokens.ts` exporta la lista de las
   28 rutas (`TOKEN_PATHS`, armada con las constantes que ya usa), y el CLI importa el `src/lib/tokens.ts` **del repo
   del sitio** para tomar esa lista y validar el resultado con `buildTokensCss` antes de escribir. *Por qué:* es el
   precedente de US-14 (el esquema vive solo en la plantilla y cada cliente queda con el de su versión) y evita dos
   listas que se desfasen. *Descartado:* copiar las 28 rutas y los formatos en el CLI (se desfasan cuando el contrato
   crezca, ADR-0040 punto 3). *Costo:* el CLI ejecuta un módulo del repo del sitio; ese repo es de Harvi, lo creó
   `specmate new`, y es lo mismo que hará US-19 con el validador del brief.
2. **Rutas con punto.** Un token del contrato y una ruta del archivo del cliente se escriben con puntos
   (`color.light.bg`, `brand.colors.background`). Una clave del cliente que contiene un punto no se puede mapear y se
   lista como problema. DTCG ya prohíbe el punto en los nombres.
3. **Detección del formato:** es DTCG si algún objeto del archivo tiene `$value`. Si es DTCG y tiene las 28 rutas, el
   mapeo es la identidad y queda propuesto; si es DTCG con otros nombres o formato propio, se propone solo lo que
   coincide exacto (FR-003). En los dos casos hace falta `--confirm` una vez (FR-004).
4. **Conversión de valores**:
   - DTCG `color` → `#rrggbb` desde `components` en `srgb` (con `hex` como respaldo si coincide); otro `colorSpace`,
     un componente `"none"` o `alpha` < 1 → problema (el contrato es opaco).
   - DTCG `dimension` `{value, unit}` → `"<value><unit>"` (`px` o `rem`, lo único que admite DTCG).
   - DTCG `fontFamily` → la lista unida con `, `, con comillas en los nombres con espacios.
   - DTCG `number` → número (interlineado).
   - Formato propio: el valor tiene que cumplir ya el formato del contrato; `#RGB` y mayúsculas se normalizan a
     `#rrggbb`. Todo lo demás → problema con token, valor y motivo (FR-006).
5. **Lectura de DTCG**: `$type` heredado del grupo; referencias `{a.b}` resueltas con detección de ciclos y profundidad
   máxima 32; `$ref` y `$extends` → "no soportado" (fuera de alcance por la spec, aunque DTCG pide soportar `$ref`).
6. **Contraste** (FR-007): luminancia relativa de WCAG 2.2, contraste redondeado a 2 decimales **solo para mostrar**
   (se compara sin redondear: `#777777` sobre blanco da 4.478 y falla). Parejas, en claro y en oscuro: `text`/`bg`,
   `text`/`surface`, `text-muted`/`bg`, `text-muted`/`surface`, `on-accent`/`accent` (4.5:1) y `focus`/`bg`,
   `focus`/`surface` (3:1). Son las combinaciones que usa la plantilla hoy.
7. **Topes del archivo** (FR-010): 1 MB, 32 niveles de anidamiento y 10 000 tokens; se lee con `O_NOFOLLOW` por el
   mismo puerto que usa el inventario, dentro de la carpeta del cliente.
8. **Retomar** (FR-009): el mapeo guardado gana sobre el propuesto, token por token; si cambió el hash del archivo, la
   confirmación se pierde y la salida lo dice. La escritura de `src/data/tokens.json` es atómica y lleva un `$comment`
   que dice de qué archivo salió.
9. **El inventario reconoce `.tokens`**, la extensión que recomienda DTCG, además de `*.tokens.json` y `tokens*.json`:
   un cambio de una línea en la clasificación de US-15, con su test.

## `steps.tokens` en `relevamiento.json`

```json
{
  "source": { "path": "marca/brand.tokens.json", "sha256": "…" },
  "format": "dtcg",
  "mapping": { "color.light.bg": "color.light.bg", "font.family": null },
  "confirmed": false,
  "missing": ["font.family"],
  "problems": [{ "token": "color.dark.accent", "value": "…", "reason": "colorSpace display-p3 is not supported" }],
  "contrast": [{ "mode": "light", "pair": ["text", "bg"], "colors": ["#777777", "#ffffff"], "ratio": 4.48, "min": 4.5, "ok": false }],
  "written": false
}
```

`mapping` tiene siempre las 28 rutas, en el orden del contrato; `null` = sin mapear. El operador edita `mapping` y
corre con `--confirm`. Todo lo demás lo recalcula cada corrida. Un `steps.tokens` con otra forma falla nombrando el campo,
como `steps.inventory`.

## Estructura (`packages/cli/`, salvo la última fila)

| Archivo | Cambio |
|---|---|
| `src/domain/design-tokens.ts` | Detectar formato, aplanar DTCG (herencia de tipo, referencias, ciclos, topes) y formato propio, convertir valores, proponer y fusionar el mapeo, faltantes y problemas |
| `src/domain/contrast.ts` | Luminancia, contraste y las parejas de la decisión 6 |
| `src/domain/inventory.ts` | `.tokens` como clase `tokens` (decisión 9) |
| `src/application/apply-client-tokens.ts` | Caso de uso: elegir el archivo, leerlo, traducir, verificar, guardar el paso y escribir |
| `src/application/ports.ts` | `ClientFolder.readFile` (con tope); `RelevamientoStore` pasa a leer y escribir un paso por nombre; `SiteTokens` (contrato, validar, escribir) |
| `src/infrastructure/node-site-tokens.ts` (nuevo), `node-client-folder.ts`, `node-relevamiento-store.ts` | Adaptadores |
| `src/cli/main.ts`, `index.ts` | Comando `tokens`, opciones, ayuda y salida |
| `AGENTS.md` (CLI) | Fila de `tokens` e invariante |
| `templates/site/src/lib/tokens.ts` y su test | Export de `TOKEN_PATHS` |

## Orden test-first y unidades

| # | Unidad | Rojo primero | Cubre |
|---|---|---|---|
| U1 | Contraste | Tabla de parejas con valores conocidos; `#777777`/`#ffffff` = 4.48 y falla | FR-007 · AC-6 |
| U2 | Lectura y conversión | DTCG completo con una referencia; tipo heredado; otro espacio de color; unidad no admitida; alfa; ciclo; topes; `$ref`; formato propio | FR-002, FR-006, FR-010 · AC-1, AC-2, AC-7 |
| U3 | Mapeo | Propuesta solo exacta; fusión con el guardado; cambio de hash pierde la confirmación; faltantes | FR-003 a FR-005, FR-009 · AC-3, AC-5 |
| U4 | Contrato del sitio | `TOKEN_PATHS` en la plantilla; el CLI lo importa del sitio y valida con `buildTokensCss` | FR-008 · AC-1 |
| U5 | Comando de punta a punta | Sin inventario; varios archivos; DTCG confirmado escribe; formato propio sin confirmar no escribe; resto del JSON intacto; `.tokens` en el inventario | FR-001, FR-004, FR-008 · AC-1, AC-3, AC-4, AC-5 |

**Quién escribe:** el lead, inline: es una cadena acoplada (dominio → caso de uso → comando) sin motivo para delegar.
Después, **`security`** (nivel máximo) como verificador independiente y la suite entera una vez.

## Riesgos abiertos

- **Ejecutar un módulo del repo del sitio** (decisión 1): si alguien edita `src/lib/tokens.ts` de un sitio, el CLI
  corre ese código. Se acepta igual que en US-19: el repo es de Harvi. La revisión `security` lo mira.
- **`$ref` sin soporte**: un archivo exportado con `$ref` falla nombrándolo; si aparece en clientes reales, se suma.
