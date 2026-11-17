# ADR-0039 — `check:deps` admite una excepción temporal por aviso alto sin parche, con motivo y vencimiento

- **Estado:** Propuesta
- **Fecha:** 2026-11-17
- **Reemplaza:** ADR-0038 en parte (punto 3: "umbral 0 altas o críticas" pasa a "0 altas o críticas no exceptuadas")
- **Afecta a:** `templates/site` (`scripts/controls/deps.mjs`) y cada repo de cliente que sale de la plantilla, US-12 (#40), US-13 (#41), #51; zona crítica: controles de ADR-0030

## Contexto

ADR-0030 y ADR-0038 fijan `npm audit --audit-level=high` sobre todo el árbol de la plantilla con umbral "0 altas o
críticas", y US-12 lo impone con `check:deps`. El 2026-11-17 GitHub revisó GHSA-fc5q-39xc-vjpf (ReDoS en
`picomatch`, rango `<=4.0.7`, publicado el 2026-10-19): la plantilla pasa a tener 14 altas, todas arrastradas por ese
único aviso (astro, vite, secretlint, tinyglobby, anymatch, unstorage). No hay versión con el arreglo: 4.0.7 es del
2026-08-24, el último commit del repo es del 2026-08-27 y los PR con el arreglo (#238 del 2026-10-22, #246, #254)
siguen abiertos. `npm audit` solo propone bajar a astro 5.3.0. Con el umbral actual, la plantilla y cada repo nuevo
(US-13 AC-2) quedan en rojo por tiempo indefinido, sin nada que el proyecto pueda arreglar. `picomatch` solo corre al
construir y al verificar, con patrones de glob que escribe el proyecto, no un visitante.

## Decisión

1. `check:deps` admite **excepciones por aviso** (ID `GHSA-…`), en una tabla versionada junto al control, cada una con
   `id`, `reason`, `added` (fecha), `expires` (fecha) y `adr`.
2. Solo se exceptúan avisos de severidad **alta**. Un aviso **crítico nunca** se exceptúa.
3. Un paquete deja de bloquear solo si **todos** los avisos que lo alcanzan, directos o por su cadena de dependencias,
   están exceptuados. Cualquier otro aviso alto o crítico sigue bloqueando como hoy.
4. El control **falla** si una excepción venció, si su plazo (`expires` − `added`) supera 90 días, o si su aviso ya no
   aparece en el reporte (la excepción quedó vieja y hay que sacarla).
5. La salida en verde nombra cada excepción activa y los días que le quedan, para que nunca pase en silencio.
6. Excepción inicial: GHSA-fc5q-39xc-vjpf, `added` 2026-11-17, `expires` 2027-01-16 (60 días), seguimiento en #51.
   Al vencer, se renueva con una línea nueva en el registro de #51 y aprobación humana, o se resuelve.
7. Sumar o renovar una excepción requiere aprobación humana explícita; un agente la propone, no la aplica.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Esperar el parche con todo en rojo | Sin fecha (3 meses sin actividad en el repo); deja la plantilla y cada repo nuevo en rojo, y un control siempre rojo deja de mirarse |
| Parche propio de `picomatch` en `vendor/` vía `overrides` (como el stub de Sentry, ADR-0038) | Un fork de un PR sin revisar, en dos líneas (4.0.7 y 2.3.2); y un paquete local no lo audita `npm audit`, así que el riesgo deja de verse en vez de quedar escrito |
| Bajar el umbral a `--audit-level=critical` | Apaga todas las altas, no solo esta |
| `--omit=dev` | Ya descartado en ADR-0038: la plantilla casi no tiene dependencias de producción |
| Bajar a astro 5.3.0 | Rompe la plantilla (Astro 7, ADR-0030) para salir de un aviso de baja explotación |

## Consecuencias

**Positivas:** la plantilla y los repos nuevos vuelven a verde sin apagar el control; cualquier aviso nuevo sigue
bloqueando; el riesgo aceptado queda con nombre, motivo y fecha, y el vencimiento obliga a revisarlo.

**Negativas (costo asumido):**
- Durante el plazo, la plantilla y los sitios publicados se construyen con una versión de `picomatch` con un ReDoS
  conocido. Se acepta porque corre al construir, con patrones propios.
- La tabla viaja a cada repo de cliente creado por `specmate new`: al vencer, cada uno se pone en rojo y hay que
  actualizarlo (es lo buscado, pero cuesta una actualización por cliente).
- Más lógica en un control de zona crítica: la cadena de avisos se recorre en código propio.

**Cómo se impone:** tests de `check:deps` con reportes de `npm audit` de fixture: aviso exceptuado en la cadena pasa;
otro aviso alto en el mismo paquete falla; crítico exceptuado falla; excepción vencida, de más de 90 días o que ya no
aparece en el reporte falla; un aviso exceptuado con la tabla vacía falla. Más el sitio que falla a propósito de US-12,
que sigue en rojo.

**Revisar cuando:** salga `picomatch` > 4.0.7 con el arreglo (se saca la excepción y se cierra #51); llegue el
2027-01-16; o la tabla tenga más de 2 excepciones activas a la vez.
