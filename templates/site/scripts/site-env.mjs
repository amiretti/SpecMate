// Build inputs read from the environment (astro.config.mjs): SITE_DATA picks the site's data module (`@data`),
// SITE_OUT the output dir. Used to build the example variants and the test fixtures from the same code
// (scripts/build-variants.mjs); by default, the address example into dist/. Kept apart from the config so the
// type-checked config needs no Node type definitions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Absolute path of the data module behind `@data`. */
export const dataModule = path.resolve(root, process.env.SITE_DATA ?? 'src/data/examples/address.ts');

/** Output directory: SITE_OUT (absolute) or ./dist. */
export const outDir = process.env.SITE_OUT ? path.resolve(root, process.env.SITE_OUT) : './dist';
