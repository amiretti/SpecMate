# Tareas: US-15, inventario de la carpeta del cliente

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Modelo**: [data-model.md](./data-model.md)
**Escribe**: el lead, inline (cadena acoplada, plan "Quién escribe") · **Verifica**: `security`, nivel máximo
**Estimación total**: ~125k tok · ~3,5 h · **Estado**: aprobadas (2026-11-23, Andy: "sí, avancemos")

Ninguna tarea lleva `[P]`: cada una usa el contrato de la anterior (dominio → puertos → caso de uso → comando).
Todas van con test primero (constitución IV): el rojo se observa antes de escribir el código.
Runner: `npm test -w packages/cli` (vitest).

- [x] T001 [US1] Dimensiones desde la cabecera (PNG, JPEG, WebP, GIF, SVG, AVIF), ilegible y > 100 MP — `packages/cli/src/domain/image-header.ts`, `test/image-header.test.ts` · cierra: AC-2 (dimensiones), AC-10 (imagen rota) · nivel: estándar · est: 20k · 35 min
- [x] T002 [US1] Clasificación por tabla, normalización de nombres, avisos de resolución, secretos e ignorados — `packages/cli/src/domain/inventory.ts`, `test/inventory.test.ts` · cierra: AC-1, AC-2 (avisos), AC-4, AC-7 · nivel: estándar · est: 20k · 35 min
- [x] T003 [US3] Recorrido seguro: puerto `ClientFolder` y adaptador con `lstat`, sin seguir links, topes de archivos, niveles y tamaño, hash — `src/application/ports.ts`, `src/infrastructure/node-client-folder.ts`, `test/node-client-folder.test.ts` · cierra: AC-9, AC-10, AC-11, AC-12 · nivel: estándar · est: 25k · 45 min
- [x] T004 [US3] Raíces y comando: `specmate inventory <slug> [--clients]`, `SPECMATE_CLIENTS_DIR`, raíz dentro de SpecMate, salida encontré · falta · avisos, ayuda y `packages/cli/AGENTS.md` (fila de `inventory`; se va `--carpeta --maps`) — `src/application/inventory-client-folder.ts`, `src/cli/main.ts`, `test/inventory.integration.test.ts` · cierra: AC-3, AC-8 · nivel: estándar · est: 25k · 45 min
- [x] T005 [US2] Guardar y retomar: puerto `RelevamientoStore`, escritura atómica de `steps.inventory`, fusión con la corrida anterior (corrección, nuevo, `gone`), resto del JSON intacto — `src/domain/inventory.ts`, `src/infrastructure/node-relevamiento-store.ts`, `test/inventory.integration.test.ts` · cierra: AC-5, AC-6 · nivel: estándar · est: 20k · 35 min
- [x] T006 Revisión `security` sobre el diff entero (entrada no confiable, principio V) · cierra: AC-7, AC-9 a AC-12 (verificación independiente) · nivel: máximo · est: 10k · 20 min
- [x] T007 Verificación contra los AC y los gates: `npm run lint`, `npm run build` y la suite entera (`npm test`) una sola vez, por el lead · cierra: AC-1 a AC-12 · nivel: — · est: 5k · 10 min de agente + ~8 min de suite

**AC sin tarea:** ninguno. **AC `manual`:** ninguno.
**Desvío del preset:** la verificación final (T007) la hace el lead y no `qa`. `security` ya es el verificador
independiente (T006) y la historia no está en una zona crítica: un `qa` sumaría otro arranque en frío sin cubrir nada nuevo.
**Cierra también:** #60 (raíz de clientes configurable, AC-8).

## Verificación (2026-11-23)

- **`security` (máximo), primera vuelta: cambios pedidos.** Alto: ReDoS en la cabecera SVG (60 s por archivo). Medios: el
  sitio podía estar dentro de SpecMate; nombres del cliente sin escapar en los errores. Arreglado en `852f76b`, con un test
  por hallazgo que dio rojo antes del arreglo.
- **Seguimiento: aprobado.** Sus Bajos nuevos (mensajes de `new` cambiados, sitio inexistente sin guía, índices del SVG)
  quedaron en `7a4c61e`; el diferencial de `new` contra `main` solo difiere en la ayuda, que documenta `inventory`.
- **Quedan para un issue:** los conteos sin tope de links, ocultos y entradas ilegibles, y el TOCTOU entre el recorrido y
  la lectura (Windows no tiene `O_NOFOLLOW`; hace falta un atacante local durante la corrida).
- **T007:** lint ok · build ok · `npm test` → CLI 219 pasan y 2 salteados · plantilla 696 pasan, 0 fallan y 1 salteado ·
  516 s · `git status` limpio.
