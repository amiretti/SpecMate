---
name: connectors
description: >-
  Qué conectores MCP existen en el proyecto, para qué sirve cada uno y cómo pedir uno
  que tu rol no tiene (por ejemplo Playwright para reproducir un flujo en el navegador,
  o PostHog para ver cómo usan la app los usuarios). Usar cuando una tarea rendiría
  mejor con una herramienta externa que no tenés.
---

# Conectores MCP

## 1. Qué hay

El catálogo está en `.agents/mcp.json`. Para verlo con su propósito, su riesgo y quién
lo usa:

```bash
node tools/mcp.mjs list
```

Si no tenés para ejecutar comandos, leé `.agents/mcp.json` (campos `purpose` y `risk`).

## 2. Antes de pedir uno

Un conector se paga en cada turno de quien lo tiene. Pedilo solo si:

- **Cambia el resultado**, no solo la comodidad. Ej.: reproducir en el navegador un bug
  que no se ve en los tests, o confirmar con datos de uso un AC sobre comportamiento.
- **No alcanza con lo que ya tenés.** WebSearch y WebFetch antes que Perplexity o
  Firecrawl; tests e2e del proyecto o el CLI de Playwright antes que el MCP de
  Playwright.

## 3. Cómo pedirlo

**Nunca lo activás vos.** No corras `tools/mcp.mjs enable` ni `grant`, ni edites
`.agents/mcp.json` o `.workspace/mcp-grants.json`: sumar una herramienta es sumar un
permiso, y esa decisión es del lead o del developer.

Terminá tu turno con esta línea en el reporte (además de lo que ya hiciste):

```
pide-mcp: <conector> · para: <qué vas a verificar o resolver> · sin él: <qué hacés en su lugar y cuánto peor queda>
```

El lead decide y, si lo concede, te vuelve a lanzar con el conector y con tu reporte
anterior, para que no empieces de cero.

## 4. Cómo decide el lead (para que pidas bien)

| Riesgo del conector | Quién aprueba |
|---|---|
| `bajo` (sin costo extra ni datos sensibles: context7, microsoft-learn, playwright, firecrawl…) | El lead solo, desde el nivel de autonomía 2. En los niveles 0 y 1, el developer en una línea |
| `alto` (cobra, toca datos de producción o pasa por un tercero: perplexity, posthog, sentry, figma, composio) | **Siempre el developer** (piso) |

La concesión vale **para esa historia** y se revoca al cerrarla.

## 5. Con datos reales

PostHog y Sentry muestran datos de usuarios reales. Si los usás: solo agregados y
conteos en tu reporte, **nunca** emails, IDs de usuario ni datos personales, y nada de
eso a la memoria del proyecto.
