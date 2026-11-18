# Tareas: US-13, `specmate new` sobre un CLI con Clean Architecture

Fuente: [plan.md](./plan.md) (aprobado 2026-11-17) y [spec.md](./spec.md) (aprobada). Tests primero: rojo observado
antes del código. Gobiernan ADR-0034 (Clean Architecture con test de arquitectura como gate) y ADR-0033 (loops
acotados). Todo inline (lead): una cadena acoplada, sin zona crítica.

| ID | Cierra | Entregable | verifica | Ruta · estimación | Estado |
|---|---|---|---|---|---|
| U0 | — | `packages/cli/package.json` (scripts, devDeps fijadas), Vitest, esbuild, Biome | `npm run build -w @specmate/cli` | inline · ~20 min | pendiente |
| U1 | FR-004, FR-008, FR-009 · AC-4, AC-7, AC-8 | `domain/slug.ts`, test de arquitectura con fixtures que violan | `npm test -w @specmate/cli` | inline · ~1 h | pendiente |
| U2 | FR-001, FR-005, FR-006, FR-007, FR-010 · AC-5, AC-6 | `application/` con puertos y caso de uso, tests con dobles | `npm test -w @specmate/cli` | inline · ~1 h | pendiente |
| U3 | FR-001 a FR-003, FR-010 · AC-1, AC-3, AC-5, AC-6, AC-9 | `infrastructure/`, `cli/`, integración en temporales, `AGENTS.md` del CLI | `npm test -w @specmate/cli` + `npm run lint -w @specmate/cli` | inline · ~1,5 h | pendiente |
| V1 | AC-2 | `npm run test:e2e -w @specmate/cli`, salida pegada | manual | inline · ~10 min | hecha (2026-11-18): e2e verde en 346 s |
| V2 | AC-9 | salida de `npm test` del CLI en Windows | manual | inline | hecha (2026-11-18): 50/50 en 4,2 s |

## Registro

- 2026-11-17: tareas desde el plan aprobado.
- 2026-11-17, U0: el primer `npm ci` no dejó el binario de TypeScript 7 (`@typescript/typescript-win32-x64`,
  carpeta vacía); el segundo sí. `npm audit` da 5 altas en la cadena de Vitest 5.1 (ReDoS de `picomatch`, sin
  parche; el único arreglo es bajar a Vitest 3.1.4). El gate del repo es `npm audit --omit=dev` y da 0: se sigue
  con Vitest 5.1 (constitución). Biome sin `vcs` (el `.gitignore` vive en la raíz; `dist` excluido explícito).
- 2026-11-17, U1: RED (módulos ausentes) → GREEN. Saqué "sin guiones dobles" del test del slug: la spec no lo pide.
  Desvío: `application` no importa ningún `node:*` ni paquete (el plan decía "de E/S"); más estricto y más simple.
- 2026-11-17, U2: RED (módulo ausente) → GREEN, caso de uso con dobles de los puertos (11 casos).
- 2026-11-17, U3, desvío de proceso: la infraestructura se escribió antes que su test de integración (sin RED).
  Compensado con 3 sabotajes: lockfile sin renombrar y `discard` que no borra los detecta la integración; el
  chequeo de `publish` no (el caso de uso ya chequea antes): se sumó `test/node-file-system.test.ts`, que sí lo
  detecta. Falsos positivos de la regla de separadores (`}\n`) corregidos. Una parameter property rompía la
  ejecución sin compilar: reemplazada por un campo. Plan, decisión 5: sin override por variable de entorno; la
  plantilla se busca subiendo desde el módulo (la profundidad cambia entre `src/` y `dist/`).
- 2026-11-17, V1: e2e en 6 min 7 s. `npm ci` y `npm run build` del repo creado en exit 0; la home muestra el aviso
  (AC-3). `npm test` del repo: 513 tests, 1 falla: `check:deps` por GHSA-fc5q-39xc-vjpf (picomatch `<=4.0.7`, sin
  parche), la misma falla que tiene `templates/site` en `main`. Developer: "la 1, abrí el issue del aviso" →
  AC-2 queda anotado como bloqueado por causa externa (#51) y US-13 sigue su cierre.
- 2026-11-18: GitHub retiró GHSA-fc5q-39xc-vjpf (`withdrawn_at` 2026-11-18 15:38 UTC); `check:deps` de la plantilla
  vuelve a verde sin cambios. ADR-0039 queda Descartada (developer: "sí, marcala descartada").
- 2026-11-18, V1: `npm run test:e2e -w @specmate/cli` → `Tests 1 passed (1)`, `Duration 346.19s`, exit 0: en el repo
  creado `npm ci`, `npm run build` y `npm test` en exit 0, suite con ≥ 513 tests y 0 fallas, aviso de ejemplo en la
  home (AC-2, AC-3).
- 2026-11-18, V2 (Windows 11): `npm test -w @specmate/cli` → `Test Files 5 passed (5)`, `Tests 50 passed (50)`,
  `Duration 4.23s` (incluye la ruta con espacios y acentos, AC-9).
