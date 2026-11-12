# Modelo de datos: US-11

No hay almacenamiento: son los archivos de datos del sitio. Existe este documento porque U2 y U3 (en paralelo) comparten la forma. El esquema real del brief es de E2; acá es el del módulo de ejemplo (spec §6). Todo dato de ejemplo es **inventado y marcado como tal** (constitución XII).

## Datos del negocio (`src/data/examples/*.ts`, alias `@data`)

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `site.url` | URL `https` absoluta | sí | dominio reservado ficticio; si falta o no es https, falla la construcción (FR-005) |
| `site.aiCrawlers` | `'allow' \| 'block'` | sí (default `allow`) | único ajuste de FR-006 |
| `name`, `tagline`, `about` | texto | sí | `tagline` alimenta `meta description` y `og:description` |
| `phone` | `{display, e164}` | sí | consistencia por dígitos |
| `email` | texto | sí | |
| `hours[]` | `{label, days[], opens?, closes?}` | sí | sin `opens`/`closes` = “Cerrado”; el texto visible y el JSON-LD (`HH:MM`) salen del mismo par |
| `address` | `{street, locality, region?, postalCode?, country}` | no | habilita `<address>`, `address` y “Cómo llegar” |
| `areaServed[]` | texto | no | zona sin local |
| `profiles[]` | `{url, source, confirmed}` | no | solo `confirmed` y `https` (FR-010) |
| `faq[]` | `{question, answer, source, confirmed}` | no | solo `confirmed` (FR-009); el código no contiene texto de preguntas |
| `image` | `{alt}` + archivo de `src/assets` | sí | base de `og:image`; ≤ 250 KB |

Campos publicables (`address`, `hours`, `profiles`, `faq`, `phone`, `email`) con `source` y `confirmed`; los validadores de `src/lib/site.ts` lanzan nombrando el campo.

## Variantes de ejemplo y tipo de schema (AC-2)

| Variante | Datos | Tipo | Presentes | Ausentes siempre |
|---|---|---|---|---|
| `address` | con `address` | `LocalBusiness` | `address`, `openingHoursSpecification`, `telephone`, `email`, `url` | `aggregateRating`, `review`, `geo` |
| `area` | `areaServed`, sin `address` | `LocalBusiness` | `areaServed` | `address`, `aggregateRating`, `review`, `geo` |
| `online` | sin `address` ni `areaServed` | `Organization` | `url`, `contactPoint` | `address`, `areaServed`, `aggregateRating`, `review`, `geo` |

Caso mixto (dirección y `areaServed`): se emiten ambos (supuesto de spec §6). `FAQPage` y `sameAs` solo con datos confirmados.

## Tokens (`src/data/tokens.json`)

Categorías obligatorias (las del `tokens.css` de US-09): `color.light` y `color.dark` (`bg`, `surface`, `text`, `text-muted`, `accent`, `on-accent`, `focus`), `font.family`, `font.size` (`base`, `small`, `h1`, `h2`), `font.lineHeight`, `space` (`1` a `5`), `radius`, `contentWidth`, `focusWidth`. Colores `#rrggbb`; medidas con unidad o `clamp()`. Cada token se vuelve una custom property en `dist/tokens.css`; falta o valor inválido lanza con la ruta del token.

## Salidas

`dist/index.html` (1 bloque JSON-LD) · `dist/404.html` (sin JSON-LD) · `dist/sitemap.xml` · `dist/robots.txt` · `dist/tokens.css`. Metadatos por página: `title`, `description`, `canonical`, `og:*`. El nombre y la URL viajan en los tres canales; teléfono, correo, dirección y horarios, en HTML y JSON-LD (los metadatos no los llevan por diseño: ver reporte).
