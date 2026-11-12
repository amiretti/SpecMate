# Tareas: US-11, plantilla completa

Fuente: [plan.md](./plan.md) (aprobado). Tests primero en cada tarea: rojo observado y reportado antes del código.

| ID | Unidad | Cierra | Entregable | verifica | Ruta · nivel | Estado |
|---|---|---|---|---|---|---|
| T0 | U3 | R1 | Spike: ¿Astro evalúa `{json}` dentro de `<script type="application/ld+json">`? | build real | inline (lead) | ✅ No lo evalúa: hace falta `set:html` → ADR-0036 |
| U1 | U1 | FR-012 · AC-12 | `astro`, `sharp` y demás a `devDependencies`; test de licencias por grupo (constitución 2.2.1); `playwright` como devDependency para U4 | `npm test` | `frontend` · estándar | ✅ fa8f3bd · npm test 150/150 |
| U2 | U2 | FR-001 · AC-1 | `tokens.json` → CSS; 0 literales en el CSS escrito a mano | `npm test` | mismo agente que U1 (superficie disjunta de U3) | ✅ fa8f3bd |
| T1–T8 | U3 | FR-002 a FR-010 · AC-2 a AC-10 | Núcleo en el orden de plan.md | `npm test` + build | `frontend` · máximo (zona crítica) · ADR-0036 aceptada | ✅ cc6bea5, bdbd94e · 419 tests, 415 pasan, 0 fallan, 4 cancelados (Firefox) |
| U4 | U4 | AC-11 | Playwright Chromium + Firefox: 0 violaciones de CSP con JSON-LD | `npm test` (e2e) | agente de U3 · máximo | ⚠️ Chromium en verde; Firefox cancelado (Defender borra el binario de Playwright) |
| V1 | — | todas | Revisión `security` (zona crítica) | veredicto | `security` · máximo, más seguimiento en estándar | ✅ aprobado: 2 medios y 4 bajos corregidos en bdbd94e; quedan 2 residuos bajos para US-12 (#40) |
| V2 | — | AC-11 | Publicación y Rich Results Test, variante con dirección | salida pegada | inline, con luz verde del developer | al final |
