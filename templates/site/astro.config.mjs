// @ts-check
import { defineConfig } from 'astro/config';
import { dataFile, outDir, root } from './scripts/site-env.mjs';

// ADR-0030: static HTML, no client JS, nothing inline so the CSP needs no 'unsafe-inline'.
// The site is built from one relevamiento.json (US-14 FR-001): its path and the repo root reach src/data/site.ts as
// build-time constants; see scripts/site-env.mjs for SITE_DATA and SITE_OUT.
export default defineConfig({
  output: 'static',
  outDir,
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    define: {
      __SITE_DATA__: JSON.stringify(dataFile),
      __SITE_ROOT__: JSON.stringify(root),
    },
    build: {
      assetsInlineLimit: 0,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
