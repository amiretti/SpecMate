# ADR-0032 — Opciones combinables: tres sitios completos armados con partes intercambiables

- **Estado:** Aceptada (2026-11-11, Andy)
- **Fecha:** 2026-11-11
- **Reemplaza:** los pasos 8, 9 y 11 de ADR-0031 (paletas, tipografías y bosquejos como gates separados)
- **Afecta a:** ADR-0031, épicas E3 y E4, `docs/mvp.md`, `templates/site`

## Contexto

Andy fijó el objetivo con números: hoy un sitio lleva **unas 24 horas de desarrollo** y
**una o dos semanas, a veces más**, de idas y vueltas. Lo que quiere es que la
intervención humana se reduzca a **los datos del principio y elegir una opción al
final**. También fijó un requisito nuevo: el cliente puede pedir **un mix de las tres**,
una opción nueva o cambios sobre alguna, y el producto tiene que poder dárselos.

ADR-0031 tenía cuatro gates (datos, marca, bosquejo y vista previa). Eso son cuatro
idas y vueltas con el cliente, justo lo que hoy estira el calendario. Y si cada opción
fuera un sitio generado libremente, un mix obligaría a regenerar todo y volver a
verificarlo.

## Decisión

1. **Dos intervenciones humanas.** Al principio, confirmar los datos del negocio y el
   dominio. Al final, elegir. Paleta, tipografía y composición las decide el sistema,
   con motivo escrito, desde el manual de marca si existe y si no desde el logo, el
   rubro, el objetivo y el tono. El operador puede intervenir en cualquier paso, pero
   ningún paso lo espera.
2. **Las tres opciones son sitios completos, funcionales y ya verificados**, no
   bosquejos. Cada uno tiene todo el contenido real y su vista previa publicada en
   una URL de prueba. Pasaron los controles de ADR-0030 antes de que el cliente los
   vea. Elegir una opción es elegir lo que se publica.
3. **Una opción es una combinación de ejes independientes** sobre un mismo contenido:

   | Eje | Qué es | De dónde sale |
   |---|---|---|
   | Paleta | Tokens de color en claro y oscuro, con contraste verificado | Manual de marca o logo |
   | Tipografía | Par de familias de licencia libre, autoalojadas | Manual de marca o rubro y tono |
   | Composición | La secuencia de secciones y la **variante** de cada una | Rubro, objetivo y material disponible |
   | Contenido | Textos, fotos y datos confirmados | El relevamiento; **compartido por las tres** |

   Las tres opciones se diferencian a propósito, por ejemplo una sobria, una cálida y
   una audaz. No son tres variaciones mínimas de la misma.
4. **Biblioteca de secciones.** Cada tipo de sección tiene variantes en componentes
   Astro parametrizados solo por tokens y contenido: portada, servicios, sobre
   nosotros, equipo, galería, precios, horarios, ubicación, testimonios, preguntas
   frecuentes y contacto. Cada variante se verifica una vez en la biblioteca
   (accesibilidad, CSP, responsive, peso) y otra vez en cada sitio. **La biblioteca es
   el activo principal del producto.**
5. **Qué se puede pedir después de ver las opciones:**

   | Pedido | Cómo se resuelve | Modelo |
   |---|---|---|
   | **Mix** ("la portada de la 2 con los colores de la 3") | Se recombinan ejes y variantes ya existentes | No: determinista, minutos |
   | **Ajuste** ("otra foto arriba", "sacá precios", "más grande el logo") | Se edita la composición o el contenido en `relevamiento.json`, nunca el HTML a mano | Sí, acotado |
   | **Opción nueva** | Otra combinación o una variante nueva de sección | Sí |
   | **Algo que la biblioteca no tiene** | Una sección a medida, marcada como tal, con los mismos controles | Sí, y se cotiza |

6. **Todo se versiona.** Cada opción y cada cambio es una versión nueva (`v1-a`,
   `v1-b`, `v1-c`, `v2`…) con su propia URL de vista previa y la lista de qué cambió.
   Nada se pisa, y siempre se puede volver a una versión anterior.
7. **Agnóstico al cliente.** La biblioteca, las reglas por rubro y los tests son
   genéricos: ningún nombre, dato ni material de un cliente real entra en el repo de
   SpecMate. Lo de cada cliente vive en su carpeta y en el repo de su sitio. Los tests
   y ejemplos usan clientes inventados y marcados como tales (constitución, principio
   XII).
8. **Publicar sigue siendo humano** (piso de la constitución): la elección explícita
   del cliente, transmitida por Harvi, es la aprobación. Lo que se publica es
   exactamente la versión elegida, ya verificada; no se reconstruye.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Generar HTML libre por opción | Un mix exige regenerar todo; cada sitio es un caso nuevo para los controles; tres veces más tokens |
| Plantillas cerradas, una por rubro | Todos los sitios del mismo rubro se ven iguales; no hay mix posible |
| Gates de paleta, tipografía y bosquejo (ADR-0031) | Cuatro idas y vueltas con el cliente, justo lo que hoy estira el calendario |
| Bosquejos no funcionales | El cliente aprueba algo distinto de lo que se publica, y después de elegir queda trabajo por hacer |

## Consecuencias

**Positivas:**
- El cliente decide viendo su sitio real y puede mezclar sin costo.
- Los controles se prueban sobre partes conocidas.
- Cada sitio mejora la biblioteca para el siguiente.

**Negativas (costo asumido):**
- La biblioteca es una inversión grande antes del primer sitio automático (E4). El
  spike la arranca con un conjunto mínimo de secciones genéricas.
- Riesgo de "look de plantilla": se compensa con variantes por sección, tokens por
  cliente y secciones a medida cuando hagan falta.
- Construir y verificar tres sitios completos cuesta más tiempo de máquina que tres
  bosquejos. Es tiempo sin intervención humana, y el contenido y las imágenes se
  procesan una sola vez.
- Que el sistema elija paleta y tipografía sin preguntar puede errar. El cliente lo
  corrige pidiendo un mix o un ajuste, no en un gate intermedio.

**Revisar cuando:** el spike mida cuántos pedidos de mix o de opción nueva hay por
cliente y cuánto cuesta cada uno.
