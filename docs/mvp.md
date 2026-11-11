# MVP v0.2 — Sitios para negocios

> Reemplaza al MVP v0.1 (workspace general) desde [ADR-0029](adr/ADR-0029-pivot-sitios-para-negocios.md).

**Para quién:** Harvi, para vender y entregar sitios a negocios que necesitan presencia
en línea: comercios, profesionales, clubes, mutuales, gastronomía. Lo usa Andy en
Windows, con su suscripción de Claude.

**Hipótesis:** dada una carpeta con el material del cliente, la URL de Google Maps y
algunas referencias, SpecMate entrega un sitio estático publicable, con datos
confirmados, controles de seguridad y calidad en verde y un diseño que el cliente
acepta, en **la mitad de las horas** que lleva hoy hacerlo a mano.

**Entra:**
- one page, landing o sitio de pocas páginas, estático (Astro);
- contacto por enlaces (teléfono, mail, WhatsApp);
- botón "Cómo llegar" a Google Maps;
- SEO local;
- publicación en Cloudflare;
- tres gates humanos: datos, diseño y vista previa;
- verificación automática que bloquea la publicación.

**No entra:** formulario con backend (E7) · mantenimiento y re-auditoría (E8) · edición
por el cliente o CMS (E9) · tienda, reservas o pagos · producto para otras agencias (E10).

## El flujo

```mermaid
flowchart LR
    In["Carpeta del cliente<br/>+ URL de Maps<br/>+ referencias"] --> Brief["Brief verificable<br/>cada dato con su fuente"]
    Brief --> G1{{"Gate 1<br/>datos confirmados"}}
    G1 --> Arte["2–3 direcciones<br/>de arte"]
    Arte --> G2{{"Gate 2<br/>se elige una"}}
    G2 --> Build["Sitio estático<br/>tests primero"]
    Build --> Verify["Verificación<br/>seguridad · a11y · rendimiento · SEO"]
    Verify -->|rojo| Build
    Verify -->|verde| G3{{"Gate 3<br/>vista previa"}}
    G3 --> Pub([Publicado])
```

## Cómo sabemos que funcionó

| Métrica | Objetivo |
|---|---|
| Sitios reales publicados con el flujo | 3, de clientes distintos |
| Horas por sitio, de la carpeta a la publicación | ≤ 50 % de las de hoy ([HORAS ACTUALES POR SITIO], a medir en el spike) |
| Datos publicados sin fuente ni confirmación | 0 |
| Controles de ADR-0030 en rojo al publicar | 0 (lo impone `verify`) |
| Lighthouse móvil | Rendimiento ≥ 90; accesibilidad, buenas prácticas y SEO ≥ 95 |
| Clientes que eligen una dirección de arte sin pedir rediseño | 2 de 3 |
| Rondas de cambios del cliente después del Gate 3 | 1 o menos por sitio |

## Spike de la fase 0

| Incógnita | Experimento | Cuenta como sí | Si la respuesta es no |
|---|---|---|---|
| **¿Sale un sitio publicable con el flujo hecho a mano, y en cuántas horas?** | Un cliente real de Harvi de punta a punta con Claude Code, las skills de diseño y una plantilla mínima, midiendo horas por etapa | Sitio publicado que el cliente acepta, con horas registradas por etapa | Se revisa qué etapa no rinde antes de automatizar |
| **¿La API de Places sirve para pre-llenar, dentro de sus términos y a costo razonable?** | Pedir los detalles de 3 negocios reales; anotar campos útiles, costo por pedido y lo que exigen los términos | Nombre, dirección, horarios, teléfono y ubicación por menos de USD 0,05 por sitio, sin guardar su contenido | El brief se llena solo con la carpeta y la confirmación del cliente |
| **¿La dirección de arte generada es vendible?** | Tres direcciones para el cliente del spike, con portada, paleta y tipografía | El cliente elige una sin pedir rediseño | El Gate 2 pasa a ser trabajo de diseño humano con apoyo de IA |
| **¿Astro con CSP estricta pasa los controles de ADR-0030?** | Plantilla mínima con `_headers`, sin inline, medida con Lighthouse y axe | Todos los umbrales de ADR-0030 en verde | Se revisa ADR-0030 antes de E1 |

Timebox: dos semanas part-time. Entregable: `docs/spike/informe.md` con una sección
por incógnita, las horas medidas y los cambios que piden a las ADR.

## Épicas

**MVP:** E0 Spike · E1 Plantilla segura del sitio · E2 Ingesta y brief verificable ·
E3 Dirección de arte y sistema de diseño del cliente · E4 Construcción del sitio ·
E5 Verificación y publicación · E6 Tres clientes reales.

**Después del MVP:** E7 Formulario de contacto con backend · E8 Mantenimiento y
re-auditoría · E9 Edición por el cliente · E10 Producto para otras agencias.

El detalle de cada una vive en [su issue](https://github.com/amiretti/SpecMate/issues?q=label%3Aépica+is%3Aopen).

Una épica en curso a la vez. E1 va antes que todo lo demás porque fija lo que
`verify` controla; E6 usa el producto en clientes reales y mide.
