# packages/daemon

Núcleo local de SpecMate (ADR-025): orquesta agentes, registra cada paso en el event
store, aplica gates, piso de autonomía y presupuesto, y expone el MCP de control.

## Invariantes

- **Solo local:** escucha en una named pipe (Windows) o un socket Unix, nunca en la red,
  y rechaza toda conexión sin token.
- **Nada específico de un proveedor fuera de su adaptador** (`AgentRuntime`, ADR-002).
- **Lo que no necesita un modelo no llama a un modelo** (nivel 0, ADR-011).
- Zonas críticas: gates y piso, autenticación local, presupuesto y checkpoint
  (`project-guard` §5).

Todavía sin código: arranca con la prueba mínima del spike (US-04).
