// Control "Rendimiento y SEO" (ADR-0030, ADR-0038, US-12 FR-003): Lighthouse 13 by its API (no LHCI), default mobile
// profile, on every content page of a build served with the real `_headers`. Each page runs 3 times and the verdict
// is "la mediana de tres" (computeMedianRun). Threshold: "Rendimiento ≥ 90; accesibilidad, buenas prácticas y
// SEO ≥ 95". Only `robots-txt` is skipped: Lighthouse fetches it from the page and our `connect-src 'none'` blocks
// it (plan decision 3; robots.txt is covered by seo-files.test.mjs). Error reporting is always off: `@sentry/node`
// is a stub that throws if imported. The 404 page is not measured: it is `noindex` on purpose.
// A control that cannot measure (no browser, a run without metrics) fails, never passes (constitution VI).
// Chromium picks its own DevTools port (--remote-debugging-port=0, read back from the profile; #48).
// Usage: node scripts/controls/lighthouse.mjs <buildDir>
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { computeMedianRun, filterToValidRuns } from 'lighthouse/core/lib/median-run.js';
import { chromium } from 'playwright';
import { serve } from '../../test/lib/serve.mjs';
import { firstLine, pagePaths } from './behavior.mjs';

export const RUNS = 3;
export const THRESHOLDS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 95 };
export const CATEGORIES = Object.keys(THRESHOLDS);

export const LIGHTHOUSE_CONFIG = {
  extends: 'lighthouse:default',
  settings: { onlyCategories: CATEGORIES, skipAudits: ['robots-txt'] },
};

export const LIGHTHOUSE_FLAGS = { output: 'json', logLevel: 'error', enableErrorReporting: false };

/** Median verdict of the runs of one page: `{ violations, median, summary }`. */
export function evaluateRuns(label, lhrs) {
  const valid = filterToValidRuns(lhrs.filter((lhr) => !lhr.runtimeError));
  if (valid.length === 0 || valid.length !== lhrs.length) {
    const why = lhrs.find((lhr) => lhr.runtimeError)?.runtimeError?.message ?? 'a run has no FCP or TTI metric';
    return { violations: [`${label}: could not measure (${valid.length} of ${lhrs.length} runs valid: ${why})`] };
  }
  const median = computeMedianRun(valid);
  const of = `(median of ${valid.length} run${valid.length === 1 ? '' : 's'})`;
  const violations = [];
  const scores = [];
  for (const [id, min] of Object.entries(THRESHOLDS)) {
    const score = median.categories[id]?.score;
    if (typeof score !== 'number') {
      violations.push(`${label}: could not measure ${id} ${of}`);
      continue;
    }
    const value = Math.round(score * 100);
    scores.push(`${id} ${value}`);
    if (value < min) violations.push(`${label}: ${id} ${value} < ${min} ${of}`);
  }
  return { violations, median, summary: `${label}: ${scores.join(', ')} ${of}` };
}

/** The port Chromium wrote to `<userDataDir>/DevToolsActivePort` (first line), waiting up to 10 s for the file. */
async function activePort(userDataDir) {
  const file = path.join(userDataDir, 'DevToolsActivePort');
  for (let waited = 0; waited < 10_000; waited += 100) {
    const port = Number.parseInt((await readFile(file, 'utf8').catch(() => '')).split('\n')[0], 10);
    if (Number.isInteger(port) && port > 0) return port;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chromium did not report its DevTools port');
}

/**
 * Chromium with its DevTools endpoint on 127.0.0.1 and a port Chromium picks itself (#48): choosing a free port
 * beforehand raced with other processes. The port is read back from the profile and closes with the browser.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function launchBrowser({ executablePath } = {}) {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'specmate-lighthouse-'));
  let context;
  // Never throws: a profile Windows still holds must not hide the verdict or the launch error.
  const close = async () => {
    await context?.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
  };
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...(executablePath ? { executablePath } : {}),
      args: ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'],
    });
    return { port: await activePort(userDataDir), close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * @param {{ runs?: number, executablePath?: string }} [opts]  `runs` below 3 only in tests (risk R1).
 * @returns {Promise<{ ok: boolean, violations: string[], summary: string[], reports: Array<{ rel: string, lhr: object }> }>}
 */
export async function run(dir, { runs = RUNS, executablePath } = {}) {
  const pages = await pagePaths(dir).catch(() => []);
  if (pages.length === 0) {
    return { ok: false, violations: [`could not measure ${dir}: no HTML pages`], summary: [], reports: [] };
  }
  let browser;
  try {
    browser = await launchBrowser({ executablePath });
  } catch (error) {
    const failure = `could not measure ${dir}: no browser (${firstLine(error)})`;
    return { ok: false, violations: [failure], summary: [], reports: [] };
  }
  const { port } = browser;
  const content = pages.filter((page) => page.rel !== '404.html');
  const violations = [];
  const summary = [];
  const reports = [];
  let server;
  try {
    try {
      server = await serve(dir);
    } catch (error) {
      return {
        ok: false,
        violations: [`could not measure ${dir}: cannot serve it (${firstLine(error)})`],
        summary,
        reports,
      };
    }
    if (content.length === 0) violations.push(`could not measure ${dir}: no content pages`);
    for (const page of content) {
      const lhrs = [];
      for (let i = 0; i < runs; i++) {
        try {
          const result = await lighthouse(
            `${server.url}${page.url}`,
            { ...LIGHTHOUSE_FLAGS, port, hostname: '127.0.0.1' },
            LIGHTHOUSE_CONFIG,
          );
          lhrs.push(result?.lhr ?? { runtimeError: { message: 'Lighthouse returned no report' } });
        } catch (error) {
          lhrs.push({ runtimeError: { message: firstLine(error) } });
        }
      }
      const verdict = evaluateRuns(page.rel, lhrs);
      violations.push(...verdict.violations);
      if (verdict.summary) summary.push(verdict.summary);
      if (verdict.median) reports.push({ rel: page.rel, lhr: verdict.median });
    }
  } finally {
    await server?.close();
    await browser.close();
  }
  return { ok: violations.length === 0, violations, summary, reports };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations, summary } = await run(dir);
  for (const line of summary) console.log(`check:lighthouse ${line}`);
  for (const v of violations) console.error(`check:lighthouse FAIL ${v}`);
  console.log(
    ok
      ? 'check:lighthouse OK: performance >= 90; accessibility, best-practices and SEO >= 95 (mobile, median of 3)'
      : `check:lighthouse: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
