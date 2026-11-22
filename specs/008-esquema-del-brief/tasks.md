# Tareas: US-14, el sitio se construye desde `relevamiento.json`

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · Escribe: un agente `frontend`, nivel máximo (plan, "Quién escribe").

| # | Unidad | Cubre | Rojo observado | Estado |
|---|---|---|---|---|
| U1 | Validador del brief (`templates/site/src/lib/site.ts`, `parseRelevamiento`) | FR-002..FR-009, FR-011 · AC-1, AC-3, AC-5, AC-8 | `test/site.test.mjs` sin `parseRelevamiento` | hecho |
| U2 | Carga desde `relevamiento.json` (`src/data/site.ts`, `scripts/site-env.mjs`, `astro.config.mjs`) | FR-001 | `test/build-failures.test.mjs`: 4 en rojo | hecho |
| U3 | Render: canales separados, secciones libres, logo, "Cómo llegar", `geo` | FR-005..FR-008, FR-012 · AC-2, AC-4, AC-7 | — (se escribió junto al render) | hecho |
| U4 | Ejemplos y fixtures a JSON | FR-013 · AC-9 | la suite migrada | hecho |
| U5 | `check:origins` lee `brief.allowedOrigins` | FR-010 · AC-10 | `test/controls-browser.test.mjs` | hecho |
| U6 | Sitio chico con los 7 controles (`test/small-site.test.mjs`) y `specmate new` | AC-6, AC-11 | el test del CLI en rojo hasta commitear la plantilla (`new` copia lo de `HEAD`) | hecho; AC-11 verde tras el commit |

Revisión `security` (2026-11-22): no bloquea. Dos rondas de filtro de SVG activo dejaron bypasses (XSLT embebido, entre otros); el developer decidió rasterizar también los SVG a AVIF y WebP, así que nunca se publica un SVG (`test/logo.test.mjs`). El symlink del logo resuelve dentro del repo y en su propio `src/assets/brand/` (`test/site.test.mjs`, "logo location"). La lista de hosts de `mapsUrl` quedó en #74.
