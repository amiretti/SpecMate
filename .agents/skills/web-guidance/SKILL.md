---
name: web-guidance
description: >-
  Guías vigentes de la plataforma web del equipo de Chrome (Modern Web Guidance):
  HTML nativo, CSS moderno, rendimiento y Core Web Vitals, imágenes, formularios,
  accesibilidad y seguridad. Usar al construir o revisar una sección, la plantilla o
  cualquier HTML y CSS de un sitio, antes de escribir una solución a mano o sumar una
  dependencia. No usar para el CLI, scripts, tests ni infraestructura.
---

# Guías de la plataforma web

Consultás las guías de **Modern Web Guidance** (equipo de Chrome, Apache-2.0) con la
versión fijada en el repo (ADR-0036). Son el estado actual de la plataforma; lo que
aprendió el modelo puede estar viejo.

## 1. Cómo se consulta

Siempre el binario local, con la telemetría apagada. **Nunca `@latest`, nunca `-y`,
nunca `install`.**

```bash
# buscar: 2 a 5 palabras, una sola capacidad, sin nombres de framework ni del cliente
DISABLE_TELEMETRY=1 npx --no-install modern-web-guidance search "responsive images"

# traer una o varias guías por id
DISABLE_TELEMETRY=1 npx --no-install modern-web-guidance retrieve "responsive-design,performance"
```

En Windows (PowerShell): `$env:DISABLE_TELEMETRY=1; npx.cmd --no-install modern-web-guidance search "..."`.

- Buscá por la pieza de interfaz, no por la intención: `"light dismiss dialog"`, no
  `"confirmar una acción"`. Si la búsqueda no trae nada útil, reformulá **una vez** y
  seguí sin guía.
- Si `retrieve` guarda la salida en un archivo temporal, leelo con tu herramienta de
  lectura.
- **Ningún dato del cliente en una búsqueda** (principio XII): ni nombres, ni rubros
  concretos, ni textos.

## 2. Qué manda (las guías no ganan contra una ADR)

Si una guía choca con lo nuestro, **gana la ADR** y lo anotás en el reporte:

- **CSP sin `'unsafe-inline'` ni `'unsafe-eval'`, sin *nonce*** (ADR-0030, ADR-0035).
  Un sitio estático no tiene *nonce* por pedido: la escalera de compatibilidad
  `'strict-dynamic'` + `'unsafe-inline'` que propone la guía de seguridad **no aplica**.
- **Sin JavaScript en el cliente** salvo una isla con motivo escrito en el brief. Si la
  guía resuelve algo con JS y hay una solución nativa en HTML o CSS (`<dialog>`,
  `popover`, `<details>`, scroll-driven animations), va la nativa.
- **Nada inline:** ni `<script>` ejecutable, ni `<style>`, ni `style=`, ni `on*=`.
- **Estilos desde los tokens del cliente**; fuentes autoalojadas; sin CDN.
- **Fallbacks obligatorios:** el público de un negocio local usa celulares de gama
  media y navegadores no siempre actualizados. Una característica que no es Baseline
  ampliamente disponible lleva su alternativa, como pide la guía.

## 3. Qué ignorar

Categorías fuera del alcance de un sitio estático de negocio: `built-in-ai`, `pwa`,
`webmcp`, `wasm`, y los componentes web con Shadow DOM salvo que una ADR los pida.

## 4. En el reporte

Una línea, nunca una sección aparte: `guías: <id>, <id> · desvíos por ADR: <cuál y por qué>`.

## 5. Escáner de patrones viejos

`npx --no-install modern-web-guidance legacy-scan <ruta> --json` detecta patrones viejos
con reglas deterministas (cubre cerca del 20 % de las guías). Lo usás solo en una
revisión amplia de la plantilla o la biblioteca, no en cada tarea. En `verify` entra
como informe, sin bloquear (E5).
