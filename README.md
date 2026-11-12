<div align="center">

# SpecMate

**De la carpeta del cliente a la web publicada.**
Le das el material del negocio, su ubicación en Google Maps y un par de referencias, y
SpecMate entrega un sitio estático listo para publicar: datos confirmados, diseño
propio, tests y controles de seguridad que no dejan salir nada en rojo.

![Estado](https://img.shields.io/badge/estado-spike%20fase%200-orange)
![Salida](https://img.shields.io/badge/salida-sitio%20est%C3%A1tico%20(Astro)-BC52EE)
![Node](https://img.shields.io/badge/node-24%20LTS-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-blue)
![Licencia](https://img.shields.io/badge/licencia-todos%20los%20derechos%20reservados-lightgrey)

[Por qué](#por-qué-specmate) · [Cómo funciona](#cómo-funciona) ·
[Qué controla](#qué-controla-antes-de-publicar) · [Roadmap](#roadmap) ·
[Contribuir](#trabajar-en-el-repo) · [Documentación](#documentación)

</div>

> [!IMPORTANT]
> **En construcción.** Estamos en el spike de la fase 0 ([E0](https://github.com/amiretti/SpecMate/issues/1)).
> Todavía no hay nada para instalar. Hoy este repo tiene las decisiones, el kit de
> agentes y el esqueleto del código.

---

## Por qué SpecMate

Un negocio local necesita un sitio que diga la verdad, cargue rápido, aparezca en
Google y no se pueda romper. Los generadores con IA lo resuelven rápido desde una
descripción, pero inventan, dejan el sitio atado a su plataforma y nadie verifica qué
publican.

| El problema | Lo que hace SpecMate |
|---|---|
| El generador inventa horarios, servicios o testimonios | **Nada se publica sin fuente:** cada dato sale del material del cliente y el cliente lo confirma antes de construir |
| Todos los sitios hechos con IA se parecen | **Diseño propio, elegido de a un paso:** paleta, tipografía y composición, tres opciones cada una, sobre el logo del cliente |
| "Es seguro" sin nada que lo respalde | **Controles que bloquean:** CSP estricta, nada inline, dependencias auditadas, secretos escaneados. Si algo da rojo, no se publica |
| Lento en el celular, invisible en Google | **HTML estático:** rendimiento ≥ 90 en Lighthouse, SEO local con `LocalBusiness` y sin JavaScript de más |
| El sitio queda en una plataforma ajena | **El código es del cliente:** un repo por sitio, hosting en Cloudflare, sin costo mensual de plataforma |

## Cómo funciona

```mermaid
flowchart LR
    In["Carpeta del cliente<br/>+ URL de Maps<br/>+ referencias"] --> Rel["Relevamiento<br/>detecta · infiere · pregunta lo que falta"]
    Rel --> G1{{"Gate datos"}}
    G1 --> Marca["3 paletas → 3 tipografías"]
    Marca --> G2{{"Gate marca"}}
    G2 --> Bosq["3 bosquejos"]
    Bosq --> G3{{"Gate bosquejo"}}
    G3 --> Build["Sitio estático<br/>tests primero"]
    Build --> Verify["Verificación<br/>automática"]
    Verify -->|rojo| Build
    Verify -->|verde| G4{{"Gate vista previa"}}
    G4 --> Pub([Publicado])
```

1. **Relevamiento.** Abrís la carpeta del cliente en VS Code y SpecMate **busca antes de
   preguntar**: manual de marca, logo, fotos, textos y precios. Infiere el rubro, el
   objetivo del sitio y el tono, y solo pregunta lo que falta. Google Maps pre-llena y
   cruza datos, pero lo que se publica es lo que confirma el cliente, porque sus
   términos no permiten copiar su contenido.
2. **Gate de datos.** Cada dato aparece con su fuente; nada sigue hasta confirmarlo.
3. **Marca.** Tres paletas desde el logo (en claro y oscuro, con contraste verificado)
   y después tres combinaciones tipográficas. Si hay manual de marca, se usa el suyo.
4. **Bosquejos.** Tres composiciones con la marca ya fijada, en un link para mandarle
   al cliente.
5. **Construcción.** Un sitio Astro estático, con tests primero y todo el contenido
   escapado.
6. **Verificación.** Corren todos los controles de abajo; uno solo en rojo frena todo.
7. **Gate de vista previa.** Con tu aprobación, se publica en Cloudflare.

## Qué controla antes de publicar

| Control | Umbral |
|---|---|
| Datos del negocio | 100 % con fuente y confirmación; 0 texto de relleno |
| Inyección de código | 0 `<script>`, `<style>` o `on*=` inline; `set:html` prohibido |
| Headers | CSP sin `unsafe-inline` ni `unsafe-eval`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Dependencias y secretos | `npm audit` sin altas ni críticas; secretlint sin hallazgos |
| Orígenes externos | Solo los de la lista blanca del brief |
| Comportamiento | Playwright en 360, 768 y 1280 px, sin errores de consola |
| Accesibilidad | axe-core sin violaciones serias ni críticas |
| Lighthouse móvil | Rendimiento ≥ 90; accesibilidad, buenas prácticas y SEO ≥ 95 |
| HTML, enlaces e imágenes | Sin errores; sin enlaces internos rotos; imágenes ≤ 250 KB y con `alt` |

El detalle y el porqué de cada control: [ADR-0030](docs/adr/ADR-0030-stack-y-barandas-de-los-sitios.md).

## Stack

| | |
|---|---|
| **Sitios** | Astro 7 estático · CSS con los tokens del cliente · fuentes autoalojadas · Cloudflare |
| **Verificación** | Playwright · axe-core · Lighthouse CI · html-validate · linkinator · secretlint |
| **Herramienta** | Node.js 24 · TypeScript 7 · npm workspaces · esbuild · Biome · Vitest · Zod |
| **Agentes** | Claude Code con la capa `.agents/`, neutral al proveedor |

## Roadmap

| Fase | Qué trae | Épicas |
|---|---|---|
| **F0 · Spike** ← *acá estamos* | Un sitio real hecho a mano con el flujo, horas medidas, Places y CSP probados | [E0](https://github.com/amiretti/SpecMate/issues/1) |
| **F1 · MVP** | Plantilla segura, relevamiento guiado, marca y bosquejos, construcción, verificación y publicación | E1 a E5 |
| **F2 · Uso real** | Tres clientes de Harvi publicados y medidos | E6 |
| **Después** | Formulario con backend · mantenimiento y re-auditoría · edición por el cliente · producto para otras agencias · relevamiento hecho por el cliente | E7 a E11 |

**El MVP se mide en sitios reales:** 3 publicados, la mitad de horas que hoy, 0 datos sin
confirmar y Lighthouse en verde. Detalle en [docs/mvp.md](docs/mvp.md).

## Principios

La [constitución](.specify/memory/constitution.md) manda sobre todo lo demás. En corto:

- **Nada se publica sin fuente.**
- **Verificable o no está hecho.** El test va primero y el rojo se observa.
- **Lo publicado no ejecuta nada ajeno.**
- **Simplicidad primero:** HTML estático, sin backend ni CMS hasta que un cliente lo
  necesite.
- **Lo que se resuelve sin modelo, se resuelve sin modelo.**

Orden de autoridad: **ADR > spec > criterio propio.**

## Estructura del repo

```
packages/
  cli/          specmate new · brief · verify · publish
templates/
  site/         plantilla de cada sitio de cliente (Astro, CSP, tests)
.agents/        roles, skills y conectores (fuente neutral al proveedor)
.specify/       Spec Kit: constitución, plantillas y preset
specs/          una carpeta por historia
docs/           MVP, ADR y kit
tools/          proyector a cada proveedor y conectores
```

## Trabajar en el repo

SpecMate se construye con su propio kit de agentes, hoy sobre Claude Code.

**Requisitos:** Node.js 24 (`nvm use` toma el `.nvmrc`), Git y
[Claude Code](https://docs.claude.com/en/docs/claude-code/overview).

```bash
npm install
node tools/project.mjs claude   # genera la configuración de Claude Code desde .agents/
claude
```

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila los paquetes |
| `npm test` | Corre los tests |
| `npm run lint` | Lint y formato |
| `node tools/project.mjs claude --check` | Avisa si la configuración generada quedó vieja |

> [!NOTE]
> `CLAUDE.md`, `.claude/` y `.mcp.json` **son generados**: se editan los fuentes en
> `.agents/` y se vuelve a proyectar. Las reglas para agentes están en
> [AGENTS.md](AGENTS.md).

**Convenciones:** ramas `###-slug`, commits `<type>: <desc>`, PR con `Closes #n`.

## Documentación

| Documento | Qué tiene |
|---|---|
| [docs/mvp.md](docs/mvp.md) | Brief del MVP, flujo, métricas, spike y épicas |
| [docs/adr/](docs/adr/) | Decisiones de arquitectura; el pivot es la [ADR-0029](docs/adr/ADR-0029-pivot-sitios-para-negocios.md) |
| [Constitución](.specify/memory/constitution.md) | Principios, stack y barandas |
| [docs/kit.md](docs/kit.md) | Cómo funciona el kit de agentes |
| [AGENTS.md](AGENTS.md) | Instrucciones para cualquier agente que trabaje en el repo |

## Licencia

Sin licencia por ahora: **todos los derechos reservados**. El código es visible, pero no
se puede usar, copiar ni redistribuir sin permiso.

<div align="center">
<sub>Hecho en Santa Fe, Argentina, por <a href="https://github.com/amiretti">Andy Miretti</a> y el equipo de Harvi.</sub>
</div>
