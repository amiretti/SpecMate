# ADR-0034 — Clean Architecture por defecto en el código de SpecMate, con exclusiones explícitas

- **Estado:** Aceptada (2026-11-12, Andy: "si crees que necesitas alguno, llevalo a main directamente")
- **Fecha:** 2026-11-12 (rescata la decisión local del 2026-11-05, acotada al producto de ADR-0029)
- **Reemplaza:** el criterio "Clean Architecture donde hay dominio" del principio II de la constitución 2.0.0
- **Afecta a:** constitución (principio II), `packages/cli`, roles `developer` y `qa`

## Contexto

La constitución decía "Clean Architecture donde hay dominio" y dejaba afuera scripts,
sitios estáticos y CLIs chicos. Quién decidía si un código "tiene dominio" era el agente
que lo escribía, en el momento de escribirlo: justo lo que el orden de autoridad
(constitución y ADR > spec > criterio propio) quiere evitar.

El 2026-11-05 Andy aceptó, en su copia local, "Clean Architecture por defecto en todo lo
que genera el framework". Ese texto se escribió para el workspace general, antes del
pivot. Aplicado tal cual al producto actual, obligaría a meter capas en los sitios de
los clientes, que son HTML estático sin lógica de negocio.

`packages/cli` sí tiene dominio: el brief y sus reglas de confirmación, los controles de
verificación, las opciones combinables y las versiones. Y va a crecer.

## Decisión

1. **El código de SpecMate sigue Clean Architecture por defecto.** Dominio y casos de
   uso sin dependencias de infraestructura, frameworks ni UI; dependencias hacia
   adentro; lo externo entra por puertos: sistema de archivos, API de Places,
   Cloudflare, proveedores de IA.
2. **Se impone con un test de arquitectura** en cada paquete que no esté excluido, y ese
   test es gate.
3. **La salida es solo explícita:** por carpeta o paquete, en la lista de exclusiones de
   la constitución, o por historia, en su `feature.md` o spec. Siempre con motivo.
   Ningún agente la decide solo: si cree que hace falta, la propone en el gate.
4. **Exclusiones vigentes:**

   | Carpeta | Motivo |
   |---|---|
   | `tools/` | Scripts de proyección y configuración, sin dominio |
   | `templates/site/` y los sitios generados | HTML estático sin lógica de negocio; su estructura la fija ADR-0032 (biblioteca de secciones) |

5. Las capas que pide este principio **no cuentan como complejidad de más** para el
   principio I, que sigue rigiendo dentro de cada capa.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener "donde hay dominio", a criterio del agente | La decisión queda en el implementador y cada parte termina con una estructura distinta |
| Clean Architecture en todo lo generado, sitios incluidos (la versión del 05/11) | Un sitio estático con capas es sobreingeniería, y la paga cada cliente |
| Exclusiones implícitas por tipo de proyecto | Vuelve a dejar la interpretación al agente: ¿un CLI de 2.000 líneas es "chico"? |

## Consecuencias

**Positivas:** estructura predecible en el CLI; cambiar de hosting o de proveedor de IA
toca un adaptador y no el dominio; las excepciones quedan escritas.

**Negativas (costo asumido):** el CLI arranca con más estructura de la que necesita su
primera historia; hay que escribir y mantener el test de arquitectura.

**Cómo se impone:** el test de arquitectura de `packages/cli` es gate desde su primera
historia con código (E1); `qa` verifica que exista y pase.

**Revisar cuando:** el test frene historias por falsos positivos de forma recurrente, o
aparezca un paquete nuevo que no encaje en la regla ni en las exclusiones.
