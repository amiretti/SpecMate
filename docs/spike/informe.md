# Informe del spike (E0)

Una sección por incógnita de `docs/mvp.md`, con las horas medidas y los cambios que
piden a las ADR. Ningún dato de un cliente real: los clientes se nombran de forma
genérica.

## Incógnita 1 · ¿Sale un sitio publicable con el flujo hecho a mano, y en cuántas horas?

Historia: US-06 (#29) · cliente: un servicio online de invitaciones de cumpleaños en video,
emprendimiento del propio developer (con su consentimiento) · sitio: repo propio del
cliente creado con `specmate new`, fuera de este repo; la URL pública vive en la carpeta
del cliente (AC-5).

**Veredicto: sí, en ~1 h 20 min de trabajo con agente.** One page publicada en Cloudflare
Workers (`workers.dev`, sin dominio propio), con los 7 controles de ADR-0030 en verde y
Lighthouse 100 · 100 · 100 · 100. El developer la aceptó después de un rediseño: la
primera versión pasaba todo pero "parece de los 90".

### Horas por etapa (2026-11-19)

| Etapa | Tiempo | Qué llevó |
|---|---|---|
| Ingesta | ~15 min | Leer la carpeta y pedir dos archivos que las notas nombraban y no estaban |
| Brief | ~5 min | Sin brief formal: una pregunta por email, horario y dominio |
| Diseño y construcción | ~15 min | Datos, secciones propias, tokens, fuentes, logo claro/oscuro, imagen OG |
| Verificación | ~5 min | 7 controles; dos fallos (h1 con imagen) corregidos en el momento |
| Publicación | ~20 min | Casi todo en el login de wrangler y en publicar dos veces |
| Rediseño | ~20 min | CSS nuevo completo tras el feedback del developer |

Tiempo del developer: el que llevó contestar 6 preguntas, iniciar sesión en Cloudflare y
revisar el resultado.

### Fricciones, ordenadas por tiempo perdido

1. **El estilo base de la plantilla no vende** (~20 min, rediseño entero). Pasa todos los
   controles pero no causa efecto: header no fijo, links subrayados, footer pobre, sin
   movimiento. Issue #61 (E4).
2. **Publicación** (~15 min). Wrangler no está en el lockfile del sitio (npx, y la
   primera descarga cortó por la red); el login OAuth venció a los 120 s; la URL real se
   conoce recién después del primer deploy, así que hay que publicar dos veces;
   `wrangler.jsonc` heredó el nombre de Worker de la plantilla.
3. **Tokens de marca** (~10 min). El cliente trajo su `tokens.json` con otro formato
   (temas propios, nombres propios, dos familias, `px`, sin color de foco). Hubo que
   traducirlo a mano y abrir el esquema de la plantilla: segunda familia tipográfica,
   seis colores más y un tamaño `hero`.
4. **El esquema de datos no cubre una one page de servicio** (~10 min). No hay lugar
   para "cómo funciona", "qué incluye" ni texto libre: fueron a un módulo aparte, fuera
   de la validación. Y exige email, un horario y un dominio `https` que un negocio que
   solo atiende por WhatsApp puede no tener.
5. **La plantilla no contempla un logo** (~5 min). Con el logo como `h1` fallaron
   `check:behavior` y `check:html`; en modo oscuro hace falta la versión negativa.
6. **Menores.** La carpeta trajo un README de otro repo en lugar de notas; los términos
   y la privacidad estaban en borrador con revisión legal pendiente (se dejaron fuera);
   la CSP bloquea `data:` en CSS; el minificador convierte `animation` sin nombre en
   `none`; `!` de Claude Code corre bash y rompe las rutas de Windows.

### Cambios que pide

- **E2 (#20), brief:** aceptar el `tokens.json` del cliente o traducirlo automáticamente;
  email, horario y dominio opcionales, con WhatsApp como contacto suficiente; secciones de
  contenido libre con fuente; carpeta de clientes configurable (#60).
- **E4 (#22), biblioteca de secciones:** estilo base moderno (#61), logo en el header y
  en el héroe con versión clara y oscura, y un héroe con movimiento solo en CSS.
- **E5 (#23), publicación:** wrangler fijado en el lockfile, nombre del Worker desde el
  slug del cliente, y conocer la URL antes del primer deploy (o un deploy en dos pasos
  automático).
- **Sin cambios a ADR-0030:** el rediseño entró sin JavaScript, sin dependencias nuevas
  y sin tocar la CSP.

## Incógnita 2 · ¿La API de Places sirve para pre-llenar, dentro de sus términos y a costo razonable?

Historia: US-07 (#30). **Sin medir: descartada por el developer el 2026-11-19, fuera del
MVP.** El brief se llena con la carpeta del cliente y su confirmación; la dirección y, si
se quiere, las coordenadas o el link de Maps se cargan a mano. Ver "Decisiones del
developer" más abajo.

## Incógnita 3 · ¿Tres opciones completas y combinables son vendibles?

Historia: US-08 (#31) · mismo cliente que la incógnita 1 · todo en el repo del cliente,
fuera de este repo; las URLs de prueba viven en la carpeta del cliente (AC-5 de US-06).

**Veredicto: sí.** Tres sitios completos, distintos en paleta, tipografía y composición,
cada uno publicado en su URL de prueba con los 7 controles de ADR-0030 en verde y
Lighthouse 100 · 100 · 100 · 100. El cliente pidió un mix y salió en **48 segundos, sin
modelo**, recombinando una variante ya hecha.

### Cómo se armó

El sitio se partió en los ejes de ADR-0032: una opción es un archivo que nombra una
paleta (`src/axes/palettes/<id>.json`), una tipografía (`src/axes/type/<id>.json`), un
header, un footer y una lista ordenada de secciones, cada una una variante
(`src/sections/<tipo>/<Variante>.astro`, encontrada por glob). El contenido es el mismo
para las tres. Cada variante se estiliza solo con los tokens, así que al cambiar de
opción hereda paleta y tipografía.

| Opción | Concepto (sale del material del cliente) | Paleta y tipografía |
|---|---|---|
| A | El producto reproduciéndose en un celular | Crema y uva; el par del manual de marca |
| B | Una noche de estreno de cine ("mini estreno" en sus notas) | Tinta y limón, oscura; display grotesca + cuerpo del manual |
| C | La tarjetita de cumpleaños de papel (su frase de entrada) | Lavanda y mandarina; display redondeada + cuerpo del manual |

### Mediciones (2026-11-19)

| Paso | Quién | Tiempo | Tokens |
|---|---|---|---|
| Partir el sitio en ejes; A = el sitio de la incógnita 1 | Lead, inline | ~25 min | sin medir (contexto del lead) |
| Opción B | Agente frontend (estándar) | 5,0 min | 119k |
| Opción C, en paralelo con B | Agente frontend (estándar) | 5,2 min | 107k |
| Verificación de las tres y publicación | Lead | ~5 min | — |
| **Mix pedido por el cliente** | Archivo de opción de 12 líneas | **48 s** (build + 7 controles) | 0 |

Hasta las tres opciones: ~35 min de reloj y ~226k tokens de agentes. Con una biblioteca
de secciones ya hecha, el refactor desaparece y cada opción nueva cuesta solo componer.

### Lo que eligió el cliente (AC-2)

"Me quedo con la A, pero con el ¿Cómo funciona? de la C". Un mix de una sección: la
variante de pasos de C con la paleta y la tipografía de A. Publicado como `v2`. El motivo
no quedó registrado.

### Cambios que pide

- **ADR-0033, tope de tokens:** un dato para fijarlo. Una opción completa cuesta
  ~110k tokens de un agente estándar cuando las secciones se escriben desde cero; con
  biblioteca debería bajar mucho. Lo fija US-10 (#33).
- **E3 (#21) y E4 (#22):** la estructura de ejes y variantes de este spike es un buen
  punto de partida para la biblioteca: el mix funcionó sin tocar código porque cada
  variante se estiliza solo con tokens. Hace falta un contrato de tokens común (en el
  spike, `pop` y `on-pop` cambiaron de significado entre opciones y aun así combinaron
  bien porque siempre se usan en pareja).
- **E5 (#23):** las URLs de prueba de las opciones deberían salir con `noindex`; hoy
  apuntan su canonical al sitio principal.

## Incógnita 4 · ¿Astro con CSP estricta pasa los controles de ADR-0030?

Historia: US-09 (#32) · documento: `specs/001-plantilla-csp-estricta/feature.md` ·
plantilla: `templates/site` (commit `b1b7665`).

**Veredicto: sí.** Publicado en https://specmate-spike-plantilla.cuervo-dev.workers.dev
(Workers con assets estáticos, `wrangler.jsonc`, wrangler 4.161.0), con los headers
servidos tal como están en `_headers` (verificados con `curl -sI` en esta URL).

### Mediciones (2026-11-12, `dist/` servido en local, sin `_headers`)

| Control de ADR-0030 | Resultado | Umbral | |
|---|---|---|---|
| Lighthouse móvil, mediana de 3 | rendimiento 100 · accesibilidad 100 · buenas prácticas 100 · SEO 100 | ≥ 90 · ≥ 95 | ✅ |
| axe-core, 360/768/1280 px | 0 violaciones | 0 serious/critical | ✅ |
| Consola y pedidos fallidos | 0 | 0 | ✅ |
| Sin inyección (inline en `dist/`, `set:html`) | 0 apariciones · test de 101 casos | 0 | ✅ |
| Headers (test sobre `_headers`) | CSP sin `unsafe-*`, `script-src 'none'`, HSTS, nosniff, Referrer, Permissions, COOP | ADR-0030 | ✅ |
| html-validate 11 | 0 errores (tras corregir `tel-non-breaking`) | 0 | ✅ |
| linkinator | 0 rotos | 0 internos | ✅ |
| `npm audit --audit-level=high` | 0 | 0 | ✅ |
| secretlint 13 | 0 | 0 | ✅ |
| Imágenes | máx. 27,5 KB · `alt` 1/1 | ≤ 250 KB · 0 sin `alt` | ✅ |
| Sin relleno | 0 | 0 | ✅ |
| `astro check` · Biome | 0 · 0 | 0 errores | ✅ |
| Headers servidos (`curl -sI`) | `/`, un asset de `/_astro/` y el 404 llevan CSP; `/` lleva HSTS, nosniff, Referrer, Permissions y COOP | ADR-0030 | ✅ |
| 404 real | `/noexiste` → 404 (`not_found_handling: none`) | sin soft-404 | ✅ |
| Script inyectado por Cloudflare en lo servido | 0 (`<script`, `cdn-cgi`, `email-protection`) | 0 | ✅ |

### Cambios que pide a ADR-0030 y a la constitución

1. **Licencias:** Fontsource (Inter) es OFL-1.1 y va en `dist/`. Las dependencias de
   compilación traen MPL-2.0 (lightningcss), LGPL-3.0 (libvips de sharp), BlueOak-1.0.0
   y CC0-1.0. Ninguna está en la lista de la constitución: hace falta una excepción
   explícita.
2. **Cloudflare:** en `workers.dev` no se inyecta nada. Con dominio propio, apagar la
   "Email Obfuscation" de la zona, porque inyecta un script en los `mailto:` y la CSP
   lo bloquea.
3. **JSON-LD:** `_headers` no admite nonces. El `LocalBusiness` en JSON-LD no puede ir
   inline: archivo externo o se descarta. Hoy ADR-0030 lo pide sin decir cómo.
4. **Hosting:** ADR-0030 deja "Workers o Pages". Conviene fijar Workers con
   `not_found_handling: "none"` (o `404-page` con un `404.html`), porque Pages sin
   `404.html` devuelve `index.html` con 200 en cualquier ruta.
5. **Controles para E5:** falta un test de orígenes externos contra la lista blanca y la
   prohibición de `<meta http-equiv="refresh">`.
6. **A decidir:** HSTS con `includeSubDomains` puede romper otros subdominios del
   cliente; falta CORP.
7. **Versiones:** `@astrojs/check` 0.9.12 obliga a TypeScript 6 (no 7).

## Decisiones del developer que piden cambios a las ADR

- **2026-11-12 · Maps opcional y negocios sin dirección física.** "NO va a ser requisito
  excluyente que el negocio tenga maps o places", incluidos los negocios sin dirección
  física (solo online, a domicilio). Pide a US-10:
  - ADR-0030, fila *Mapa*: el botón "Cómo llegar" va solo si hay dirección confirmada.
  - ADR-0030, fila *SEO local*: sin dirección no hay `LocalBusiness` con `address`; definir
    el tipo de schema.org (por ejemplo `Organization` u `OnlineBusiness`, o
    `LocalBusiness` con `areaServed`).
  - ADR-0029 punto 4 y principio XI: sin cambio de fondo (Maps ya era solo pre-llenado),
    pero aclarar que su ausencia es un caso normal.
  - US-07 (Places) mide algo opcional: su veredicto pasa a ser "¿vale la pena cuando existe?".
- **2026-11-19 · Places fuera del MVP.** El developer descarta la integración con la API
  de Places: "va solo dirección y puede que vaya coordenadas de maps, o link, pero no la
  integración. Fuera del MVP". US-07 (#30) se cierra sin medir. Pide a US-10:
  - ADR-0029 punto 4 y ADR-0031: sacar el pre-llenado desde Places del MVP; el brief se
    llena con la carpeta y la confirmación del cliente (la rama "si la respuesta es no"
    de la incógnita 2 en `docs/mvp.md`).
  - Esquema del brief (E2): dirección opcional, más coordenadas o link de Maps
    opcionales cargados a mano, con fuente y confirmación como cualquier dato (XI).

### Horas

Máquina: ~30 min de agentes (T1 + corrección, revisión de seguridad y medición).
Tokens de agentes: ~424k.
