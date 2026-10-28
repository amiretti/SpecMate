---
name: project-guard
description: >-
  Lo operativo del proyecto: repo, fuentes de verdad, zonas críticas, gates, bloqueos y
  comandos de conteo. Los principios, el stack y las barandas viven en la constitución
  (.specify/memory/constitution.md). Todo agente carga las dos antes de escribir o
  revisar. Junto con la constitución, es lo único que se completa por proyecto.
---

# Project guard — SpecMate

Si algo de acá contradice a la constitución o a una ADR, **ganan ellas** y este archivo
está desactualizado: reportalo.

## 1. Datos del proyecto

| Marcador | Valor |
|---|---|
| Repositorio | `amiretti/SpecMate` (público, sin licencia: todos los derechos reservados) |
| Rama base | `main` |
| Tablero | GitHub Issues del repo: épicas con la etiqueta `épica`, historias con `historia` |
| Convención de cierre de issue | `Closes #n` en el cuerpo del PR |
| Convención de rama | `###-slug` (la de Spec Kit) |
| Convención de commit | `<type>: <desc>` (feat, fix, docs, chore, refactor, test) |

## 2. Dónde vive la verdad

| Qué | Dónde |
|---|---|
| **Principios, stack y barandas** | `.specify/memory/constitution.md` |
| Alcance y anti-alcance del MVP | issue de cada épica y `docs/mvp.md` |
| Todo lo de una historia | `specs/<###>-<slug>/`: `analysis.md`, `spec.md`, `test-plan.md`, `plan.md`, `tasks.md` |
| Fases y grafo de dependencias | `specs/README.md` |
| Decisiones de arquitectura | `docs/adr/ADR-NNNN-*.md` |
| Invariantes de cada paquete | `packages/<paquete>/AGENTS.md` |
| Convenciones transversales | `AGENTS.md` raíz |

Orden de autoridad: **constitución y ADR > spec > criterio del implementador.**

## 3. Stack → constitución

En la constitución (*Stack y dependencias*). No lo dupliques acá.

## 4. Barandas → constitución

En la constitución (*Barandas*). No las dupliques acá.

## 5. Zonas críticas

| Zona | Por qué es crítica | Cobertura mínima |
|---|---|---|
| Gates y piso de autonomía (`packages/daemon`) | Un gate que se saltea deja pasar un push o un secreto sin que nadie lo vea | 100 % de ramas + test por cada regla del piso |
| Autenticación local del daemon (pipe, token) | Otro proceso de la PC podría manejar a los agentes | test de integración que rechaza sin token |
| Presupuesto, cuota y checkpoint | Un error corta el trabajo a mitad o quema la cuota semanal | 95 % + casos de borde de ventanas |
| Manejo de credenciales y del login de cada proveedor | Fuga de credenciales o violación de los términos del proveedor | revisión `security` bloqueante |

## 6. Gates

Todavía no hay CI: hasta que exista, **todos estos son reglas de proceso, no
mecanismos**. Se configuran en US-01 y E6.

| Gate | Comando | Dónde corre |
|---|---|---|
| Build | `npm run build --workspaces` | PR (a configurar) |
| Unitarios | `npm test --workspaces` | PR (a configurar) |
| Tipos y lint | `npm run lint --workspaces` | PR (a configurar) |
| Proyección al día | `node tools/project.mjs claude --check` | al abrir sesión |
| Secretos | a definir en E6 (ej: gitleaks) | **pre-commit**, bloqueante |
| SAST | a definir en E6 | pre-commit |
| Auditoría de dependencias | `npm audit --omit=dev` | pre-commit y PR |

Sin branch protection en `main`, *"ningún PR se mergea en rojo"* es una regla de
proceso.

## 7. Bloqueos vigentes

| Bloqueo | Qué frena | Se levanta cuando |
|---|---|---|
| Spike E0 abierto | Todo código de producto fuera de las pruebas del spike | Cierra US-05 |
| Consulta sobre suscripciones (US-02) | Cualquier trabajo para terceros (E12) | Hay veredicto en US-02 |

Una historia que toca algo bloqueado **no se taskea ni se supone: se reporta.**

## 8. Comandos de conteo

```bash
grep -l 'Estado:.*\(Propuest[oa]\|Abierta\)' docs/adr/*.md   # ADR abiertas
gh issue list --repo amiretti/SpecMate --label historia --state open   # lo que queda
npm test --workspaces                                           # estado real de los tests
```
