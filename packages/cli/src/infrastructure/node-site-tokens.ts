// SiteTokens over node:fs (US-16 plan decision 1). The contract is the site's own src/lib/tokens.ts, loaded as is
// (Node strips its erasable types), so each client site keeps the contract of its template version and the CLI holds no
// copy. The site's src/data/tokens.json is replaced through a temp file in the same folder and a rename.
import { randomBytes } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SiteTokens } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

const module = (siteDir: string) => path.join(siteDir, 'src', 'lib', 'tokens.ts');

export const nodeSiteTokens: SiteTokens = {
  async contract(siteDir) {
    const file = module(siteDir);
    let loaded: { TOKEN_PATHS?: unknown; buildTokensCss?: unknown };
    try {
      loaded = await import(pathToFileURL(file).href);
    } catch (error) {
      throw new SpecmateError(`cannot load ${file}: ${(error as Error).message}`);
    }
    const { TOKEN_PATHS: paths, buildTokensCss: check } = loaded;
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string') || typeof check !== 'function')
      throw new SpecmateError(
        `${file} does not export TOKEN_PATHS and buildTokensCss: update it from templates/site/src/lib/tokens.ts`,
      );
    return { paths, check: (tokens) => void check(tokens) };
  },

  file(siteDir) {
    return path.join(siteDir, 'src', 'data', 'tokens.json');
  },

  async write(siteDir, tokens) {
    const file = this.file(siteDir);
    const temp = path.join(path.dirname(file), `.tokens.json.tmp-${randomBytes(6).toString('hex')}`);
    try {
      await writeFile(temp, `${JSON.stringify(tokens, null, 2)}\n`, { flag: 'wx' });
      await rename(temp, file);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  },
};
