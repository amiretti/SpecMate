# ADR-0038 — Rendimiento con `lighthouse` sin LHCI, y licencias de las herramientas de verificación por excepción de paquete

- **Estado:** Aceptada (2026-11-16, Andy: "sí, acepto ambas")
- **Fecha:** 2026-11-16
- **Reemplaza:** ADR-0030 en parte (versiones verificadas: "`@lhci/cli` 0.16"; alcance del control *Dependencias*)
- **Afecta a:** `templates/site` (US-12, #40), test de licencias, control de dependencias, constitución («Licencias permitidas»)

## Contexto

ADR-0030 fija Lighthouse CI (`@lhci/cli` 0.16), secretlint 13 y `npm audit --audit-level=high`
con "0 altas o críticas". El spike de US-12 (2026-11-16, `npm install --ignore-scripts`) midió:

- `@lhci/cli` 0.16.1: **9 vulnerabilidades altas** (`proxy-agent`, `basic-ftp`, `puppeteer-core`, entre otras).
- `lighthouse` 13.6.0 sola: 0 vulnerabilidades, pero depende de forma fija de `@sentry/node`, que trae `sentry` (FSL-1.1-Apache-2.0, no open source) y `oxc-parser` (módulo nativo). La constitución exige "Sin módulos nativos salvo ADR". `lighthouse/core/lib/sentry.js:50,60` solo importa Sentry si `enableErrorReporting` es verdadero, y en ese caso reporta a sentry.io.
- secretlint 13.1.0: Artistic-2.0, WTFPL, Python-2.0/PSF-2.0 y CC-BY-3.0, fuera de las listas de la constitución. ADR-0035 pide "su propia excepción" para cada licencia fuera de lista.
- No hay hoy ningún control de `npm audit` en `templates/site` (`git grep "npm audit" -- templates/site` vacío).

## Decisión

1. El control de rendimiento usa `lighthouse` (13.6) por su API de Node, sin `@lhci/cli`: 3 corridas por página y la mediana con `computeMedianRun` de `lighthouse/core/lib/median-run.js`.
2. `@sentry/node` se reemplaza con `overrides` de npm por un módulo local vacío, con licencia MIT, dentro de la plantilla. `enableErrorReporting` va siempre en `false`.
3. `npm audit --audit-level=high` corre sobre todo el árbol de `templates/site`, incluidas las `devDependencies`, con umbral 0 altas o críticas.
4. Una licencia fuera de las listas en un paquete que solo corre al construir se admite solo como **excepción por paquete**, con nombre, licencia y motivo, en una tabla del test de licencias. Un paquete nuevo con esa licencia, aunque sea la misma, falla.
5. Excepciones iniciales, todas de secretlint 13: `binaryextensions`, `editions`, `istextorbinary`, `textextensions` y `version-range` (Artistic-2.0); `@azu/style-format` (WTFPL); `argparse` (Python-2.0); `spdx-exceptions` (CC-BY-3.0, datos SPDX).
6. La constitución, en «Licencias permitidas», remite a esta ADR para las excepciones por paquete (enmienda menor, la ratifica el developer).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| `@lhci/cli` como fija ADR-0030 | 9 altas: el control de dependencias queda en rojo, o hay que debilitarlo. Igual trae `sentry` |
| `lighthouse` tal cual, con excepción para `sentry` (FSL) y para `oxc-parser` (nativo) | Dos excepciones para código que nunca corre. FSL no es open source, y prohíbe el "uso competidor" |
| PageSpeed Insights API | Necesita URL pública y clave: antes de publicar no hay sitio que medir |
| Sumar Artistic-2.0, WTFPL, Python-2.0 y CC-BY-3.0 a la lista de lo que solo construye | Cualquier paquete futuro con esas licencias entraría sin que nadie lo vea |
| gitleaks o trufflehog en lugar de secretlint | gitleaks es un binario fuera de npm y cambia el stack; trufflehog sería AGPL, vedada (no verificado) |
| `npm audit --omit=dev` | La plantilla tiene una sola dependencia de producción (la fuente): el control pasaría en verde sin auditar ninguna herramienta |

## Consecuencias

**Positivas:** 0 vulnerabilidades altas y 0 módulos nativos con Lighthouse (spike con el reemplazo: `npm ls @sentry/node sentry oxc-parser` solo muestra el módulo vacío; `npm audit` sin hallazgos). Ninguna telemetría posible hacia sentry.io. Cada licencia rara queda nombrada y con motivo.

**Negativas (costo asumido):**
- El reemplazo de Sentry se revisa en cada versión mayor de Lighthouse; si cambia la cadena, el test de licencias o el lockfile lo marcan.
- El script de mediana es propio, no de LHCI.
- La tabla de excepciones crece con cada upgrade de secretlint que traiga paquetes nuevos.
- El módulo vacío figura en el lockfile como enlace local sin campo `license`; el test de licencias tiene que leer su `package.json`.

**Cómo se impone:**
- Test de licencias por grupo, con la tabla de excepciones por paquete: un paquete fuera de lista que no está en la tabla falla, y una entrada de la tabla que ya no existe en el lockfile también falla, para que no quede vieja.
- Test que falla si `sentry` u `oxc-parser` aparecen en el lockfile de la plantilla.
- Script de `npm audit` con umbral 0 altas, y su sitio que falla a propósito en US-12.

**Revisar cuando:** Lighthouse deje de depender de Sentry; secretlint saque esas dependencias; o el producto se ofrezca a terceros (ADR-0035).
