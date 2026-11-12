# ADR-0036 — `set:html` permitido en un solo componente: el del JSON-LD

- **Estado:** Aceptada (2026-11-12, Andy: "sí, aceptada")
- **Fecha:** 2026-11-12
- **Reemplaza:** ADR-0030 en parte (control *Sin inyección*, punto 1: "`set:html` prohibido en el código fuente")
- **Afecta a:** `templates/site` (US-11), control `no-set-html`, zona crítica de la plantilla

## Contexto

ADR-0035 permite un bloque JSON-LD inline por página, generado por un serializador que
escapa. El spike T0 de US-11 (2026-11-12, Astro 7.4.11) mostró que Astro **no evalúa**
una expresión dentro de `<script type="application/ld+json">{json}</script>`: la emite
como texto literal. La única forma de que el JSON llegue al HTML es `set:html`, que
ADR-0030 prohíbe. El mismo spike mostró el riesgo: `set:html` copia el texto tal cual,
así que un `</script>` en un dato del cliente rompe el bloque si nadie lo escapó antes.

## Decisión

- `set:html` sigue prohibido en todo el código de la plantilla **salvo en un único
  archivo**: `src/components/JsonLd.astro`.
- En ese archivo, `set:html` recibe **solo** la salida del serializador `jsonld.ts`, que
  escapa `<`, `>` y `&` como `<`, `>` y `&`. No recibe props de texto
  libre ni ningún otro valor.
- El control `no-set-html` pasa a ser una lista blanca de un archivo: falla si
  `set:html` aparece en cualquier otro archivo, o en ese mismo archivo con otra
  expresión.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Inyectar el JSON-LD después del build (una integración que reescribe el HTML de `dist/`) | Más código propio en la zona crítica, y saca el bloque del componente que se testea. El riesgo de escape es el mismo |
| Microdata en vez de JSON-LD | Ya descartado en ADR-0035: acopla el SEO a cada sección de la biblioteca |
| Una excepción general para `set:html` "cuando se escapa" | Una regla que depende de que alguien se acuerde de escapar no es un control |

## Consecuencias

**Positivas:** el JSON-LD llega al HTML con un camino único, chico y testeable.

**Negativas (costo asumido):** la regla "cero `set:html`" pasa a tener una excepción
en la zona crítica. Si el serializador deja de escapar, el bloque es una vía de
inyección. La CSP (`script-src 'none'`) igual impediría ejecutar un script inyectado,
pero no un HTML roto.

**Cómo se impone:**
- `no-set-html.test`: lista blanca de un archivo y una expresión.
- `jsonld.test`: casos adversos (`</script>`, `<!--`, `&`, comillas) que tienen que
  volver intactos con `JSON.parse` y sin `<` crudo dentro del bloque.
- Control sobre `dist/` (ADR-0035): un bloque por página que parsea como JSON y no
  contiene `<`.
- Revisión `security` de US-11.

**Revisar cuando:** Astro permita expresiones dentro de `<script type="application/ld+json">`,
o cambie de versión mayor.
