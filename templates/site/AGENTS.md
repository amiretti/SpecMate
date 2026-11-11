# templates/site

La plantilla de la que sale cada sitio de cliente (ADR-0030). `specmate new` la copia a
un repo propio del cliente; no es un workspace de este monorepo.

## Invariantes de todo sitio

- **Astro 7, salida estática, sin JavaScript en el cliente** salvo una isla con motivo
  escrito en el brief.
- **Nada inline:** ni `<script>` ni `<style>` ni atributos `on*=` en `dist/`; `set:html`
  prohibido en el código. La CSP no lleva `unsafe-inline` ni `unsafe-eval`.
- **Todo el contenido sale del brief confirmado** y se renderiza escapado. Nada de
  texto de relleno, testimonios inventados ni datos copiados de Google Maps.
- **Estilos desde los tokens del cliente** (custom properties); fuentes autoalojadas.
- **Orígenes externos solo de la lista blanca del brief**, con motivo.
- `_headers` versionado con CSP, HSTS, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
- Dependencias fijadas, lockfile versionado y `ignore-scripts=true`.

Todavía vacía: se construye en E1.
