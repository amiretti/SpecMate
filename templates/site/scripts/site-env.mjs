// Build inputs read from the environment (astro.config.mjs): SITE_DATA picks the site's relevamiento.json (by
// default the one at the repo root, US-14 FR-001), SITE_OUT the output dir. Used to build the example variants
// and the test fixtures from the same code (scripts/build-variants.mjs). Kept apart from the config so the
// type-checked config needs no Node type definitions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of the site repo: logo paths in the brief resolve against it. */
export const root = fileURLToPath(new URL('../', import.meta.url));

/** Absolute path of the relevamiento.json the site is built from. */
export const dataFile = path.resolve(root, process.env.SITE_DATA ?? 'relevamiento.json');

/** Output directory: SITE_OUT (absolute) or ./dist. */
export const outDir = process.env.SITE_OUT ? path.resolve(root, process.env.SITE_OUT) : './dist';
