import { defineConfig } from 'vitest/config';

// `npm test`: unit, architecture and integration tests in seconds. The end-to-end check of AC-2 (npm ci, build and
// the template's own suite inside a created repo) takes minutes and needs network: `npm run test:e2e` (plan decision 7).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], exclude: ['test/e2e/**', 'test/fixtures/**'], testTimeout: 60_000 },
});
