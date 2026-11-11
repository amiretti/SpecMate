# ADR-0029 — Pivot: de la carpeta del cliente a la web publicada

- **Estado:** Aceptada (2026-11-11, Andy: "dale, vamos por ahí")
- **Fecha:** 2026-11-11
- **Reemplaza:** el alcance de producto de `docs/architecture/v2.md` y de ADR-019 a ADR-026 (agente principal con equipos, router de suscripciones, canal móvil, daemon y extensión de VS Code). Reemplaza en parte a ADR-0028 (ver Consecuencias).
- **Afecta a:** constitución (stack, barandas y principios VII a IX), `docs/mvp.md`, épicas, README, estructura de `packages/`

## Contexto

SpecMate nació como un workspace general que lleva cualquier ticket hasta el merge con
un equipo de agentes. Al compararlo con Gentle AI (2026-11-06) quedó claro que:

- Como herramienta general pierde: Gentle AI ya resuelve el proceso (ODD, memoria,
  revisión), tiene 8k estrellas, un equipo activo y la misma comunidad hispanohablante.
  Los orquestadores de ticket a PR (Copilot, Kiro, Conductor, la extensión oficial de
  Claude Code) son de empresas con equipos enteros.
- El hueco que nadie cubre bien es más chico y concreto: **sitios para negocios
  hechos con el material real del cliente**, con datos verificados, seguros, con tests
  y baratos de mantener. Los generadores con IA (Lovable, v0, Bolt, Framer, Wix, Hostinger)
  generan rápido desde un prompt, pero no parten del material del cliente ni verifican
  lo que publican, y el código queda atado a su plataforma.
- Harvi ya vende ese servicio: el producto se usa desde el primer día y se mide en
  horas por sitio.

## Decisión

1. **El producto es:** dada una carpeta con el material del cliente, la URL de Google
   Maps del negocio y referencias online, SpecMate genera un **sitio estático**
   (one page, landing o pocas páginas) listo para publicar, con tests, sin
   vulnerabilidades conocidas al publicar y con un diseño propio del cliente.
2. **Flujo con tres gates humanos:**
   1. **Ingesta → brief verificable.** Cada dato publicable lleva su fuente.
      *Gate 1:* Harvi o el cliente confirman los datos.
   2. **Dirección de arte.** Dos o tres direcciones con portada, paleta y tipografía.
      *Gate 2:* se elige una, que pasa a ser el sistema de diseño del cliente.
   3. **Construcción** con tests primero.
   4. **Verificación automática.** Build, e2e, accesibilidad, rendimiento, SEO local,
      enlaces, HTML y seguridad. Cualquier control en rojo **bloquea la publicación**.
   5. *Gate 3:* revisión de la vista previa → publicación.
3. **Sin CMS.** Los cambios de contenido los hace Harvi regenerando y republicando.
   La edición por el cliente queda como épica post-MVP, porque agrega backend, login
   y superficie de ataque.
4. **Google Maps solo pre-llena y cruza datos.** Las políticas de Places prohíben
   guardar o cachear su contenido (salvo el place ID), y un HTML estático es
   contenido guardado. Lo que se publica (nombre, dirección, horarios, teléfono) es
   lo que **el cliente confirma en el Gate 1**: son sus datos. El mapa se muestra
   con un enlace a Google Maps o con su embed oficial, nunca con datos copiados. Las
   reseñas y fotos de Google no se copian; los testimonios salen del cliente, con
   permiso, y **nunca se inventan**.
5. **Se queda del kit:** constitución, gates con piso, flujo proporcional
   (ADR-0027), capa `.agents/` neutral al proveedor, protocolo de veredicto,
   `project-guard` y el manual de marca como plantilla del sistema de diseño de cada
   cliente.
6. **Se va, sin fecha:** daemon, extensión de VS Code, router de varias
   suscripciones, canal móvil, equipos en paralelo y el agente principal con nombre.
   El producto corre como **CLI + agentes de Claude Code** en la PC de quien hace el
   sitio.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con el workspace general | Pierde contra Gentle AI y contra los orquestadores de grandes empresas, sin distribución propia |
| SPA (React, Vue) como salida | Peor SEO local, más JavaScript, más dependencias y más superficie de ataque, sin beneficio para un sitio de negocio |
| Usar un generador existente (Lovable, Framer, Wix) | Código o contenido atado a la plataforma, sin verificación de datos ni controles de seguridad propios, costo mensual por sitio |
| CMS desde el MVP | Suma backend, autenticación y actualizaciones de seguridad a cada sitio; ninguno de los primeros clientes lo pidió todavía |
| Copiar datos, reseñas y fotos de Google Maps al sitio | Viola las políticas de Places (sin cacheo, atribución obligatoria) y publica datos que el cliente no confirmó |

## Consecuencias

**Positivas:** un resultado medible (sitio publicado, puntajes, horas); un mercado
donde Harvi ya vende; menos de la mitad del alcance técnico anterior; casi sin
superficie de ataque en lo publicado.

**Negativas (costo asumido):**
- El diseño no se automatiza del todo: el Gate 2 necesita criterio humano.
- Los datos del cliente pueden quedar desactualizados (horarios, teléfono): hace falta
  un circuito de mantenimiento (épica post-MVP).
- Se descarta trabajo hecho: el diseño del daemon y la extensión, y el spike de
  suscripciones concurrentes.
- De ADR-0028 siguen vigentes Node 24, TypeScript 7, npm workspaces, esbuild,
  Biome, Vitest, Zod y la excepción de licencia del Agent SDK. Dejan de aplicar
  JSON-RPC, `node:sqlite`, Preact, vscode-elements y vsce.

**Cómo se impone:** la constitución 2.0.0 cambia stack y barandas; las épicas viejas
se cierran como no planificadas, con referencia a esta ADR.

**Revisar cuando:** los tres primeros sitios reales muestren si el ahorro de horas
justifica el producto, o cuando un cliente pida editar su sitio.
