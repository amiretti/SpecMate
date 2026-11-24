# Tareas: US-17, el negocio, el objetivo y el tono

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Escribe**: `developer` (nivel estándar) el CLI, por respaldo de contexto de la sesión del lead; el lead escribe el rol
y la skill · **Verifica**: `security`, nivel máximo · **Estimación total**: ~150k tok · ~5 h
**Estado**: derivadas del plan aprobado (2026-11-24)

Todas van con test primero (constitución IV). Runner: `npm test -w packages/cli` (vitest).

- [ ] T001 [lead] Rol `client-reader` (`capabilities: [read]`) y skill `relevamiento`, con la proyección regenerada — `.agents/roles/client-reader.md`, `.agents/skills/relevamiento/SKILL.md`, `.claude/**` (generado) · cierra: FR-011 · est: 10k · 20 min
- [ ] T002 [developer] Catálogo de rubros y tabla (U1), propuesta y su validación (U2), cita (U3) — `packages/cli/src/domain/business-profile.ts`, `src/domain/quote.ts` y sus tests · cierra: FR-002 a FR-005, AC-1 a AC-3 (dominio) · est: 40k · 80 min
- [ ] T003 [developer] Confirmar, corregir, delegar y fusionar con lo guardado (U4) — `src/domain/business-profile.ts` y su test · cierra: FR-007 a FR-009, AC-4 a AC-6 · est: 25k · 50 min
- [ ] T004 [developer] Comando `specmate profile` con `propose`, `set`, `confirm` y `pick`, stdin en `Io`, ayuda, `packages/cli/AGENTS.md` (U5) — `src/application/business-profile-step.ts`, `src/application/ports.ts`, `src/cli/*`, `test/profile.integration.test.ts` · cierra: FR-001, FR-006, FR-010, AC-1 · est: 35k · 70 min
- [ ] T005 [developer] Test de ADR-0041 (U6): sin SDK de modelos ni claves en el CLI; `client-reader` solo lee — `packages/cli/test/no-model.test.ts` · cierra: ADR-0041 · est: 5k · 10 min
- [ ] T006 Revisión `security` sobre el diff entero (texto del cliente leído por un modelo, OWASP LLM01) · cierra: AC-8 · nivel: máximo · est: 15k · 25 min
- [ ] T007 AC `manual` (AC-7, AC-8) con la skill sobre un cliente inventado, diferencial de `new`, `inventory` y `tokens` contra `main`, lint, build y la suite entera una vez, por el lead · cierra: AC-1 a AC-8 · est: 15k · 30 min

**AC sin tarea:** ninguno. **AC `manual`:** AC-7 y AC-8 (T007).
