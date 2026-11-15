# ADR-0036 — Guías de la plataforma web de Chrome (Modern Web Guidance), fijadas y envueltas

- **Estado:** Aceptada (2026-11-15, Andy: "dale, perfecto")
- **Fecha:** 2026-11-15
- **Reemplaza:** —
- **Afecta a:** `package.json` raíz, skill `web-guidance`, roles `frontend` y `security`, `verify` (E5), biblioteca de secciones (E4)

## Contexto

El equipo de Chrome publica **Modern Web Guidance** (paquete npm `modern-web-guidance`,
Apache-2.0): unas 230 guías actualizadas de la plataforma web, buscables sin red, entre
ellas rendimiento y Core Web Vitals (26), interfaz (75), diseño visual (22), CSS (18),
formularios (19), seguridad (17) y accesibilidad (4). Trae también `legacy-scan`, un
escáner determinista de patrones viejos.

Es justo el conocimiento que necesitan la plantilla y la biblioteca de secciones: lo que
el modelo aprendió puede estar viejo. Pero la instalación que propone el paquete choca
con nuestras reglas (revisión del tarball 1.0.0 sin ejecutarlo, 2026-11-13):

- `install` corre `npx -y skills add GoogleChrome/modern-web-guidance`: otra
  herramienta, sin versión fijada, que escribe a nivel global.
- Su `SKILL.md` ordena correr `npx -y modern-web-guidance@latest` en cada búsqueda:
  código que cambia solo y corre con los permisos del agente.
- La telemetría viene encendida y manda a Google el texto de cada búsqueda.
- Su descripción se declara obligatoria para toda tarea de HTML o CSS y exige cerrar
  cada respuesta con una sección de divulgación.
- Su guía de seguridad propone una CSP con *nonce* y `'unsafe-inline'` como respaldo,
  que un sitio estático no puede usar y ADR-0030 prohíbe.

## Decisión

1. **Dependencia fijada:** `modern-web-guidance@1.0.0` exacta como `devDependency` del
   `package.json` raíz, con lockfile. Solo corre al construir; nada del paquete se
   publica.
2. **Se llama al binario local** (`npx --no-install modern-web-guidance …`) **con
   `DISABLE_TELEMETRY=1`**. Nunca `@latest`, nunca `install`.
3. **Skill propia `web-guidance`** en `.agents/skills/`, que reemplaza la del paquete:
   - cuándo consultarla: secciones, plantilla, HTML y CSS de un sitio;
   - que **las ADR mandan sobre las guías**: CSP sin `unsafe-inline` ni *nonce*, sin
     JavaScript en el cliente salvo motivo, nada inline;
   - qué categorías ignorar: IA integrada, PWA, WebMCP, WebAssembly;
   - fallbacks obligatorios para lo que no es Baseline;
   - una línea en el reporte en vez de la sección de divulgación;
   - ningún dato del cliente en una búsqueda.
4. **La usan** `frontend`, `security` y, cuando existan, los agentes del producto que
   arman secciones (E4). No `lead` ni `developer`.
5. **`legacy-scan` entra en `verify` como informe, sin bloquear** (E5), hasta medir sus
   falsos positivos. Sobre la plantilla actual da 0 hallazgos en 35 reglas.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Instalar con `npx modern-web-guidance@latest install` | Sin versión fijada, a nivel global, con telemetría y un `SKILL.md` que ejecuta `@latest` en cada búsqueda |
| Copiar las guías al repo como archivos | Pierde la búsqueda semántica sin red y obliga a mantener la copia a mano |
| No usarla | Los agentes siguen con patrones aprendidos que pueden estar viejos, justo en lo que más pesa en un sitio de negocio: rendimiento, accesibilidad y CSS |

## Consecuencias

**Positivas:** guías vigentes y verificables en cada sección; búsqueda local en medio
segundo; un escáner determinista más para el informe.

**Negativas (costo asumido):**
- 16 MB más en `node_modules` (casi todo, el índice de búsqueda).
- Las guías se quedan en 1.0.0 hasta que alguien revise y fije una versión nueva.
- Algunas guías van a seguir chocando con nuestras ADR: la skill lo resuelve a favor de
  la ADR, pero cuesta atención.

**Cómo se impone:** la versión exacta en el lockfile; la skill `web-guidance`;
`npm audit` sobre el repo. `legacy-scan` en `verify` desde E5.

**Revisar cuando:** salga una versión mayor del paquete, o `legacy-scan` muestre en E5
falsos positivos frecuentes o hallazgos útiles que justifiquen volverlo bloqueante.
