# Decisiones de arquitectura

Formato Nygard (skill `adr`). Las decisiones ADR-001 a ADR-026 se tomaron en los
documentos de arquitectura v1 y v2. Desde el pivot (ADR-0029), las que quedan vigentes
son las del kit y el proceso; las del workspace general (019 a 026) quedan reemplazadas.

| ADR | Decisión |
|---|---|
| 002 | Runtimes delegados detrás de `AgentRuntime` (Agent SDK, Codex app-server) |
| 003 | La app nunca manipula tokens de suscripción |
| 013 | Capa de configuración neutral `.agents/` |
| 014 | Niveles de autonomía con piso |
| 016 | Spec Kit con preset propio que compone sobre el core |
| 019–026 | Workspace general: interlocutor propio, router, canal móvil, daemon y extensión de VS Code · **reemplazadas por ADR-0029** |
| [027](ADR-0027-flujo-proporcional.md) | Flujo proporcional: ODD por defecto, SDD cuando el riesgo lo pide |
| [028](ADR-0028-stack-tecnologico.md) | Stack tecnológico del MVP · en parte reemplazada por ADR-0029 |
| [029](ADR-0029-pivot-sitios-para-negocios.md) | Pivot: de la carpeta del cliente a la web publicada |
| [030](ADR-0030-stack-y-barandas-de-los-sitios.md) | Stack y barandas de los sitios generados |
| [031](ADR-0031-relevamiento-guiado.md) | Relevamiento guiado: detectar, inferir y preguntar solo lo que falta |
| [032](ADR-0032-opciones-combinables.md) | Opciones combinables: tres sitios completos armados con partes intercambiables |
