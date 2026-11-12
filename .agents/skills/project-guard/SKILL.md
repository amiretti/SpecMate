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
| Tablero | [GitHub Project 4 "SpecMate"](https://github.com/users/amiretti/projects/4), con los issues del repo: épicas con la etiqueta `épica`, historias con `historia`. Se sincroniza con `tools/github-project.ps1 -Number 4 -Owner amiretti -Repo amiretti/SpecMate` (la API de Projects no está disponible desde las sesiones en la nube) |
| Convención de cierre de issue | `Closes #n` en el cuerpo del PR |
| Convención de rama | `###-slug` (la de Spec Kit) |
| Convención de commit | `<type>: <desc>` (feat, fix, docs, chore, refactor, test) |

## 2. Dónde vive la verdad

| Qué | Dónde |
|---|---|
| **Principios, stack y barandas** | `.specify/memory/constitution.md` |
| Alcance y anti-alcance del MVP | issue de cada épica y `docs/mvp.md` |
| Todo lo de una historia grande o SDD | `specs/<###>-<slug>/`: `feature.md` (ruta grande) o `spec.md`, `plan.md` y `tasks.md` (ruta SDD) |
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
| Controles de `specmate verify` (ADR-0030) | Un control que pasa en verde sin medir publica un sitio inseguro o roto con el sello de Harvi | 100 % de ramas + un sitio de prueba que falla cada control a propósito |
| Esquema del brief | Un dato sin fuente o sin confirmar llega al sitio publicado (principio XI) | 100 % de ramas + test por cada campo publicable |
| `specmate publish` | Publicar sin aprobación o con controles en rojo | test que prueba que no publica sin `verify` en verde ni sin confirmación |
| Plantilla del sitio: CSP, `_headers`, escape de contenido | Inyección de código o recursos ajenos en el sitio del cliente | test sobre `dist/` de la plantilla + revisión `security` |
| Credenciales (API de Places, Cloudflare, proveedores de IA) | Fuga de claves o cargos en la cuenta de Harvi | revisión `security` bloqueante; nunca en el repo del sitio |

## 6. Gates

Todavía no hay CI: hasta que exista, **todos estos son reglas de proceso, no
mecanismos**. Se configuran en E1 y E5.

| Gate | Comando | Dónde corre |
|---|---|---|
| Build | `npm run build` | PR (a configurar) |
| Unitarios | `npm test` | PR (a configurar) |
| Tipos y lint | `npm run lint` | PR (a configurar) |
| Verificación de un sitio | `specmate verify` (E5) | antes de publicar, bloqueante |
| Proyección al día | `node tools/project.mjs claude --check` | al abrir sesión |
| Secretos | secretlint (ADR-0030) | **pre-commit**, bloqueante |
| SAST | a definir en E5 | pre-commit |
| Auditoría de dependencias | `npm audit --omit=dev` | pre-commit y PR |

Sin branch protection en `main`, *"ningún PR se mergea en rojo"* es una regla de
proceso.

## 7. Bloqueos vigentes

| Bloqueo | Qué frena | Se levanta cuando |
|---|---|---|
| Spike E0 abierto | Todo código de producto fuera del primer sitio del spike | Cierra el informe del spike |

Una historia que toca algo bloqueado **no se taskea ni se supone: se reporta.**

## 8. Comandos de conteo

```bash
grep -l 'Estado:.*\(Propuest[oa]\|Abierta\)' docs/adr/*.md   # ADR abiertas
gh issue list --repo amiretti/SpecMate --label historia --state open   # lo que queda
npm test --workspaces                                           # estado real de los tests
```
