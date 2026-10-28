---
description: No implementa en un solo agente. Delega en el lead, que despacha las tareas de tasks.md en paralelo, una por worktree, con su nivel de modelo.
---

## Entrada

```text
$ARGUMENTS
```

Este preset reemplaza la implementación de un solo agente de Spec Kit por la
orquestación multi-agente del workspace.

1. **Si sos el `lead`:** seguí la skill `tasking` desde el paso 3 (equipo), con
   `<feature>/tasks.md` como plan aprobado. Cada tarea `[P]` va a su propio worktree; las
   demás, en el orden del archivo. Al terminar cada tarea, marcala `[x]` en `tasks.md`.

2. **Si no sos el `lead`:** no implementes la feature entera. Reportá que la
   implementación la orquesta el lead y pará.

3. Antes de cerrar, corré `analyze` (consistencia spec ↔ plan ↔ tareas ↔ código) y
   reportá lo que no converja.
