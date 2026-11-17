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
| V1 | AC-2 | `npm run test:e2e -w @specmate/cli`, salida pegada | manual | inline · ~10 min | pendiente |
| V2 | AC-9 | salida de `npm test` del CLI en Windows | manual | inline | pendiente |

## Registro

- 2026-11-17: tareas desde el plan aprobado.
