# Decisiones de arquitectura

Formato Nygard (skill `adr`). Las decisiones ADR-001 a ADR-026 se tomaron en los
documentos de arquitectura v1 y v2 y se migran acá en US-05, al cerrar el spike. Las
vigentes más importantes:

| ADR | Decisión |
|---|---|
| 002 | Runtimes delegados detrás de `AgentRuntime` (Agent SDK, Codex app-server) |
| 003 | La app nunca manipula tokens de suscripción |
| 013 | Capa de configuración neutral `.agents/` |
| 014 | Niveles de autonomía con piso |
| 016 | Spec Kit con preset propio que compone sobre el core |
| 019 | Un interlocutor propio, con nombre elegido por cada usuario |
| 025 | Núcleo en un daemon local; interfaz como extensión de VS Code |
| 026 | Terminal, edición y diffs los pone el editor anfitrión |
| [027](ADR-0027-flujo-proporcional.md) | Flujo proporcional: ODD por defecto, SDD cuando el riesgo lo pide |
| [028](ADR-0028-stack-tecnologico.md) | Stack tecnológico del MVP |
