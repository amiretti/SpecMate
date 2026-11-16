---
id: US-12 (#40)
titulo: Correr cada control de ADR-0030 con un comando y verlo fallar a propósito, para que ninguno pase en verde sin medir
estado: aprobada          # borrador | aprobada | en curso | hecha | bloqueada | descartada
origen: https://github.com/amiretti/SpecMate/issues/40
analisis: no requerido (análisis de `functional-analyst` del 2026-11-16, resumido en §1, §6 y §7)
depende_de: [US-11 (#39)]
revisa: developer (Andy); revisión `security` obligatoria antes del PR
zona_critica: controles de la plantilla que bloquean la publicación (project-guard §5)
estimacion: ~250k tok · ~6-8 h de agente · nivel máximo por zona crítica · a revisar tras el plan (medición de Lighthouse y licencias)
---

# Correr cada control de ADR-0030 con un comando y verlo fallar a propósito

## §1 Fuentes

| Fuente | Qué impone |
|---|---|
| Issue #40 (épica E1, #19) | Tres AC: controles con scripts de `npm` y umbrales de ADR-0030; un sitio que hace fallar cada control de a uno; orígenes contra lista blanca y `meta refresh` |
| Comentario del issue #40 (revisión `security` de US-11) | Dos residuos bajos: `checkHeaders` acepta `https://*` y `http://host` en `img-src`/`font-src`; la lista blanca de `set:html` es un escaneo léxico |
| Developer, 2026-11-16 | El residuo de `checkHeaders` entra en US-12; el del escaneo léxico queda como límite aceptado y documentado |
| `ADR-0038` (2026-11-16) | `lighthouse` por API sin LHCI, mediana de 3; `npm audit --audit-level=high` sobre todo el árbol de la plantilla, dev incluido; licencias fuera de lista solo como excepción por paquete |
| `ADR-0030` («Barandas», «Consecuencias») | Cada control es automático y bloquea la publicación; umbrales de Comportamiento, Accesibilidad, Rendimiento y SEO, HTML y enlaces, Secretos y Orígenes externos; Lighthouse toma la mediana de tres |
| `specs/001-plantilla-csp-estricta/feature.md` (L6, revisión `security` de US-09) | "test de orígenes contra la lista blanca y `meta refresh`" quedó pendiente |
| `.specify/memory/constitution.md` 2.3.0 («Licencias permitidas») | Lo que solo corre al construir admite la lista amplia; toda dependencia nueva se verifica antes de agregarse; sin módulos nativos salvo ADR |
| `project-guard` §5 | Zona crítica de controles: un sitio que falla cada control a propósito |
| `specs/005-plantilla-completa/` (US-11) | Playwright mínimo para la CSP, que esta historia extiende; 419 tests de la plantilla que no deben romperse |

## §2 Valor y criterios de éxito

**Para** el dueño de Harvi **que** no puede revisar a mano cada sitio antes de
publicarlo, **esto cambia** que cada control de ADR-0030 corre con un comando y está
probado que se pone en rojo cuando debe: un control que nunca falló no protege nada.

- **SC-001**: Los 8 controles de §3 (FR-001 a FR-007 y FR-012) corren cada uno con su propio script de `npm` en `templates/site` y pasan sobre las 3 variantes de ejemplo con los umbrales de ADR-0030.
- **SC-002**: Para cada uno de los 8 controles existe al menos 1 sitio de prueba que lo hace fallar a propósito, y la falla se observa en rojo; total ≥ 8 casos en rojo, cada uno atribuido a su control.
- **SC-003**: Los 419 tests de la plantilla al inicio de esta historia siguen corriendo y en verde.

## §3 Requisitos funcionales

Qué hace el sistema, no cómo (el cómo va en `plan.md`). Umbrales literales de
ADR-0030 «Barandas».

- **FR-001** (comportamiento): El sistema DEBE verificar sobre `dist/`, en 360, 768 y 1280 px, "secciones, anclas, enlaces de contacto bien formados, sin errores de consola ni pedidos fallidos", con umbral "100 % en verde".
- **FR-002** (accesibilidad): El sistema DEBE correr axe-core "en cada página y ancho", con umbral "0 violaciones *serious* o *critical*".
- **FR-003** (rendimiento y SEO): El sistema DEBE correr Lighthouse con perfil móvil (sin LHCI, ADR-0038) y tomar "la mediana de tres" corridas, con umbral "Rendimiento ≥ 90; accesibilidad, buenas prácticas y SEO ≥ 95".
- **FR-004** (HTML): El sistema DEBE validar el HTML de `dist/` con html-validate, con umbral "0 errores".
- **FR-005** (enlaces): El sistema DEBE revisar los enlaces de `dist/` con linkinator, con umbral "0 enlaces internos rotos (los externos avisan)".
- **FR-006** (secretos): El sistema DEBE correr secretlint "sobre el repo y `dist/`", con umbral "0 hallazgos".
- **FR-007** (orígenes externos): El sistema DEBE comparar los orígenes de los pedidos que hace cada página contra una lista blanca por sitio, con umbral "0 orígenes fuera de la lista".
- **FR-008** (`meta refresh`): Un `<meta http-equiv="refresh">` en `dist/` DEBE hacer fallar los controles.
- **FR-009** (fuentes comodín en headers): El control de headers DEBE rechazar `https://*` y `http://host` (cualquier origen `http://`) en `img-src` y `font-src`.
- **FR-010** (un comando por control): Cada control de FR-001 a FR-007 y FR-012 DEBE correr con un script de `npm` en la plantilla y terminar con código distinto de 0 si no cumple su umbral.
- **FR-011** (sitio que falla a propósito): Para cada control de FR-001 a FR-009 y FR-012 DEBE existir un sitio de prueba que rompe solo ese control; correrlo DEBE dar rojo atribuido a ese control.

- **FR-012** (dependencias): El sistema DEBE correr `npm audit --audit-level=high` sobre todo el árbol de `templates/site`, incluidas las `devDependencies`, con umbral "0 altas o críticas" (ADR-0030, alcance por ADR-0038).

**Entidades clave:**
- **Lista blanca de orígenes**: orígenes externos permitidos para un sitio, cada uno con su motivo (ADR-0030 «Consecuencias»). En esta historia es un dato de ejemplo, no un campo del brief (ver §7).
- **Sitio que falla a propósito**: un sitio de prueba por control, con una sola violación inventada y marcada.

## §4 Fuera de alcance

- `specmate verify` y la publicación que bloquea (E5): acá los controles corren con scripts de `npm` en la plantilla.
- Campo de lista blanca en el esquema del brief (E2): acá la lista es un dato de ejemplo.
- CI y hook de pre-commit con secretlint (`project-guard` §6).
- Headers, imágenes, relleno y *Sin inyección*: ya tienen tests de US-09 y US-11; solo entran sus casos de FR-008 y FR-009.
- Pendientes de US-09 para E5: soft-404 en Cloudflare, HSTS con `includeSubDomains` y CORP.
- Residuo de US-11 sobre el escaneo léxico de `set:html` (strings armados al ejecutar): límite aceptado. Lo cubren el escaneo de `dist/` y la CSP (decisión del developer, 2026-11-16).
- Medir sitios reales de clientes: solo las 3 variantes de ejemplo y los sitios de prueba.

## §5 Historias y criterios de aceptación

### US1 — Cada control corre con un comando y se ve fallar (Prioridad: P1)

El dueño de Harvi corre cada control de ADR-0030 sobre la plantilla y tiene la prueba
de que cada uno se pone en rojo ante su violación. **Prueba independiente:** correr
cada script de control sobre las 3 variantes (verde) y la suite de sitios que fallan
(rojo esperado, por control) en `templates/site`.

| AC | Dado / Cuando / Entonces | Verificación |
|---|---|---|
| AC-1 | **Dado** las 3 variantes de ejemplo **cuando** se corre el script de `npm` de cada uno de los 8 controles (FR-001 a FR-007 y FR-012) **entonces** los 8 terminan con código 0 y su salida muestra el umbral de ADR-0030 cumplido; Lighthouse informa la mediana de 3 corridas por página | manual — salida pegada de los 8 scripts |
| AC-2 | **Dado** un sitio de prueba por control, cada uno con una sola violación **cuando** se corre el control correspondiente **entonces** termina con código distinto de 0 y nombra la violación; son al menos 10 casos (FR-001 a FR-009 y FR-012), uno por control | integración |
| AC-3 | **Dado** una página que pide un recurso a un origen fuera de la lista blanca **cuando** corre el control de orígenes **entonces** falla y nombra el origen; **dado** el mismo origen en la lista **entonces** pasa; un enlace `<a href>` externo no cuenta como pedido | integración |
| AC-4 | **Dado** `dist/` con `<meta http-equiv="refresh">` **cuando** corren los controles **entonces** fallan | integración |
| AC-5 | **Dado** un `_headers` con `https://*` o con `http://host` en `img-src` o en `font-src` **cuando** corre el control de headers **entonces** falla en los 4 casos; la CSP actual de la plantilla sigue pasando | unit |
| AC-6 | **Dado** la plantilla al cerrar la historia **cuando** se corre `npm test` en `templates/site` **entonces** los 419 tests previos siguen en verde | integración |

**Casos borde:**
- Lighthouse con una corrida fuera de rango y dos dentro: decide la mediana (AC-1).
- Un enlace externo roto: avisa, no falla; uno interno roto: falla (AC-2).
- Un pedido fallido o un error de consola solo en 360 px: falla (AC-2).
- Un sitio que falla a propósito que, además, rompe otro control: el caso no sirve; cada uno rompe exactamente uno (AC-2).

## §6 Supuestos

| Se supone | Por qué hace falta | Si es falso, se rehace |
|---|---|---|
| La plantilla actual llega a Rendimiento ≥ 90 y al resto ≥ 95 en Lighthouse móvil | AC-1 exige pasar con los umbrales de ADR-0030 y nunca se midió | Ajustes en la plantilla dentro de esta historia, o una ADR si el umbral no es alcanzable |
| La lista blanca de orígenes de las 3 variantes está vacía | El sitio no carga nada externo (CSP con `'self'`) | Los datos de ejemplo, no la regla |
| Lighthouse corre en Windows con `ignore-scripts=true` usando el navegador de Playwright | ADR-0030 fija `ignore-scripts` y no hay otro Chrome garantizado | El arranque del control de Lighthouse en el plan |

## §7 Riesgos y decisiones abiertas

- **Hueco: lista blanca de orígenes sin brief.** ADR-0030 la pone "en el brief", que es de E2 y no existe. Propuesta: en US-12 vive en los datos de ejemplo de cada variante; E2 la pasa al esquema del brief. Lo resuelve E2.
- **Lighthouse sin medir** (riesgo alto): si la plantilla no llega a los umbrales, AC-1 no cierra. El plan mide antes de comprometer las tareas.
- ~~Licencias y vulnerabilidades de las herramientas~~ resuelto por ADR-0038 (2026-11-16).
- **Tests inestables**: Lighthouse varía entre corridas; la mediana de 3 lo reduce pero no lo elimina. El plan fija cómo se reporta una variación.
- **Contradicciones entre fuentes** (reportadas, no arbitradas):

| Contradicción | Fuente A dice | Fuente B dice | Propuesta | Por qué |
|---|---|---|---|---|
| `meta refresh` | Ticket AC-3: pendiente de US-09 | `test/lib/scan.mjs:71-72` y `no-inline-code.test.mjs:48-49` ya lo prohíben y lo prueban | AC-4 solo exige el sitio que falla; se reusa el control existente | Evita duplicar un control |
| Playwright | ADR-0030: 360, 768 y 1280 px | `test/csp-e2e.test.mjs:17` usa un solo contexto sin ancho | FR-001 lo extiende a los 3 anchos | La historia ya lo prevé (US-11 §7) |
