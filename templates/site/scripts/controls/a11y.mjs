// Control "Accesibilidad" (ADR-0030, US-12 FR-002): axe-core "en cada página y ancho" (360, 768 and 1280 px) with
// the real `_headers` CSP. Threshold: "0 violaciones *serious* o *critical*". A control that cannot measure fails.
// Usage: node scripts/controls/a11y.mjs <buildDir>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { serve } from '../../test/lib/serve.mjs';
import { firstLine, openBrowser, WIDTHS } from './behavior.mjs';

const BLOCKING = ['serious', 'critical'];

/** axe on one page at one width; returns the blocking violations as one line each. */
async function audit(browser, origin, page, width) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  try {
    const tab = await context.newPage();
    await tab.goto(`${origin}${page.url}`, { waitUntil: 'load' });
    const { violations } = await new AxeBuilder({ page: tab }).analyze();
    return violations
      .filter((v) => BLOCKING.includes(v.impact))
      .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  } finally {
    await context.close();
  }
}

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir, { executablePath } = {}) {
  const { pages, browser, failure } = await openBrowser(dir, { executablePath });
  if (failure) return { ok: false, violations: [failure] };
  const server = await serve(dir);
  const violations = [];
  try {
    for (const width of WIDTHS) {
      for (const page of pages) {
        const at = `${page.rel} @ ${width}px`;
        try {
          for (const v of await audit(browser, server.url, page, width)) violations.push(`${at}: ${v}`);
        } catch (error) {
          violations.push(`${at}: could not measure: ${firstLine(error)}`);
        }
      }
    }
  } finally {
    await server.close();
    await browser.close();
  }
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations } = await run(dir);
  for (const v of violations) console.error(`check:a11y FAIL ${v}`);
  console.log(
    ok
      ? `check:a11y OK: 0 serious or critical axe violations on every page at ${WIDTHS.join(', ')} px`
      : `check:a11y: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
