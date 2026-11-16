# Specification Quality Checklist: Plantilla completa (tokens, SEO, GEO y AEO)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — el spec nombra artefactos de producto (`robots.txt`, JSON-LD, `canonical`), no stack ni código; Playwright y Cloudflare solo aparecen en §7 como huecos
- [x] Focused on user value and business needs — §2
- [ ] Written for non-technical stakeholders — FALLA parcial: el dominio es SEO técnico y el lector es el developer; §2 está en lenguaje llano, §3 y §5 no
- [x] All mandatory sections completed — §1 a §7

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — resueltas por el developer el 2026-11-12 (FR-006: permitir crawlers de IA; FR-011: sin `llms.txt`, a §4)
- [x] Requirements are testable and unambiguous — cada FR tiene AC
- [x] Success criteria are measurable — SC-001 a SC-005 con conteos
- [x] Success criteria are technology-agnostic — nombran Chromium y Firefox porque el ticket (AC-4) los exige como objetivo de prueba
- [x] All acceptance scenarios are defined — AC-1 a AC-12
- [x] Edge cases are identified — §5, 5 casos con AC
- [x] Scope is clearly bounded — §4, 8 exclusiones
- [x] Dependencies and assumptions identified — `depende_de`, §6 (5), §7

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows — US1 y 3 variantes de negocio
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Verificación de topes del preset

§1 6 ≤ 6 · §3 12 FR ≤ 12 · §4 8 ≤ 8 · §5 12 AC ≤ 12 · §6 5 ≤ 5 · §7 6 ≤ 6. Cada AC declara verificación; AC-11 mezcla e2e y manual (Rich Results queda pendiente hasta pegar la salida).

## Notes

- Los 2 ítems fallidos no se arreglan con edición: uno es inherente al dominio, el otro espera al developer.
- Estado de la spec: `borrador`. Solo el developer la aprueba.
