---
id: US-11 (#39)
titulo: Generar una plantilla completa (tokens, SEO local, GEO y AEO) para que cada sitio salga completo
estado: aprobada          # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/39
analisis: no requerido
depende_de: [US-09 (#32)]
revisa: developer (Andy); revisión `security` obligatoria antes del PR
zona_critica: plantilla del sitio: CSP, `_headers`, escape de contenido (project-guard §5)
estimacion: ~330k tok · ~7-9 h de agente (más la espera de publicación para AC-11) · nivel máximo por zona crítica · actualizada tras el plan (spike de JSON-LD, Playwright, 3 variantes)
---

# Generar una plantilla completa (tokens, SEO local, GEO y AEO) para que cada sitio salga completo

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #39 (épica E1, #19) y pedido del developer: "no te olvides de GEO y AEO" | Seis AC: tokens, SEO local, GEO y AEO, supuestos de ADR-0035 probados, licencias, 101 tests de US-09 en verde |
| `ADR-0030` («Construcción», «Barandas») | Astro estático sin JS de cliente, estilos desde `tokens.json`, `build.inlineStylesheets: 'never'`, control *Sin inyección*, imágenes ≤ 250 KB con `alt` |
| `ADR-0035` («JSON-LD», «Negocios sin dirección», «Hosting y headers», «Cómo se impone») | JSON-LD inline solo con serializador que escapa; tipo de schema por caso; `404.html` con 404 real; HSTS; dos supuestos a probar; test de licencias |
| `.specify/memory/constitution.md` 2.2.0 (V, XI, XII, «Licencias permitidas») | Contenido externo es dato; nada se publica sin fuente ni confirmación; ejemplos inventados y marcados; listas de licencias |
| `templates/site/AGENTS.md` | Nada inline, `set:html` prohibido, todo el contenido sale del brief confirmado y escapado |
| `specs/001-plantilla-csp-estricta/feature.md` | Plantilla base y 101 tests de US-09 que no deben romperse |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** entrega sitios a negocios chicos y quiere que los
encuentren tanto en buscadores como en motores de respuesta con IA (ChatGPT, Perplexity,
Gemini, Google AI Overviews), **esto cambia** que cada sitio nuevo sale con todo lo que
esos motores necesitan para leer y citar al negocio, sin que nadie se acuerde de
agregarlo, y sin inventar un dato ni abrir la política de seguridad.

- **SC-001**: En el sitio de ejemplo y en sus 2 variantes (con zona de cobertura y solo online), cada página de contenido tiene exactamente 1 bloque JSON-LD que se parsea y reproduce los datos de entrada sin pérdida, y los navegadores de prueba (Chromium y Firefox) informan 0 violaciones de CSP.
- **SC-002**: 0 valores sueltos (color, tipografía, tamaño, espaciado, radio) en el CSS escrito a mano; 100 % de los estilos de marca salen de `tokens.json`.
- **SC-003**: 100 % de los datos del negocio (nombre, teléfono, correo, dirección si existe, horarios) coinciden entre el HTML visible, el JSON-LD y los metadatos en las 3 variantes.
- **SC-004**: 0 preguntas frecuentes, perfiles `sameAs` o datos de contacto sin fuente y confirmación llegan al HTML o al schema.
- **SC-005**: Los 101 tests de US-09 siguen corriendo y en verde, salvo los ajustes de controles que ADR-0035 ya ordena (ver §7), y cada AC de §5 tiene al menos 1 test propio.

## §3 Requisitos funcionales

Qué hace el sistema, no cómo (el cómo va en `plan.md`).

- **FR-001** (tokens): El sistema DEBE generar las custom properties del sitio desde un `tokens.json` (colores claro y oscuro, tipografía, escala de tamaños, espaciado, radio y ancho de contenido), y el CSS escrito a mano DEBE NO contener literales de color, familia tipográfica, tamaño de fuente, espaciado ni radio. Los puntos de corte de `@media` quedan exentos (no admiten variables). Un `tokens.json` con una categoría faltante o un valor inválido DEBE hacer fallar la construcción nombrando el token. (ADR-0030 «Estilos»; constitución VI)
- **FR-002** (JSON-LD seguro): El sistema DEBE producir todo el JSON-LD con un único serializador de la plantilla que parte de los datos confirmados y escapa `<`, `>` y `&`; escribir JSON-LD a mano DEBE quedar prohibido (detectable en el código fuente). Cada página de contenido DEBE llevar exactamente 1 `<script type="application/ld+json">` con ese `type` exacto, contenido que parsea como JSON y sin `<`; todo otro `<script>`, `<style>` o `on*=` en `dist/` sigue siendo 0. (ADR-0035 «JSON-LD»)
- **FR-003** (tipo de schema por caso): El sistema DEBE elegir el tipo de `schema.org` según los datos confirmados: con dirección pública, `LocalBusiness` (o el subtipo del rubro, si el dato existe) con `address`; con zona de atención y sin local, `LocalBusiness` con `areaServed` y sin `address`; solo online, `Organization` con `url` y `contactPoint`. DEBE NO emitir `address` sin dirección confirmada ni `aggregateRating`, `review` o `geo`. (ADR-0035 «Negocios sin dirección»; constitución XI)
- **FR-004** (datos consistentes, GEO): El sistema DEBE generar HTML visible, JSON-LD y metadatos desde la misma fuente de datos, de modo que nombre, teléfono, correo, dirección, horarios y URL tengan el mismo valor en los tres (los teléfonos se comparan por sus dígitos). Un dato ausente DEBE faltar en los tres.
- **FR-005** (cabecera por página): Cada página DEBE llevar `<title>` único, `meta description`, `canonical` absoluto y Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:image` absoluto con su texto alternativo). La imagen Open Graph DEBE cumplir el tope de imágenes (≤ 250 KB). La URL pública del sitio DEBE ser obligatoria: si falta, la construcción falla. (ADR-0030 «Imágenes»; constitución VI)
- **FR-006** (sitemap, robots y crawlers de IA): El sistema DEBE generar `sitemap.xml` con cada página de contenido (URL absoluta, sin la 404) y `robots.txt` que referencia ese sitemap y declara una política explícita, con un grupo propio, para cada crawler de IA de una lista única de la plantilla. La política por defecto frente a esos crawlers es **permitirlos a todos** (developer, 2026-11-12: "sí, por defecto permitimos"); el ajuste por sitio permite bloquearlos si el cliente lo pide. La política DEBE salir de un único ajuste por sitio y `robots.txt` DEBE NO listar rutas sensibles.
- **FR-007** (404 real): El sistema DEBE generar `404.html` con el mismo marco del sitio (cabecera, título y enlace al inicio) y sin datos del negocio inventados; una ruta inexistente publicada DEBE devolver estado 404 con ese contenido. (ADR-0035 «Hosting y headers»)
- **FR-008** (HTML que se lee sin CSS, AEO): Cada página DEBE tener los puntos de referencia `header`, `nav`, `main` y `footer`, un solo `h1`, niveles de encabezado sin saltos, la dirección en `<address>`, los horarios como lista de definición o tabla, y todos los datos del negocio como texto (nunca solo como imagen ni solo por CSS), en un orden de lectura que empieza por quién es el negocio y qué ofrece.
- **FR-009** (preguntas frecuentes, AEO): El sistema DEBE mostrar preguntas frecuentes solo si existen y cada una tiene fuente y confirmación del cliente; cada una como encabezado de pregunta seguido de su respuesta en texto plano, y emitir `FAQPage` con exactamente esas preguntas y respuestas. Sin ninguna confirmada, DEBE NO haber sección ni `FAQPage`. El sistema DEBE NO redactar, completar ni sugerir preguntas o respuestas. (constitución XI)
- **FR-010** (perfiles, GEO): El sistema DEBE emitir `sameAs` solo con URLs `https` de perfiles que el cliente confirmó; sin perfiles confirmados, DEBE NO emitirlo; una URL que no sea `https` DEBE hacer fallar la construcción.
- **FR-011**: eliminado (ver §4, `llms.txt`).
- **FR-012** (licencias): El sistema DEBE verificar el lockfile separando lo que se publica en `dist/` de lo que solo corre al construir, comparando cada licencia contra su lista de la constitución 2.2.0; una licencia fuera de lista, ausente o de un paquete sin clasificar DEBE hacer fallar el test. (ADR-0035 «Cómo se impone»)

**Entidades clave:**
- **Datos del negocio**: nombre, descripción, teléfono, correo, dirección (opcional), zonas de atención (opcional), horarios, perfiles (opcional), preguntas frecuentes (opcional); cada dato publicable con `fuente` y confirmación del cliente. El esquema real del brief es de E2; acá viven en el módulo de datos de ejemplo (§6).
- **Tokens**: valores de diseño del cliente, única fuente del CSS de marca.

## §4 Fuera de alcance

- Esquema del brief, validación Zod y `tokens.json` de un cliente real (E2, Gate 2): acá solo datos y tokens de ejemplo, inventados y marcados (constitución XII).
- Biblioteca de secciones y sitios de varias páginas (E4): la plantilla sigue con una página de contenido más la 404.
- Suite completa de controles (axe, Lighthouse CI, linkinator, html-validate) y sitio que falla a propósito (US-12, #40); `specmate verify` (E5): acá solo los tests de las reglas de esta historia.
- `specmate new` (US-13, #41) y `publish`.
- Reseñas, calificaciones, testimonios y `aggregateRating` (constitución XI); datos de Google Places o Maps como fuente (ADR-0035).
- Formularios con backend, widgets de terceros y analítica (ADR-0030).
- Medir si ChatGPT, Perplexity, Gemini o AI Overviews citan al negocio: ningún control del sitio lo garantiza ni lo mide.
- Redacción de contenido de preguntas frecuentes por IA o plantillas de texto "típicas" del rubro.
- `llms.txt` (developer, 2026-11-12: "afuera por ahora... después si suma lo agregamos"): no hay evidencia pública de que los motores lo usen. Se revisa si alguno lo confirma.

## §5 Historias y criterios de aceptación

### US1 — Un sitio completo para buscadores y motores de respuesta (Prioridad: P1)

El dueño de Harvi genera un sitio de cliente y sale con estilos desde tokens, SEO local,
datos legibles por motores generativos y de respuesta, y sin abrir la CSP. **Prueba
independiente:** construir la plantilla con el negocio de ejemplo y sus 2 variantes
(`areaServed` y solo online) y correr `npm test` en `templates/site`.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** un `tokens.json` de ejemplo **cuando** se construye **entonces** el CSS contiene una custom property por cada token y el CSS escrito a mano tiene 0 literales de color, tipografía, tamaño, espaciado o radio; **dado** un `tokens.json` con un token faltante o inválido **entonces** la construcción falla nombrándolo; cambiar un valor del JSON cambia el CSS generado | unit |
| AC-2 | **Dado** cada una de las 3 variantes (con dirección, con `areaServed` sin dirección, solo online) **cuando** se construye **entonces** el JSON-LD tiene el tipo, los campos presentes y los campos ausentes que fija FR-003 (tabla con una fila por caso) y 0 apariciones de `aggregateRating`, `review` y `geo` | integración |
| AC-3 | **Dado** datos con `</script>`, `<script>alert(1)</script>`, `<!--` y `&` en nombre, descripción y respuesta de una pregunta **cuando** se construye **entonces** `dist/` tiene exactamente 1 bloque `application/ld+json` por página de contenido, 0 `<` dentro de él, parsea como JSON y su contenido iguala los datos de entrada sin pérdida; **y** fixtures con 2 bloques, otro `type` o un `<script>` extra hacen fallar el control *Sin inyección*; **y** `application/ld+json` aparece en 1 solo archivo del código fuente | integración |
| AC-4 | **Dado** una variante con un teléfono, un horario y un nombre distintos **cuando** se construye **entonces** el valor nuevo está en HTML visible, JSON-LD y metadatos, y el valor anterior aparece 0 veces; **dado** un dato ausente **entonces** falta en los tres | integración |
| AC-5 | **Dado** cada página **cuando** se construye **entonces** tiene `<title>` único, `meta description`, `canonical` absoluto, `og:title`, `og:description`, `og:type`, `og:url`, `og:image` absoluto con alt, la imagen ≤ 250 KB, y sin URL pública del sitio la construcción falla | integración |
| AC-6 | **Dado** el sitio construido **cuando** se leen `sitemap.xml`, `robots.txt` y `404.html` **entonces** el sitemap lista 100 % de las páginas de contenido con URL absoluta y 0 veces la 404; `robots.txt` apunta a ese sitemap con URL absoluta; `404.html` existe con el marco del sitio y 0 bloques JSON-LD | integración |
| AC-7 | **Dado** la lista de crawlers de IA de la plantilla (al menos 5) **cuando** se construye con cada valor posible del ajuste de política **entonces** `robots.txt` tiene un grupo explícito por cada crawler de la lista, todos con la acción que fija el ajuste, y cambiar el ajuste cambia solo esos grupos | integración |
| AC-8 | **Dado** cada página **cuando** se analiza solo su HTML, sin CSS **entonces** tiene `header`, `nav`, `main`, `footer`, 1 solo `h1`, 0 saltos de nivel de encabezado, la dirección en `<address>` (si existe), los horarios en lista de definición o tabla, y nombre, teléfono, correo, dirección y horarios como texto visible en el orden de lectura definido en FR-008 | integración |
| AC-9 | **Dado** 3 preguntas, una de ellas sin confirmar **cuando** se construye **entonces** el HTML y el `FAQPage` muestran exactamente las 2 confirmadas, con texto idéntico; **dado** 0 confirmadas **entonces** 0 sección y 0 `FAQPage`; el código de la plantilla no contiene texto de preguntas o respuestas fuera de los datos | integración |
| AC-10 | **Dado** perfiles confirmados y uno sin confirmar **cuando** se construye **entonces** `sameAs` lista solo los confirmados, todos `https`; sin perfiles no hay `sameAs`; una URL no `https` falla la construcción | integración |
| AC-11 | **Dado** el sitio con JSON-LD **cuando** se abre en Chromium y en Firefox **entonces** 0 violaciones de CSP en consola; **y** tras publicarlo (con luz verde del developer), el Rich Results Test sobre la URL publicada no informa errores para el tipo de schema de la página (salida pegada) | e2e (CSP) · manual (Rich Results: queda pendiente hasta pegar la salida) |
| AC-12 | **Dado** el lockfile **cuando** corre el test **entonces** todo paquete de lo publicado cumple la lista de lo publicado y todo el resto la de lo que solo construye (por separado); **y** fixtures con una licencia GPL, una ausente y un paquete sin clasificar, en cada grupo, lo hacen fallar | unit |

**Casos borde** (cada uno con su AC):
- Dato con `</script>` o `<!--` (AC-3).
- Negocio sin dirección y sin `areaServed` ni sitio: solo online (AC-2).
- Cero preguntas o perfiles confirmados: la sección y la propiedad no existen (AC-9, AC-10).
- Teléfono con espacios y guiones no rompe la comparación de consistencia (AC-4).
- Lista de crawlers con un agente repetido o vacío: falla la construcción (AC-7).

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| El `tokens.json` de ejemplo tiene las mismas categorías que el `tokens.css` de US-09 | El Gate 2 (E2) aún no define la forma real del archivo | El esquema de tokens y su validación (FR-001, AC-1) |
| Datos, preguntas, perfiles, zonas y URL del sitio viven en el módulo de datos de ejemplo, con campos de fuente y confirmación | El esquema del brief es de E2; sin él no hay otra fuente | El mapeo del brief a la plantilla cuando E2 lo defina |
| Una variante con dirección y `areaServed` confirmados emite ambos | ADR-0035 no cubre ese caso mixto | Se elimina `areaServed` del caso con dirección (AC-2) |
| La 404 no lleva JSON-LD y la plantilla sigue con 1 página de contenido | ADR-0035 dice "un bloque por página" sin tratar la 404 | La regla de FR-002 y AC-6 |
| La URL del ejemplo usa un dominio reservado ficticio | `canonical`, Open Graph y sitemap exigen URL absoluta y el negocio es inventado (XII) | El valor del ejemplo, no las reglas |

## §7 Riesgos y decisiones abiertas

- ~~Aclaración 1 (FR-006)~~ resuelta (2026-11-12): permitir por defecto todos los crawlers de IA, con ajuste por sitio para bloquearlos.
- ~~Aclaración 2 (FR-011)~~ resuelta (2026-11-12): sin `llms.txt` en el MVP; pasa a §4.
- **Contradicciones con la base de código y los AC** (reportadas; no arbitradas; las resuelve `architect`/lead):

| Contradicción | Fuente A dice | Fuente B dice | Propuesta | Por qué |
|---|---|---|---|---|
| HSTS | `ADR-0035`: sin `includeSubDomains` por defecto | `templates/site/public/_headers` (US-09) lo lleva | Alinear en esta historia | Es el mismo archivo y ADR-0035 asigna su test a E1; sin dueño queda sin hacer |
| 404 publicada | `ADR-0035`: `404.html` y `not_found_handling` `"none"` o `"404-page"` | `wrangler.jsonc` usa `"none"` | Que el plan decida `"404-page"` si `"none"` no sirve `404.html` | FR-007 exige 404 con ese contenido |
| 101 tests intactos | Ticket AC-6: siguen en verde | `ADR-0035`: *Sin inyección* acepta 1 bloque JSON-LD, así que `no-inline-code` debe cambiar | Se ajusta solo ese control, sin perder sus casos adversos actuales | Si no, JSON-LD y el test se contradicen |
| Clasificación de licencias | `ADR-0035`: separa `dependencies` de `devDependencies` | `package.json` pone `astro` y `sharp` en `dependencies`; libvips (LGPL-3.0) fallaría | `architect` define qué paquetes son "lo publicado" | FR-012 no se puede implementar sin esa clasificación |

- **Hueco: ¿dónde vive Playwright?** AC-11 necesita Chromium y Firefox y la plantilla aún no los tiene; US-12 (#40) arma la suite. Propuesta: US-11 agrega solo lo mínimo para AC-11 y US-12 lo extiende. Decide el lead.
- **Afirmaciones de Google sin fuente en el repo** (verificar en el plan antes de fijar AC-7 y AC-11): que Google limita los resultados enriquecidos de FAQ a ciertos sitios, y que Google-Extended no gobierna AI Overviews. Si es así, `FAQPage` vale para motores de respuesta pero no da resultado enriquecido, y bloquear crawlers no saca al sitio de AI Overviews.
- **Publicación para AC-11**: reusar el Worker del spike (`specmate-spike-plantilla.cuervo-dev.workers.dev`) requiere la autorización explícita del developer en ese momento.
