// @ts-check
import { defineConfig } from 'astro/config';

// ADR-0030: static HTML, no client JS, nothing inline so the CSP needs no 'unsafe-inline'.
export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
