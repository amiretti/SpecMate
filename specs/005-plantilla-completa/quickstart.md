# Guion de validación: US-11

Zona crítica y AC-11 con parte manual. Desde `templates/site/` en Windows.

## 1. Preparación (una vez)

```powershell
npm ci
npx playwright install chromium firefox   # paso explícito; .npmrc bloquea scripts
```

Esperado: lockfile sin cambios; navegadores descargados fuera del repo.

## 2. Verificación automática (AC-1 a AC-10, AC-12; AC-11 parte CSP)

```powershell
npm run check ; npm run lint
npm test          # pretest: build de dist y de las 3 variantes en .variants/
```

Esperado: 0 fallos; los 101 tests de US-09 siguen (con los ajustes de HSTS y *Sin inyección* de ADR-0035); `licenses` y `csp-e2e` verdes en Chromium y Firefox; `.variants/` queda ignorado por git. Reportar conteo y duración.

## 3. Rojo a propósito (principio IV)

Antes de cada implementación, correr el test nuevo y pegar el fallo. Controles de seguridad que deben fallar con su fixture: dato con `</script>`, dos bloques, otro `type`, `<script>` extra, `includeSubDomains`, licencia GPL, `sameAs` no `https`, crawler repetido o vacío.

## 4. Publicación y Rich Results (AC-11, manual; solo con luz verde del developer)

1. Publicar la variante **con dirección** (reusar el Worker del spike solo con autorización explícita en ese momento).
2. `curl.exe -I https://<sitio>/noexiste` → `404` con CSP; el cuerpo es el de `404.html`.
3. `curl.exe -I https://<sitio>/` → HSTS con `max-age=31536000` y sin `includeSubDomains`.
4. Rich Results Test sobre la URL publicada: sin errores para `LocalBusiness`; pegar la salida. `FAQPage` puede no figurar (research R2). La variante `area` avisa de `address` faltante por diseño (research R4).
5. Chrome DevTools abierto en el sitio publicado: 0 violaciones de CSP.

AC-11 queda pendiente hasta pegar esa salida.
