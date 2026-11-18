// TemplateSource (US-13 §6, plan decision 5): the CLI is not published yet, so it finds `templates/site` in this repo
// by walking up from its own module (the depth differs between src/ under Vitest and the bundled dist/index.js).
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TemplateSource } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

export class TemplateNotFoundError extends SpecmateError {}

const MAX_LEVELS = 8;

export function templateSourceFrom(moduleUrl: string): TemplateSource {
  return {
    async locate() {
      let dir = path.dirname(fileURLToPath(moduleUrl));
      for (let level = 0; level < MAX_LEVELS; level += 1) {
        const candidate = path.join(dir, 'templates', 'site');
        try {
          await access(path.join(candidate, 'package.json'));
          return candidate;
        } catch {
          const parent = path.dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }
      }
      throw new TemplateNotFoundError(
        `templates/site not found above ${path.dirname(fileURLToPath(moduleUrl))}: run specmate from the SpecMate repo`,
      );
    },
  };
}
