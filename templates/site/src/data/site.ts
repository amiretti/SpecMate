// The validated site data every page renders from (FR-004). `@data` is the data module chosen at build time
// (astro.config.mjs); parseSite throws naming the bad field, which fails the build.
import data from '@data';
import { parseSite } from '../lib/site.ts';

export const site = parseSite(data);
