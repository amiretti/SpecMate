// The validated site data every page renders from (US-14 FR-001): the relevamiento.json chosen at build time
// (astro.config.mjs, SITE_DATA), read and validated by loadRelevamiento, which throws naming the bad field or the
// missing file, so the build fails.
import { loadRelevamiento } from '../lib/site.ts';

export const site = loadRelevamiento(__SITE_DATA__, __SITE_ROOT__);
