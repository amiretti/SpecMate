# packages/extension

Extensión de VS Code (ADR-026): cliente del daemon. Chat con el agente principal,
agentes en vivo, bandeja de gates con el diff nativo, bandeja de no leídos y consumo.

## Invariantes

- **Sin lógica de negocio:** decide el daemon; la extensión muestra y envía.
- Terminal, edición y diffs los pone VS Code: no se reconstruyen.
- Funciona en VS Code y sus derivados (Open VSX): solo API pública de extensiones.

Todavía sin código: arranca con la prueba mínima del spike (US-04).
