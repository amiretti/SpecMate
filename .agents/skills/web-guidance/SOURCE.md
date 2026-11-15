# Source

- Upstream: https://github.com/GoogleChrome/modern-web-guidance-src (paquete npm `modern-web-guidance`)
- Versión fijada: `1.0.0`, como `devDependency` exacta en el `package.json` raíz, con `package-lock.json`
- Licencia: Apache-2.0 (solo corre al construir; no se publica nada del paquete)
- Revisado: 2026-11-13, lead, revisión de cadena de suministro sobre el tarball sin ejecutarlo
  (veredicto: incorporar con cortes, ADR-0036).
- Cortes respecto del upstream:
  - no se usa su `SKILL.md`: esta skill lo reemplaza con reglas de SpecMate;
  - no se usa `install` (corre `npx -y skills add` sin versión fijada, a nivel global);
  - nunca `@latest`: se llama al binario local con `--no-install`;
  - telemetría siempre apagada (`DISABLE_TELEMETRY=1`): por defecto manda a Google el texto
    de cada búsqueda.
- La skill `chrome-extensions` del paquete no se usa.
- Actualizar: solo con aprobación humana, una revisión nueva y la versión nueva fijada.
