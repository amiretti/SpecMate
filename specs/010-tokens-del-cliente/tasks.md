# Tareas: US-16, tokens del cliente

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Escribe**: el lead, inline (cadena acoplada, plan "Quién escribe") · **Verifica**: `security`, nivel máximo
**Estimación total**: ~100k tok · ~3 h · **Estado**: derivadas del plan aprobado (2026-11-24)

Ninguna tarea lleva `[P]`: cada una usa el contrato de la anterior (dominio → puertos → caso de uso → comando).
Todas van con test primero (constitución IV). Runner: `npm test -w packages/cli` (vitest) y, para T004,
`npm test` en `templates/site`.

- [x] T001 [US3] Contraste WCAG 2.2 y las parejas de la decisión 6 — `packages/cli/src/domain/contrast.ts`, `test/contrast.test.ts` · cierra: AC-6 · nivel: estándar · est: 10k · 20 min
- [x] T002 [US1] Lectura DTCG (tipo heredado, referencias, ciclos, topes, `$ref`/`$extends` no soportados) y formato propio; conversión de valores — `src/domain/design-tokens.ts`, `test/design-tokens.test.ts` · cierra: AC-1, AC-2, AC-7 (dominio) · nivel: estándar · est: 25k · 50 min
- [ ] T003 [US2] Mapeo: propuesta exacta, fusión con `steps.tokens` guardado, confirmación atada al hash, faltantes y problemas, validación de la forma guardada — `src/domain/design-tokens.ts`, `test/tokens-mapping.test.ts` · cierra: AC-3, AC-5 (dominio) · nivel: estándar · est: 15k · 30 min
- [ ] T004 [US1] `TOKEN_PATHS` exportado por la plantilla; puerto `SiteTokens` que lo importa del sitio, valida con `buildTokensCss` y escribe atómico — `templates/site/src/lib/tokens.ts` y su test, `src/application/ports.ts`, `src/infrastructure/node-site-tokens.ts`, `test/node-site-tokens.test.ts` · cierra: AC-1 (contrato) · nivel: estándar · est: 10k · 20 min
- [ ] T005 [US1-US3] Caso de uso y comando `specmate tokens <slug> [--clients] [--file] [--confirm]`, `ClientFolder.readFile`, paso por nombre en `RelevamientoStore`, `.tokens` en el inventario, ayuda y `packages/cli/AGENTS.md` — `src/application/apply-client-tokens.ts`, `src/cli/*`, `src/infrastructure/*`, `src/domain/inventory.ts`, `test/tokens.integration.test.ts` · cierra: AC-1, AC-3, AC-4, AC-5 · nivel: estándar · est: 25k · 50 min
- [ ] T006 Revisión `security` sobre el diff entero (entrada no confiable que termina en CSS; módulo del sitio ejecutado por el CLI) · cierra: AC-7 (verificación independiente) · nivel: máximo · est: 10k · 20 min
- [ ] T007 Verificación: `npm run lint`, `npm run build`, diferencial de `new` e `inventory` contra `main` y la suite entera (`npm test`) una vez, por el lead · cierra: AC-1 a AC-7 · est: 5k · 10 min

**AC sin tarea:** ninguno. **AC `manual`:** ninguno.
**Desvío del preset:** la verificación final la hace el lead, no `qa`, como en US-15: `security` ya es el verificador independiente.
