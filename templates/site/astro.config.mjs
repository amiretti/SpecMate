// @ts-check
import { defineConfig } from 'astro/config';
import { dataModule, outDir } from './scripts/site-env.mjs';

// ADR-0030: static HTML, no client JS, nothing inline so the CSP needs no 'unsafe-inline'.
// `@data` is the site's single data module (FR-004); see scripts/site-env.mjs for SITE_DATA and SITE_OUT.
export default defineConfig({
  output: 'static',
  outDir,
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    resolve: {
      alias: [{ find: /^@data$/, replacement: dataModule }],
    },
    build: {
      assetsInlineLimit: 0,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
