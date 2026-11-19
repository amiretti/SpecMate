# ADR-0040 — Ajustes tras el spike: Places fuera del MVP, topes de tokens por sitio, opciones por ejes y publicación

- **Estado:** Aceptada (2026-11-19, Andy: "sí, acepto. Solo aclara qué es tokens.json, porque no se si es estandar")
- **Fecha:** 2026-11-19
- **Reemplaza:** ADR-0029 en parte (punto 4: el pre-llenado desde Places) · completa ADR-0033 (punto 4: fija los topes por sitio y por pedido)
- **Afecta a:** esquema del brief y relevamiento (E2), opciones y biblioteca de secciones (E3, E4), publicación (E5), `templates/site`, `specmate new`

## Contexto

El spike cerró sus cuatro incógnitas (`docs/spike/informe.md`). La 1 y la 3 se midieron
con un cliente real: un sitio publicable sale en ~1 h 20 min, tres opciones completas en
~35 min con ~226k tokens de agentes, y un mix en 48 s sin modelo. La 2 (Places) la
descartó el developer: "va solo dirección y puede que vaya coordenadas de maps, o link,
pero no la integración. Fuera del MVP". La 4 ya se tradujo en ADR-0035. ADR-0033 dejó el
tope de tokens por sitio pendiente de esta medición. Quedan cinco decisiones que el
código de E2 a E5 está por inventar.

## Decisión

### 1. Places fuera del MVP
- El producto **no llama a la API de Places**. El brief se llena con la carpeta del
  cliente y su confirmación (ADR-0031).
- La dirección es opcional. Las **coordenadas o el link de Maps** también, cargados a
  mano, con fuente y confirmación como cualquier dato publicable (principio XI). El
  botón "Cómo llegar" usa ese link o la dirección (ADR-0035).
- La integración con Places vuelve como épica post-MVP si un cliente la justifica.

### 2. Topes de tokens por sitio (completa ADR-0033 punto 4)
Medido: una opción escrita desde cero costó ~110k tokens de un agente `estándar`.

| Qué | Tope | Al cruzarlo |
|---|---|---|
| Un sitio hasta sus tres opciones verificadas | **450k** tokens de agentes | Se corta y se avisa con lo que hay |
| Un mix | **0**: no llama al modelo | Si necesita el modelo, no es un mix: es un ajuste u opción nueva |
| Un ajuste | **60k** | Ídem |
| Una opción nueva | **150k** | Ídem |

Los topes cuentan los tokens de los agentes que trabajan en el sitio, no el contexto del
operador. Se revisan cuando exista la biblioteca de secciones (E4), que debería bajarlos.

### 3. Una opción es un archivo que nombra ejes (concreta ADR-0032 punto 3)
- Una opción es un módulo que nombra una **paleta**, una **tipografía**, un **header**, un
  **footer** y una **lista ordenada de secciones**, cada una una variante.
- Una variante de sección es un componente `src/sections/<tipo>/<Variante>.astro` que se
  descubre por su ruta: sumar una variante no toca un registro. Una opción que nombra una
  variante inexistente rompe el build.
- **Una variante se estiliza solo con tokens** (`--color-*`, `--font-*`, `--space-*`,
  `--radius`) y con estilos acotados a ella. Por eso un mix hereda paleta y tipografía sin
  tocar código.
- El esquema de tokens de la plantilla es el **contrato común** de la biblioteca: se le
  suman el color de marca secundario y su texto encima, un tinte suave, un fondo oscuro
  fijo y su texto encima, una segunda familia (títulos) y un tamaño de portada. Los
  colores se usan siempre en pareja (fondo y texto encima).

### 4. Contacto mínimo y contenido libre en el brief
- **Basta un canal de contacto confirmado** (teléfono, WhatsApp o email). Horario y
  dominio propio son opcionales; sin dominio, el sitio usa la URL de Workers.
- El brief admite **secciones de contenido libre** (título y texto, o lista), con fuente y
  confirmación, para lo que no es un tipo conocido ("cómo funciona", "qué incluye").
- El brief admite el **logo** en versión para fondo claro y para fondo oscuro, y el
  **archivo de tokens de diseño** del cliente si lo trae (colores, tipografía, espaciados y
  radios en JSON), traducido al contrato del punto 3.
- "tokens.json" no es un estándar: es el nombre habitual de ese archivo y cada
  herramienta usa su propio formato. El estándar es el **Design Tokens Format Module
  2025.10** del W3C Design Tokens Community Group (estable desde 2025-10-28, fuera del
  Standards Track del W3C): ese formato se lee directo. Cualquier otro (como el del
  cliente del spike) se traduce con un mapeo explícito y lo confirma el operador.

### 5. Publicación
- `wrangler` va **fijado en el lockfile** del sitio, como cualquier herramienta.
- El nombre del Worker sale del slug del cliente al crear el repo (`specmate new`).
- La URL se conoce **antes** del primer deploy (subdominio de la cuenta, leído una vez), así
  que el canonical sale bien en la primera publicación.
- Las URLs de prueba de las opciones llevan `noindex` y su canonical apunta a sí mismas.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Medir Places igual antes de decidir | El developer lo sacó del MVP; medir algo que no se va a construir es gasto |
| Topes por opción en vez de por sitio | El cliente compra el sitio: el tope tiene que proteger el margen del sitio entero |
| Sin topes hasta tener la biblioteca | ADR-0033 prohíbe loops sin tope; un número medido y revisable es mejor que ninguno |
| Variantes con CSS global por opción | Un mix tendría que mezclar hojas de estilo; con estilos acotados a la variante, alcanza con nombrarla |
| Exigir email, horario y dominio, como hoy | El primer cliente real solo atiende por WhatsApp y no tiene dominio: el esquema lo trababa |
| Publicar dos veces para conocer la URL | Funciona, pero deja un deploy con el canonical mal; leer el subdominio una vez lo evita |

## Consecuencias

**Positivas:** E2 a E5 arrancan con las decisiones que el spike midió en vez de
suponerlas; el mix queda garantizado sin modelo por construcción; el brief acepta
negocios chicos sin dominio ni email.

**Negativas (costo asumido):** los topes salen de una sola medición con un solo cliente y
un rubro; pueden quedar cortos con sitios de varias páginas. Sin Places, cada dato del
negocio se tipea o se confirma a mano. El contrato de tokens crece y cada variante de la
biblioteca tiene que respetarlo.

**Cómo se impone:**
- Places: no hay cliente de Places en el código; un test de dependencias lo vigila (E2).
- Topes: el CLI cuenta tokens por sitio y corta (ADR-0033 punto 5); hasta entonces, el lead.
- Opciones: el build falla con una variante inexistente; un test de la biblioteca verifica
  que ninguna variante use colores o tamaños sueltos (E4).
- Contacto y contenido libre: el validador del brief (E2).
- Publicación: un test de `specmate new` verifica el nombre del Worker; `check:links` y el
  head verifican canonical y `noindex` en las URLs de prueba (E5).

**Revisar cuando:** exista la biblioteca de secciones (topes del punto 2), o el primer
sitio de varias páginas, o el primer cliente que pida datos de Places.
