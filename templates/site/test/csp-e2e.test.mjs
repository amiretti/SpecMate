// Rule (AC-11 CSP part, SC-001, ADR-0035 "Supuestos a probar"): with the real `_headers` CSP (script-src 'none'),
// Chromium and Firefox report 0 CSP violations on every page of the 3 variants, JSON-LD included. A positive
// control (an inline <script>) must produce a violation, so a green run proves the listener measures something.
// A missing browser fails the test (install: npx playwright install chromium firefox).
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium, firefox } from 'playwright';
import { VARIANTS } from './lib/build.mjs';
import { splitJsonLd } from './lib/jsonld.mjs';
import { serve } from './lib/serve.mjs';

const CSP_CONSOLE = /content[- ]security[- ]policy|\bCSP\b/i;

/** Opens `url`; returns its status, CSP header, violations (event + console) and the JSON-LD the DOM holds. */
async function visit(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleHits = [];
  page.on('console', (msg) => {
    if (CSP_CONSOLE.test(msg.text())) consoleHits.push(msg.text());
  });
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const response = await page.goto(url, { waitUntil: 'load' });
  // Violation reports are queued as tasks: give them a moment after load.
  await page.waitForTimeout(300);
  const result = {
    status: response?.status(),
    csp: response?.headers()['content-security-policy'],
    violations: await page.evaluate(() => window.__violations),
    consoleHits,
    jsonLd: await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => n.textContent)),
    title: await page.title(),
  };
  await context.close();
  return result;
}

for (const [label, engine] of [
  ['Chromium', chromium],
  ['Firefox', firefox],
]) {
  describe(`${label}: CSP with JSON-LD`, { concurrency: false }, () => {
    let browser;
    before(async () => {
      browser = await engine.launch();
    });
    after(async () => {
      await browser?.close();
    });

    it('positive control: an inline <script> is blocked and reported', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'site-csp-control-'));
      await cp(VARIANTS.address.out, dir, { recursive: true });
      const index = path.join(dir, 'index.html');
      const html = await readFile(index, 'utf8');
      await writeFile(index, html.replace('</body>', '<script>document.title = "inline ran";</script></body>'));
      const server = await serve(dir);
      try {
        const result = await visit(browser, `${server.url}/`);
        assert.notEqual(result.title, 'inline ran', 'the inline script must not run');
        assert.ok(result.violations.length + result.consoleHits.length > 0, 'the violation must be reported');
      } finally {
        await server.close();
      }
    });

    for (const [name, target] of Object.entries(VARIANTS)) {
      it(`${name}: home and 404 load with 0 CSP violations; the JSON-LD block is intact`, async () => {
        const server = await serve(target.out);
        try {
          const home = await visit(browser, `${server.url}/`);
          assert.equal(home.status, 200);
          assert.equal(home.csp, server.headers['content-security-policy']);
          assert.match(home.csp, /script-src 'none'/);
          assert.deepEqual(home.violations, []);
          assert.deepEqual(home.consoleHits, []);
          const built = splitJsonLd(await readFile(path.join(target.out, 'index.html'), 'utf8')).blocks;
          assert.equal(home.jsonLd.length, 1);
          assert.deepEqual(JSON.parse(home.jsonLd[0]), built[0]);

          const missing = await visit(browser, `${server.url}/no-existe`);
          assert.equal(missing.status, 404);
          assert.match(missing.title, /Página no encontrada/);
          assert.deepEqual(missing.violations, []);
          assert.deepEqual(missing.consoleHits, []);
          assert.deepEqual(missing.jsonLd, []);
        } finally {
          await server.close();
        }
      });
    }
  });
}
