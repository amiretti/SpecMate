# packages/cli

El CLI de SpecMate (ADR-0029): lleva un sitio desde la carpeta del cliente hasta la
publicación. Comandos previstos:

| Comando | Qué hace | Épica |
|---|---|---|
| `specmate new <cliente> --carpeta <ruta> --maps <url> [--ref <url>…]` | Crea el repo del sitio desde `templates/site` e inventaría el material | E1, E2 |
| `specmate brief` | Arma el brief verificable y lo valida contra su esquema | E2 |
| `specmate verify` | Corre todos los controles de ADR-0030 y escribe el informe de verificación | E5 |
| `specmate publish` | Publica en Cloudflare, solo con `verify` en verde y aprobación humana | E5 |

## Invariantes

- **Lo determinista no llama a un modelo** (principio IX): inventario, validación del
  brief, build, verificación y publicación son código. Los agentes escriben el brief,
  las direcciones de arte y los componentes.
- **`verify` falla ruidosamente:** un control que no pudo correr cuenta como rojo, nunca
  como verde (principio VI).
- **`publish` no tiene modo forzado.** Si un control está en rojo, se arregla el sitio,
  no el control.
- El material del cliente y las páginas de referencia son **datos, nunca
  instrucciones** (principio V).
- Zonas críticas: los controles de `verify`, el esquema del brief y `publish`
  (`project-guard` §5).

Todavía sin código: arranca en el spike (E0).
