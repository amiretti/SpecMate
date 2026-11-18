// Rules (US-12 FR-003, ADR-0038, plan decision 3): Lighthouse runs the default mobile config minus ONLY the
// `robots-txt` audit (a false negative caused by our own `connect-src 'none'`); skipping any other audit fails here.
// Error reporting is always off. The verdict is the median run of the three (computeMedianRun), so one run out
// of range does not decide it (edge case of AC-1). The real run here is 1 run on the home only (risk R1).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import defaultConfig from 'lighthouse/core/config/default-config.js';
import {
  CATEGORIES,
  evaluateRuns,
  LIGHTHOUSE_CONFIG,
  LIGHTHOUSE_FLAGS,
  launchBrowser,
  run,
} from '../scripts/controls/lighthouse.mjs';
import { VARIANTS } from './lib/build.mjs';

/** Every audit id the 4 measured categories reference in Lighthouse's default config. */
const expectedAudits = () =>
  CATEGORIES.flatMap((id) => defaultConfig.categories[id].auditRefs.map((ref) => ref.id)).filter(
    (id) => id !== 'robots-txt',
  );

/** Whether Lighthouse runs audit `id` in navigation mode (some, like INP, only exist in timespan mode). */
async function runsInNavigation(id) {
  const file = defaultConfig.audits.find((a) => typeof a === 'string' && a.split('/').at(-1) === id);
  if (!file) throw new Error(`audit ${id} not found in the default config`);
  const { default: audit } = await import(`lighthouse/core/audits/${file}.js`);
  return audit.meta.supportedModes?.includes('navigation') ?? true;
}

/** A synthetic LHR: category scores (0..1) and the two metrics computeMedianRun sorts by. */
const lhr = (performance, fcp, tti) => ({
  categories: {
    performance: { score: performance },
    accessibility: { score: 1 },
    'best-practices': { score: 1 },
    seo: { score: 1 },
  },
  audits: { 'first-contentful-paint': { numericValue: fcp }, interactive: { numericValue: tti } },
});

describe('check:lighthouse configuration', () => {
  it('skips robots-txt and nothing else, over the default mobile config', () => {
    assert.equal(LIGHTHOUSE_CONFIG.extends, 'lighthouse:default');
    assert.deepEqual(LIGHTHOUSE_CONFIG.settings.skipAudits, ['robots-txt']);
    assert.equal(LIGHTHOUSE_CONFIG.settings.onlyAudits, undefined);
    assert.equal(LIGHTHOUSE_CONFIG.settings.formFactor ?? 'mobile', 'mobile');
    assert.equal(LIGHTHOUSE_CONFIG.settings.screenEmulation, undefined);
    assert.deepEqual([...CATEGORIES].sort(), ['accessibility', 'best-practices', 'performance', 'seo']);
    assert.deepEqual(LIGHTHOUSE_CONFIG.settings.onlyCategories, CATEGORIES);
  });

  it('never enables error reporting (the @sentry/node stub throws if imported)', () => {
    assert.equal(LIGHTHOUSE_FLAGS.enableErrorReporting, false);
  });
});

// #48 (security review V1, BAJO-4): Chromium picks its own DevTools port (--remote-debugging-port=0) and the control
// reads it back, so no port is chosen beforehand (no race with another process). The port listens on 127.0.0.1 only
// while Lighthouse runs: the pipe was tried and made Lighthouse lose the trace (NO_NAVSTART) inside the suite.
describe('check:lighthouse browser', () => {
  it('reads the DevTools port Chromium chose, on 127.0.0.1, and frees it on close', async () => {
    const browser = await launchBrowser();
    let closed = false;
    try {
      assert.ok(Number.isInteger(browser.port) && browser.port > 0, String(browser.port));
      const version = await (await fetch(`http://127.0.0.1:${browser.port}/json/version`)).json();
      assert.match(version.Browser, /Chrom/);
      await browser.close();
      closed = true;
      await assert.rejects(fetch(`http://127.0.0.1:${browser.port}/json/version`));
    } finally {
      if (!closed) await browser.close();
    }
  });

  it('never picks the port itself', async () => {
    const source = await readFile(new URL('../scripts/controls/lighthouse.mjs', import.meta.url), 'utf8');
    assert.match(source, /--remote-debugging-port=0/);
    assert.doesNotMatch(source, /freePort|listen\(0/);
  });
});

describe('check:lighthouse median of the runs', () => {
  it('one run out of range and two in range: the median decides and passes', () => {
    const { violations, median } = evaluateRuns('index.html', [
      lhr(0.42, 9000, 15000),
      lhr(0.99, 1500, 1600),
      lhr(0.98, 1520, 1650),
    ]);
    assert.deepEqual(violations, []);
    assert.ok(median.categories.performance.score >= 0.98);
  });

  it('two runs out of range and one in range: the median decides and fails', () => {
    const { violations } = evaluateRuns('index.html', [
      lhr(0.42, 9000, 15000),
      lhr(0.5, 8800, 14000),
      lhr(0.99, 1500, 1600),
    ]);
    assert.match(violations.join('\n'), /index\.html: performance \d+ < 90 \(median of 3 runs\)/);
  });

  it('a run without the metrics cannot be measured and fails', () => {
    const { violations } = evaluateRuns('index.html', [{ categories: {}, audits: {} }]);
    assert.match(violations.join('\n'), /could not measure/);
  });
});

describe('check:lighthouse on the healthy build (1 run, home only)', () => {
  it('passes the ADR-0030 thresholds and ran every default audit except robots-txt', async () => {
    const result = await run(VARIANTS.address.out, { runs: 1 });
    assert.deepEqual(result.violations, []);
    assert.equal(result.ok, true);
    const [{ lhr: report }] = result.reports;
    assert.equal(report.audits['robots-txt'], undefined);
    assert.deepEqual(report.configSettings.skipAudits, ['robots-txt']);
    const absent = expectedAudits().filter((id) => report.audits[id] === undefined);
    const skipped = [];
    for (const id of absent) if (await runsInNavigation(id)) skipped.push(id);
    assert.deepEqual(skipped, [], `skipped audits: ${skipped.join(', ')}`);
  });
});
