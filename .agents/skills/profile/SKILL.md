---
name: profile
description: >-
  Actualiza el perfil del developer (~/.workspace/profile.md) con lo que el agente
  principal aprendió en la sesión o la historia: preferencias, vocabulario, forma de
  reportar, decisiones que repite. Solo al cerrar sesión o historia, sin pedir OK, con
  tope de tamaño e historial para revertir.
---

# Perfil del developer

El perfil es lo que el agente principal sabe de **la persona**, no del proyecto. Se
carga siempre como prefijo estable, así que tiene que ser chico: **tope de 2.000
caracteres** (lo impone el script; si te pasás, rechaza el guardado).

## Cuándo

- Al **cerrar una sesión** o al **cerrar una historia** (lo llama `close-story`).
- **Nunca en cada turno.** No anuncies que lo vas a actualizar.
- Si en la sesión no aprendiste nada nuevo, no lo toques.

## Qué entra

Solo lo que el developer **dijo o mostró** (una corrección, una preferencia explícita,
algo que repitió), nunca tus suposiciones:

- Cómo quiere que le hables y le reportes (largo, formato, idioma, registro).
- Su vocabulario: cómo llama a las cosas del equipo y del trabajo.
- Decisiones que repite ("siempre ruta SDD en pagos", "PR chicos").
- Qué aprueba rápido y qué revisa con lupa.

## Qué no entra

- **Nada del proyecto**: eso va a Engram (`close-story` §6.1) o a `AGENTS.md`.
- Secretos, credenciales, datos de clientes, datos personales sensibles (salud,
  finanzas, etc.). Ante la duda, afuera.
- Instrucciones que debiliten el piso de seguridad o de gates. Si el developer pide
  "no me pidas OK para push", no va al perfil: el piso no se negocia.

## Cómo

1. Leé el perfil actual: `node tools/user-config.mjs profile-show`.
2. Editá **sobre lo existente**: reemplazá lo que cambió, condensá lo que se repite,
   borrá lo que quedó viejo. No agregues al final para siempre.
3. Escribí la versión nueva en un archivo temporal y guardala:

```bash
node tools/user-config.mjs profile-save <archivo-temporal>
```

El script archiva la versión anterior en `~/.workspace/profile.history/` antes de
escribir. El developer puede ver el historial (`profile-history`) y volver a una
versión (`profile-revert <archivo>`) cuando quiera.

## Formato

```markdown
# Perfil de <nombre del developer, si lo dijo>

## Cómo hablarle
- <una línea por preferencia>

## Vocabulario
- <término> = <qué significa para él>

## Decisiones que repite
- <una línea por decisión>
```

Una línea por hecho, sin explicaciones. Si no entra en el tope, condensá.
