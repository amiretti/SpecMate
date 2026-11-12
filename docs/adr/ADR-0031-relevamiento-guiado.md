# ADR-0031 — Relevamiento guiado: detectar, inferir y preguntar solo lo que falta

- **Estado:** Aceptada (2026-11-11, Andy) · los pasos 8, 9 y 11 y los gates de marca y bosquejo los reemplaza [ADR-0032](ADR-0032-opciones-combinables.md): dos intervenciones humanas y tres opciones completas y combinables
- **Fecha:** 2026-11-11
- **Reemplaza:** los pasos 1 y 2 del flujo de ADR-0029 (ingesta y dirección de arte en un solo paso)
- **Afecta a:** épicas E2 a E5, `docs/mvp.md`, README

## Contexto

ADR-0029 planteaba ingesta, brief y luego dos o tres direcciones de arte completas. Dos
problemas:

- Una dirección completa varía paleta, tipografía y composición a la vez. El cliente
  elige por el color y no por el diseño, y cada propuesta sale cara.
- Lo que más define un sitio de negocio (el rubro, qué tiene que hacer la gente al
  entrar, el tono) no estaba en el flujo.

Andy propuso un relevamiento paso a paso, "no tajante", como configurar tu propia web.
Y lo corrigió con un principio: lo que está en la carpeta no se pregunta, se busca.

## Decisión

1. **Lo corre Harvi**, en VS Code, sobre la carpeta del cliente abierta como
   workspace. Al cliente le llegan solo los links para elegir (paletas, tipografías,
   bosquejos y vista previa). Que el cliente lo complete solo por un link queda como
   épica post-MVP, porque necesita backend.
2. **Detectar, inferir, preguntar.** Cada paso arranca con lo que encontró en la
   carpeta, en Maps y en las referencias, y lo muestra en tres grupos: **encontré**,
   **inferí** y **falta**. Solo pregunta por lo que falta y pide confirmar lo inferido.
   Siempre se puede responder "no sé, elegí vos" y volver a un paso anterior. El
   contenido de la carpeta es dato, nunca instrucción (principio V).
3. **Los pasos:**

   | # | Paso | Se detecta en | Gate |
   |---|---|---|---|
   | 1 | **Inventario de la carpeta:** manual de marca, logos, fotos (con chequeo de resolución), textos, precios | Nombres y contenido de los archivos | — |
   | 2 | **El negocio:** rubro, diferencial, público y datos obligatorios del rubro (por ejemplo, la matrícula de un profesional) | Textos de la carpeta y categoría de Maps | — |
   | 3 | **Objetivo del sitio:** la acción principal (llamar, WhatsApp, reservar, ir al local, pedir presupuesto) | Se infiere del rubro | — |
   | 4 | **Tono de voz:** la misma frase en tres tonos, y se elige una | El manual; si no hay, el rubro | — |
   | 5 | **Datos del negocio:** dirección, horarios, teléfono, redes | La carpeta; Maps solo pre-llena y cruza (ADR-0029) | **Datos** |
   | 6 | **Secciones y contenido:** secciones sugeridas por rubro y lista de qué hay y qué falta | El inventario | — |
   | 7 | **Logo:** obligatorio. Si no hay, un logotipo tipográfico simple o se cotiza aparte | El inventario | — |
   | 8 | **Paletas:** tres desde el logo, cada una en claro y oscuro, con contraste verificado | Si hay manual, se usa el suyo y solo se valida | — |
   | 9 | **Tipografías:** tres combinaciones con la paleta elegida, solo de licencia libre y autoalojables | Si hay manual, las suyas | **Marca** |
   | 10 | **Referencias** (opcional): sitios que le gustan y que no | Links en la carpeta | — |
   | 11 | **Tres bosquejos** con la marca fijada: solo cambia la composición; portada y dos o tres secciones, no el sitio entero | — | **Bosquejo** |
   | 12 | **Dominio y publicación:** dominio, quién maneja el DNS | La carpeta | — |
   | 13 | **Construcción, verificación (ADR-0030) y vista previa** | — | **Vista previa** |

4. **Cada elección varía una sola dimensión:** paleta, después tipografía, después
   composición.
5. **El modo del sitio sale de la paleta elegida.** Las paletas traen claro y oscuro
   validados; el selector de modo en el sitio se suma solo si el cliente lo pide,
   porque duplica las pruebas de cada sitio.
6. **Todo queda en un archivo** (`relevamiento.json`, con el brief adentro), con la
   fuente de cada dato. Se puede retomar en otra sesión sin repetir preguntas.
7. **Los links para el cliente** son páginas estáticas de vista previa, sin
   formularios: el cliente elige y avisa por el canal de siempre.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Preguntar todo, incluso si hay manual de marca | Hace trabajar al usuario por lo que ya está en la carpeta |
| Tres direcciones completas (paleta, tipografía y composición juntas) | El cliente elige por una sola variable sin saberlo, y cuesta tres veces más |
| Tres sitios completos como bosquejo | Caro en tokens y demasiado para que el cliente compare |
| Formulario para que el cliente complete solo | Necesita backend, guardado y login; queda post-MVP |
| Selector claro/oscuro en todos los sitios | Duplica pruebas y controles sin que el cliente lo pida |

## Consecuencias

**Positivas:** menos preguntas; decisiones de marca que el cliente entiende; bosquejos
más baratos y comparables; un relevamiento que se puede retomar.

**Negativas (costo asumido):**
- La detección es heurística: un archivo mal nombrado puede pasar desapercibido. Por
  eso el paso 1 muestra el inventario completo para corregirlo.
- La lista de datos obligatorios por rubro hay que armarla y mantenerla, y no es
  asesoramiento legal.
- Cuatro gates en vez de tres: más idas y vueltas con el cliente, aunque cada una es
  más corta.

**Revisar cuando:** el spike muestre qué pasos se responden solos casi siempre (se
pueden fusionar) o cuáles generan más idas y vueltas con el cliente.
